"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { mergeAttributes, Node } from "@tiptap/core"
import type { Editor as TiptapEditor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import {
    ArrowLeft,
    ArrowRight,
    Bold,
    Check,
    Code2,
    Copy,
    Download,
    ImagePlus,
    List,
    Table as TableIcon,
    Minus,
    Plus,
    Trash2,
    X,
} from "lucide-react"
import { Toggle } from "@/components/ui/toggle"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const MAX_UPLOAD_FILE_BYTES = 12 * 1024 * 1024

const ScreenshotImage = Node.create({
    name: "image",
    group: "block",
    draggable: true,
    selectable: true,
    atom: true,
    addAttributes() {
        return {
            src: { default: null },
            alt: { default: null },
            title: { default: null },
        }
    },
    parseHTML() {
        return [{ tag: "img[src]" }]
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "img",
            mergeAttributes(HTMLAttributes, {
                class: "max-w-[70%] h-auto rounded-lg border border-[var(--line-subtle)] shadow-sm my-3 cursor-zoom-in",
            }),
        ]
    },
})

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    variant?: "default" | "plain"
    minHeightClassName?: string
    uploadProjectId?: string
    toolbarVisibility?: "focus" | "always"
    toolbarPreset?: "full" | "minimal"
    toolbarTone?: "default" | "quiet"
    toolbarPinned?: boolean
    toolbarPlacement?: "bar" | "top-right"
    toolbarActions?: React.ReactNode
    documentHeader?: React.ReactNode
    notesMode?: boolean
    notesAppearance?: "current" | "apple"
    focusToken?: string | number
    className?: string
    mode?: "panel" | "document"
    panelStyle?: "default" | "borderless"
    documentLayout?: "center" | "left"
    documentWidth?: "full" | "reading"
}

type UploadState = {
    completed: number
    total: number
    error?: string
}

type ImageViewerState = {
    open: boolean
    index: number
    zoom: number
    sources: string[]
}

const INITIAL_VIEWER_STATE: ImageViewerState = {
    open: false,
    index: 0,
    zoom: 1,
    sources: [],
}

function extractImageSources(editor: TiptapEditor): string[] {
    const sources: string[] = []
    editor.state.doc.descendants((node) => {
        if (node.type.name === "image" && node.attrs?.src) {
            sources.push(String(node.attrs.src))
        }
        return true
    })
    return sources
}

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(new Error("Failed to read image"))
        reader.readAsDataURL(file)
    })
}

export function RichTextEditor({
    value,
    onChange,
    placeholder,
    variant = "default",
    minHeightClassName,
    uploadProjectId,
    toolbarVisibility = "focus",
    toolbarPreset = "full",
    toolbarTone = "default",
    toolbarPinned = false,
    toolbarPlacement = "bar",
    toolbarActions,
    documentHeader,
    notesMode = false,
    notesAppearance = "current",
    focusToken,
    className,
    mode = "panel",
    panelStyle = "default",
    documentLayout = "center",
    documentWidth = "full",
}: RichTextEditorProps) {
    const [isFocused, setIsFocused] = React.useState(false)
    const [uploadState, setUploadState] = React.useState<UploadState | null>(null)
    const [viewer, setViewer] = React.useState<ImageViewerState>(INITIAL_VIEWER_STATE)
    const [imageSources, setImageSources] = React.useState<string[]>([])
    const [codeCopyState, setCodeCopyState] = React.useState<"idle" | "copied" | "error">("idle")
    const editorRef = React.useRef<TiptapEditor | null>(null)
    const editorViewportRef = React.useRef<HTMLDivElement | null>(null)
    const imageInputRef = React.useRef<HTMLInputElement | null>(null)
    const lastEditorHtmlRef = React.useRef(value)
    const [codeCopyAnchor, setCodeCopyAnchor] = React.useState<{ top: number; left: number } | null>(null)
    const [activeCodeBlockElement, setActiveCodeBlockElement] = React.useState<HTMLElement | null>(null)
    const lastFocusTokenRef = React.useRef<string | number | undefined>(undefined)

    const syncImageSources = React.useCallback((nextSources: string[]) => {
        setImageSources((current) => {
            if (
                current.length === nextSources.length &&
                current.every((source, index) => source === nextSources[index])
            ) {
                return current
            }
            return nextSources
        })
    }, [])

    const collectImageSources = React.useCallback(() => {
        const editor = editorRef.current
        if (!editor) return [] as string[]
        return extractImageSources(editor)
    }, [])

    const refreshImageSources = React.useCallback(() => {
        const sources = collectImageSources()
        syncImageSources(sources)
        return sources
    }, [collectImageSources, syncImageSources])

    const insertImageSource = React.useCallback((src: string, alt: string) => {
        const editor = editorRef.current
        if (!editor || !src) return
        editor
            .chain()
            .focus()
            .insertContent({
                type: "image",
                attrs: { src, alt },
            })
            .run()
    }, [])

    const removeImageByIndex = React.useCallback((targetIndex: number) => {
        const editor = editorRef.current
        if (!editor) return

        let from = -1
        let to = -1
        let currentIndex = 0

        editor.state.doc.descendants((node, pos) => {
            if (node.type.name === "image") {
                if (currentIndex === targetIndex) {
                    from = pos
                    to = pos + node.nodeSize
                    return false
                }
                currentIndex += 1
            }
            return true
        })

        if (from !== -1 && to !== -1) {
            editor.chain().focus().deleteRange({ from, to }).run()
            syncImageSources(extractImageSources(editor))
        }
    }, [syncImageSources])

    const uploadImageFile = React.useCallback(
        async (file: File) => {
            if (file.size > MAX_UPLOAD_FILE_BYTES) {
                throw new Error(`Image ${file.name || "file"} is too large (max 12MB).`)
            }

            try {
                const formData = new FormData()
                formData.append("files", file)
                if (uploadProjectId) {
                    formData.append("projectId", uploadProjectId)
                }

                const response = await fetch("/api/project-notes/upload", {
                    method: "POST",
                    body: formData,
                })

                if (!response.ok) {
                    throw new Error("Upload failed")
                }

                const payload = (await response.json()) as { success?: boolean; urls?: string[] }
                if (payload.success && payload.urls?.[0]) {
                    return payload.urls[0]
                }
            } catch {
                // Fall back to local data URL when upload endpoint is unavailable.
            }

            return await fileToDataUrl(file)
        },
        [uploadProjectId]
    )

    const uploadAndInsertFiles = React.useCallback(
        async (files: File[]) => {
            const imageFiles = files.filter((file) => file.type.startsWith("image/"))
            if (!imageFiles.length) return

            setUploadState({ completed: 0, total: imageFiles.length })

            try {
                for (let index = 0; index < imageFiles.length; index += 1) {
                    const file = imageFiles[index]
                    const src = await uploadImageFile(file)
                    insertImageSource(src, file.name || "Screenshot")
                    setUploadState({ completed: index + 1, total: imageFiles.length })
                }

                setTimeout(() => setUploadState(null), 900)
            } catch (error) {
                setUploadState({
                    completed: 0,
                    total: imageFiles.length,
                    error: error instanceof Error ? error.message : "Failed to paste screenshot",
                })
                setTimeout(() => setUploadState(null), 2200)
            }
        },
        [insertImageSource, uploadImageFile]
    )

    const handleToolbarImageUpload = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"))
            if (files.length > 0) {
                void uploadAndInsertFiles(files)
            }
            event.currentTarget.value = ""
        },
        [uploadAndInsertFiles]
    )

    const openImageViewer = React.useCallback(
        (src: string) => {
            const sources = refreshImageSources()
            if (!sources.length) return
            const clickedIndex = sources.findIndex((item) => item === src)
            setViewer({
                open: true,
                sources,
                index: clickedIndex >= 0 ? clickedIndex : 0,
                zoom: 1,
            })
        },
        [refreshImageSources]
    )

    const openImageViewerAtIndex = React.useCallback(
        (index: number) => {
            const sources = refreshImageSources()
            if (!sources.length) return
            setViewer({
                open: true,
                sources,
                index: Math.max(0, Math.min(index, sources.length - 1)),
                zoom: 1,
            })
        },
        [refreshImageSources]
    )

    const resolveActiveCodeBlockElement = React.useCallback((currentEditor: TiptapEditor | null) => {
        if (!currentEditor || !currentEditor.isActive("codeBlock")) return null
        const { state, view } = currentEditor
        const { $from } = state.selection

        const domAtPos = view.domAtPos($from.pos)
        const selectionElement =
            domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement
        const selectionPre = selectionElement?.closest("pre")
        if (selectionPre instanceof HTMLElement) {
            return selectionPre
        }

        for (let depth = $from.depth; depth >= 0; depth -= 1) {
            const node = $from.node(depth)
            if (node.type.name !== "codeBlock") continue
            const pos = $from.before(depth)
            const domNode = view.nodeDOM(pos)
            if (domNode instanceof HTMLElement) {
                if (domNode.tagName === "PRE") return domNode
                const nestedPre = domNode.querySelector("pre")
                if (nestedPre instanceof HTMLElement) return nestedPre
                const closestPre = domNode.closest("pre")
                if (closestPre instanceof HTMLElement) return closestPre
            }
        }

        return null
    }, [])

    const updateCodeCopyAnchor = React.useCallback(
        (explicitEditor?: TiptapEditor | null) => {
            const currentEditor = explicitEditor ?? editorRef.current
            const viewport = editorViewportRef.current
            if (!currentEditor || !viewport) {
                setCodeCopyAnchor(null)
                setActiveCodeBlockElement(null)
                return
            }

            const codeBlockElement = resolveActiveCodeBlockElement(currentEditor)
            if (!codeBlockElement) {
                setCodeCopyAnchor(null)
                setActiveCodeBlockElement(null)
                return
            }

            const buttonSize = 28
            const inset = 8
            const viewportRect = viewport.getBoundingClientRect()
            const blockRect = codeBlockElement.getBoundingClientRect()
            const rawTop = blockRect.top - viewportRect.top + viewport.scrollTop + inset
            const rawLeft =
                blockRect.right -
                viewportRect.left +
                viewport.scrollLeft -
                buttonSize -
                inset
            const minTop = viewport.scrollTop + inset
            const maxTop = viewport.scrollTop + viewport.clientHeight - buttonSize - inset
            const minLeft = viewport.scrollLeft + inset
            const maxLeft = viewport.scrollLeft + viewport.clientWidth - buttonSize - inset
            const top = Math.max(minTop, Math.min(rawTop, maxTop))
            const left = Math.max(minLeft, Math.min(rawLeft, maxLeft))

            setActiveCodeBlockElement(codeBlockElement)
            setCodeCopyAnchor((current) => {
                if (current && current.top === top && current.left === left) return current
                return { top, left }
            })
        },
        [resolveActiveCodeBlockElement]
    )

    const copyTextToClipboard = React.useCallback(async (text: string) => {
        if (!text) return false

        try {
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text)
                return true
            }
        } catch {
            // Fall back to execCommand copy for environments with restricted clipboard APIs.
        }

        try {
            const textarea = document.createElement("textarea")
            textarea.value = text
            textarea.setAttribute("readonly", "")
            textarea.style.position = "fixed"
            textarea.style.left = "-9999px"
            textarea.style.top = "0"
            textarea.style.opacity = "0"
            document.body.appendChild(textarea)
            textarea.focus()
            textarea.select()
            const copied = document.execCommand("copy")
            document.body.removeChild(textarea)
            return copied
        } catch {
            return false
        }
    }, [])

    const copyActiveCodeBlock = React.useCallback(async () => {
        const editor = editorRef.current
        if (!editor) return

        const { state } = editor
        const { $from } = state.selection
        let codeText = ""

        for (let depth = $from.depth; depth >= 0; depth -= 1) {
            const node = $from.node(depth)
            if (node.type.name === "codeBlock") {
                codeText = node.textContent
                break
            }
        }

        if (!codeText && activeCodeBlockElement) {
            const codeElement = activeCodeBlockElement.querySelector("code")
            codeText = (codeElement?.textContent || activeCodeBlockElement.textContent || "").trimEnd()
        }

        if (!codeText) {
            codeText = state.doc.textBetween(state.selection.from, state.selection.to, "\n", "\n")
        }

        if (!codeText.trim()) {
            setCodeCopyState("error")
            setTimeout(() => setCodeCopyState("idle"), 1400)
            return
        }

        const copied = await copyTextToClipboard(codeText)
        if (copied) {
            setCodeCopyState("copied")
        } else {
            setCodeCopyState("error")
        }

        setTimeout(() => setCodeCopyState("idle"), 1400)
    }, [activeCodeBlockElement, copyTextToClipboard])

    const notesFirstLineClass = notesMode
        ? notesAppearance === "apple"
            ? "[&>*:first-child]:mt-0 [&>*:first-child]:mb-1 [&>*:first-child]:text-[1.45rem] [&>*:first-child]:font-semibold [&>*:first-child]:tracking-[-0.02em] [&>*:first-child]:leading-[1.2] [&>*:first-child]:text-[#1f2937] md:[&>*:first-child]:text-[1.62rem]"
            : "[&>*:first-child]:mt-0 [&>*:first-child]:mb-0.5 [&>*:first-child]:text-[1.08rem] [&>*:first-child]:font-medium [&>*:first-child]:tracking-[-0.01em] [&>*:first-child]:leading-[1.34] [&>*:first-child]:text-[var(--text-primary)] md:[&>*:first-child]:text-[1.15rem]"
        : ""

    const editor = useEditor({
        extensions: [
            StarterKit,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            ScreenshotImage,
            Placeholder.configure({
                placeholder: placeholder ?? "Start writing...",
                emptyEditorClass:
                    "is-editor-empty before:content-[attr(data-placeholder)] before:text-muted-foreground before:float-left before:pointer-events-none before:h-0",
            }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: cn(
                    "prose prose-sm focus:outline-none min-h-[150px] max-w-none [&_img]:max-w-[70%] [&_img]:h-auto [&_img]:rounded-lg [&_img]:border [&_img]:border-[var(--line-subtle)] [&_img]:shadow-sm [&_img]:my-3 [&_h1]:text-[1.5rem] [&_h1]:font-bold [&_h1]:tracking-[-0.02em] [&_h1]:leading-tight [&_h1]:mt-5 [&_h1]:mb-2 [&_h2]:text-[1.2rem] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:leading-tight [&_h2]:mt-4 [&_h2]:mb-2 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-1 [&_pre]:relative [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-amber-200 [&_pre]:bg-amber-50/60 [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-[var(--text-primary)] [&_pre]:shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-mono [&_pre_code]:text-[12px] [&_pre_code]:leading-6 [&_code]:rounded [&_code]:bg-amber-50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-[var(--text-secondary)] [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-[var(--line-subtle)] [&_table]:rounded-lg [&_th]:border [&_th]:border-[var(--line-subtle)] [&_th]:bg-[var(--surface-low)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:border [&_td]:border-[var(--line-subtle)] [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm",
                    mode === "document" && "min-h-full",
                    notesFirstLineClass
                ),
            },
            handleKeyDown(_, event) {
                if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.altKey
                ) {
                    const currentEditor = editorRef.current
                    if (currentEditor?.isActive("bulletList")) {
                        const handled = currentEditor
                            .chain()
                            .focus()
                            .splitListItem("listItem")
                            .run()
                        if (handled) {
                            event.preventDefault()
                            return true
                        }
                    }
                }
                return false
            },
            handlePaste(_, event) {
                const files = Array.from(event.clipboardData?.files || []).filter((file) =>
                    file.type.startsWith("image/")
                )
                if (!files.length) return false
                void uploadAndInsertFiles(files)
                event.preventDefault()
                return true
            },
            handleDrop(view, event) {
                const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
                    file.type.startsWith("image/")
                )
                if (!files.length) return false

                const dropPosition = view.posAtCoords({
                    left: event.clientX,
                    top: event.clientY,
                })
                if (dropPosition && editorRef.current) {
                    editorRef.current.chain().focus().setTextSelection(dropPosition.pos).run()
                }

                void uploadAndInsertFiles(files)
                event.preventDefault()
                return true
            },
            handleClick(_, __, event) {
                const target = event.target as HTMLElement
                if (target?.tagName !== "IMG") return false
                const src = (target as HTMLImageElement).src
                if (!src) return false
                openImageViewer(src)
                return true
            },
        },
        onUpdate: ({ editor: currentEditor }) => {
            const html = currentEditor.getHTML()
            lastEditorHtmlRef.current = html
            syncImageSources(extractImageSources(currentEditor))
            onChange(html)
            updateCodeCopyAnchor(currentEditor)
        },
        onSelectionUpdate: ({ editor: currentEditor }) => {
            updateCodeCopyAnchor(currentEditor)
        },
        onFocus: ({ editor: currentEditor }) => {
            setIsFocused(true)
            updateCodeCopyAnchor(currentEditor)
        },
        onBlur: () => {
            setIsFocused(false)
            setCodeCopyAnchor(null)
            setActiveCodeBlockElement(null)
        },
        immediatelyRender: false,
    })

    React.useEffect(() => {
        editorRef.current = editor
        if (editor) {
            syncImageSources(extractImageSources(editor))
            updateCodeCopyAnchor(editor)
        }
    }, [editor, syncImageSources, updateCodeCopyAnchor])

    React.useEffect(() => {
        const viewport = editorViewportRef.current
        if (!viewport) return

        const syncAnchor = () => updateCodeCopyAnchor()
        viewport.addEventListener("scroll", syncAnchor, { passive: true })
        window.addEventListener("resize", syncAnchor)
        return () => {
            viewport.removeEventListener("scroll", syncAnchor)
            window.removeEventListener("resize", syncAnchor)
        }
    }, [updateCodeCopyAnchor])

    React.useEffect(() => {
        if (!editor) return
        if (value === editor.getHTML()) return
        if (value === lastEditorHtmlRef.current) return
        if (editor.isFocused) return

        editor.commands.setContent(value, { emitUpdate: false })
        lastEditorHtmlRef.current = value
    }, [value, editor])

    React.useEffect(() => {
        if (!viewer.open) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setViewer(INITIAL_VIEWER_STATE)
                return
            }

            if (event.key === "ArrowRight") {
                setViewer((current) => ({
                    ...current,
                    index: current.sources.length
                        ? (current.index + 1) % current.sources.length
                        : 0,
                }))
            }

            if (event.key === "ArrowLeft") {
                setViewer((current) => ({
                    ...current,
                    index: current.sources.length
                        ? (current.index - 1 + current.sources.length) % current.sources.length
                        : 0,
                }))
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [viewer.open])

    React.useEffect(() => {
        if (focusToken === undefined || focusToken === null) return
        if (!editor) return
        if (lastFocusTokenRef.current === focusToken) return
        lastFocusTokenRef.current = focusToken

        const rafId = window.requestAnimationFrame(() => {
            editor.chain().focus("start").run()
        })
        return () => window.cancelAnimationFrame(rafId)
    }, [editor, focusToken])
    const handleEditorViewportMouseDown = React.useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (event.button !== 0) return
            if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return

            const target = event.target as HTMLElement | null
            const currentEditor = editorRef.current
            if (!target || !currentEditor) return
            if (target.closest(".ProseMirror")) return
            if (target.closest("button, a, input, textarea, select, summary, details, [role='button']")) return

            event.preventDefault()
            const positionAtClick = currentEditor.view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
            })

            if (positionAtClick) {
                currentEditor.chain().focus().setTextSelection(positionAtClick.pos).run()
                return
            }

            const editorRect = currentEditor.view.dom.getBoundingClientRect()
            if (event.clientY <= editorRect.top + 8) {
                currentEditor.chain().focus("start").run()
                return
            }

            currentEditor.chain().focus("end").run()
        },
        []
    )

    if (!editor) {
        return null
    }

    const currentViewerSrc = viewer.sources[viewer.index] || ""
    const resolvedToolbarPinned = notesMode ? false : toolbarPinned
    const resolvedToolbarVisibility = notesMode ? "always" : toolbarVisibility
    const resolvedToolbarPreset = notesMode ? "minimal" : toolbarPreset
    const resolvedToolbarTone = notesMode ? "quiet" : toolbarTone
    const resolvedToolbarPlacement = notesMode ? "top-right" : toolbarPlacement
    const isToolbarPinned = resolvedToolbarPinned
    const showToolbar = isToolbarPinned || resolvedToolbarVisibility === "always" || isFocused
    const isMinimalToolbar = resolvedToolbarPreset === "minimal"
    const isCompactToolbar = isMinimalToolbar || isToolbarPinned
    const isTopRightToolbar = resolvedToolbarPlacement === "top-right"
    const isBorderlessPanel = variant === "plain" && mode === "panel" && panelStyle === "borderless"
    const isDocumentLeft = mode === "document" && documentLayout === "left"
    const isQuietToolbar = resolvedToolbarTone === "quiet"
    const isReadingWidth = mode === "document" && documentWidth === "reading"
    const isAppleNotesAppearance = notesMode && notesAppearance === "apple"
    const compactControlClass = notesMode ? "h-9 w-9 md:h-8 md:w-8 lg:h-7 lg:w-7" : "h-8 w-8"
    const compactIconClass = notesMode ? "h-[1rem] w-[1rem] md:h-[0.94rem] md:w-[0.94rem] lg:h-[0.86rem] lg:w-[0.86rem]" : "h-4 w-4"
    const notesControlClass = notesMode
        ? isAppleNotesAppearance
            ? "rounded-full border border-transparent text-[#6b7280] data-[state=on]:border-[#d8dee8] data-[state=on]:bg-[#f2f4f8] data-[state=on]:text-[#1f2937] hover:bg-[#f2f4f8] hover:text-[#1f2937]"
            : "rounded-full border border-transparent text-[var(--text-secondary)] data-[state=on]:border-[var(--line-subtle)] data-[state=on]:bg-[var(--surface-low)] data-[state=on]:text-[var(--text-primary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
        : ""

    return (
        <>
            <div
                className={cn(
                    "flex flex-col overflow-hidden rounded-xl transition-colors",
                    isTopRightToolbar && "relative",
                    variant === "default" &&
                        "border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring",
                    variant === "plain" &&
                        mode === "panel" &&
                        (isBorderlessPanel
                            ? "border-0 bg-transparent shadow-none"
                            : "border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_8px_24px_-20px_rgba(15,23,42,0.35)]"),
                    variant === "plain" &&
                        mode === "document" &&
                        (isAppleNotesAppearance
                            ? "border-0 bg-transparent shadow-none"
                            : "border border-transparent bg-transparent shadow-none"),
                    className
                )}
            >
                {showToolbar && (
                    <div
                        onMouseDown={(event) => {
                            const target = event.target as HTMLElement
                            if (target.closest("button")) return
                            event.preventDefault()
                        }}
                        className={cn(
                            "flex items-center",
                            isTopRightToolbar &&
                                (isAppleNotesAppearance
                                    ? "absolute right-2.5 top-2.5 z-30 max-w-[calc(100%-1.25rem)] rounded-full border border-[#e3e7ef] bg-[color:color-mix(in_srgb,#f8f9fb_95%,white)] shadow-[0_4px_10px_-12px_rgba(15,23,42,0.34)] supports-[backdrop-filter]:backdrop-blur-xl"
                                    : "absolute right-2.5 top-2.5 z-30 max-w-[calc(100%-1.25rem)] rounded-full border border-[var(--line-subtle)]/70 bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.46)] supports-[backdrop-filter]:backdrop-blur-xl md:right-3 md:top-3"),
                            isCompactToolbar ? "gap-1 px-1.5 py-1 md:px-2" : "gap-1.5 p-1.5",
                            isToolbarPinned && !isTopRightToolbar && "sticky top-0 z-20 min-h-12 md:min-h-[52px]",
                            !isTopRightToolbar && variant === "default" && "border-b bg-muted/20",
                            !isTopRightToolbar &&
                                variant === "plain" &&
                                mode === "panel" &&
                                (isBorderlessPanel
                                    ? "border-b-0 bg-transparent px-0 py-0.5"
                                    : "border-b border-[var(--line-subtle)] bg-[var(--surface-lowest)]"),
                            !isTopRightToolbar &&
                                variant === "plain" &&
                                mode === "document" &&
                                (isDocumentLeft
                                    ? cn(
                                        "mx-1 mt-1 mb-2 rounded-xl px-2 py-1.5 md:px-2.5 md:py-2 supports-[backdrop-filter]:backdrop-blur-xl",
                                        isReadingWidth ? "w-[calc(100%-0.5rem)] max-w-[860px]" : "w-[calc(100%-0.5rem)]",
                                        isQuietToolbar
                                            ? "border border-[var(--line-subtle)]/65 bg-[color:color-mix(in_srgb,var(--surface-lowest)_84%,var(--surface-low)_16%)] shadow-[0_10px_22px_-22px_rgba(15,23,42,0.45)]"
                                            : "border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)]"
                                    )
                                    : cn(
                                        "mx-4 md:mx-auto mt-4 mb-6 w-full md:w-[calc(100%-2rem)] max-w-4xl rounded-xl px-3 pt-2 pb-2 backdrop-blur-sm",
                                        isQuietToolbar
                                            ? "border border-[var(--line-subtle)]/65 bg-[var(--surface-lowest)] shadow-[0_10px_22px_-22px_rgba(15,23,42,0.45)]"
                                            : "border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)]"
                                    ))
                        )}
                    >
                        {!isMinimalToolbar ? (
                            <>
                                <Toggle
                                    size="sm"
                                    pressed={editor.isActive("paragraph")}
                                    onPressedChange={() => editor.chain().focus().setParagraph().run()}
                                    className={cn(
                                        "text-xs font-semibold",
                                        isCompactToolbar ? "h-8 px-2.5" : "h-8 px-3"
                                    )}
                                    aria-label="Paragraph"
                                >
                                    P
                                </Toggle>
                                <Toggle
                                    size="sm"
                                    pressed={editor.isActive("heading", { level: 1 })}
                                    onPressedChange={(pressed) =>
                                        pressed
                                            ? editor.chain().focus().setHeading({ level: 1 }).run()
                                            : editor.chain().focus().setParagraph().run()
                                    }
                                    className={cn(
                                        "text-xs font-semibold",
                                        isCompactToolbar ? "h-8 px-2.5" : "h-8 px-3"
                                    )}
                                    aria-label="Heading 1"
                                >
                                    H1
                                </Toggle>
                                <Toggle
                                    size="sm"
                                    pressed={editor.isActive("heading", { level: 2 })}
                                    onPressedChange={(pressed) =>
                                        pressed
                                            ? editor.chain().focus().setHeading({ level: 2 }).run()
                                            : editor.chain().focus().setParagraph().run()
                                    }
                                    className={cn(
                                        "text-xs font-semibold",
                                        isCompactToolbar ? "h-8 px-2.5" : "h-8 px-3"
                                    )}
                                    aria-label="Heading 2"
                                >
                                    H2
                                </Toggle>
                                <div className="mx-1 h-4 w-px bg-border/50" />
                            </>
                        ) : null}
                        <Toggle
                            size="sm"
                            pressed={editor.isActive("bold")}
                            onPressedChange={(pressed) =>
                                pressed
                                    ? editor.chain().focus().setBold().run()
                                    : editor.chain().focus().unsetBold().run()
                            }
                            className={cn(compactControlClass, "p-0", notesControlClass)}
                            aria-label="Bold"
                        >
                            <Bold className={compactIconClass} />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive("bulletList")}
                            onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                            className={cn(compactControlClass, "p-0", notesControlClass)}
                            aria-label="Bullet list"
                        >
                            <List className={compactIconClass} />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive("codeBlock")}
                            onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
                            className={cn(compactControlClass, "p-0", notesControlClass)}
                            aria-label="Code snippet"
                            title="Code snippet"
                        >
                            <Code2 className={compactIconClass} />
                        </Toggle>
                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className={cn(
                                "inline-flex items-center justify-center rounded-md border border-transparent text-[var(--text-secondary)] transition hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]",
                                compactControlClass,
                                notesMode && "rounded-full"
                            )}
                            aria-label="Upload image"
                            title="Upload image"
                        >
                            <ImagePlus className={compactIconClass} />
                        </button>
                        {!isMinimalToolbar ? (
                            <>
                                <div className="mx-1 h-4 w-px bg-border/50" />
                                <button
                                    type="button"
                                    onClick={() =>
                                        editor
                                            .chain()
                                            .focus()
                                            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                                            .run()
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[var(--text-secondary)] transition hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                    aria-label="Insert table"
                                    title="Insert table"
                                >
                                    <TableIcon className="h-4 w-4" />
                                </button>
                            </>
                        ) : null}
                        {toolbarActions && (
                            <div className={cn("ml-auto flex items-center gap-1", isQuietToolbar && "pl-2")}>
                                {isQuietToolbar ? <div className="mr-1 h-4 w-px bg-[var(--line-subtle)]" /> : null}
                                {toolbarActions}
                            </div>
                        )}
                    </div>
                )}
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleToolbarImageUpload}
                />

                {editor && (
                    <BubbleMenu
                        editor={editor}
                        shouldShow={({ editor: currentEditor }: { editor: TiptapEditor }) =>
                            currentEditor.isActive("table") &&
                            !Boolean(resolveActiveCodeBlockElement(currentEditor))
                        }
                    >
                        <div className="flex items-center gap-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1 shadow-md">
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnBefore().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                            >
                                + Col
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnAfter().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                            >
                                Col +
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowBefore().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                            >
                                + Row
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowAfter().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                            >
                                Row +
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteColumn().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                            >
                                Del Col
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteRow().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                            >
                                Del Row
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteTable().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                            >
                                Delete Table
                            </button>
                        </div>
                    </BubbleMenu>
                )}

                {editor &&
                    codeCopyAnchor && (
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                void copyActiveCodeBlock()
                            }}
                            style={{ top: codeCopyAnchor.top, left: codeCopyAnchor.left }}
                            className={cn(
                                "absolute z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-200 bg-[var(--surface-lowest)] shadow-sm transition",
                                codeCopyState === "copied"
                                    ? "text-emerald-600"
                                    : codeCopyState === "error"
                                        ? "text-rose-600"
                                        : "text-[var(--text-secondary)] hover:bg-amber-50"
                            )}
                            aria-label="Copy code"
                            title="Copy code"
                        >
                            {codeCopyState === "copied" ? (
                                <Check className="h-3.5 w-3.5" />
                            ) : (
                                <Copy className="h-3.5 w-3.5" />
                            )}
                        </button>
                    )}

                {uploadState && (
                    <div
                        className={cn(
                            "mx-4 mb-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs",
                            uploadState.error
                                ? "border border-rose-200 bg-rose-50 text-rose-700"
                                : "border border-blue-200 bg-blue-50 text-blue-700"
                        )}
                    >
                        <span>
                            {uploadState.error
                                ? uploadState.error
                                : `Uploading screenshots ${uploadState.completed}/${uploadState.total}`}
                        </span>
                        {!uploadState.error && <span>{Math.round((uploadState.completed / uploadState.total) * 100)}%</span>}
                    </div>
                )}

                <div
                    ref={editorViewportRef}
                    onMouseDown={handleEditorViewportMouseDown}
                    className={cn(
                        "relative min-h-[150px] flex-1 overflow-y-auto p-4",
                        isTopRightToolbar && "pt-2",
                        variant === "plain" &&
                            mode === "panel" &&
                            (isBorderlessPanel ? "bg-transparent px-0 py-2" : "bg-[var(--surface-lowest)] p-5"),
                        variant === "plain" &&
                            mode === "document" &&
                            (isAppleNotesAppearance ? "bg-transparent px-0 py-1.5" : "bg-transparent px-0 py-2"),
                        minHeightClassName
                    )}
                >
                    <div
                        className={cn(
                            mode === "document" &&
                                (isDocumentLeft
                                    ? cn("h-full w-full px-3 pb-7", isReadingWidth && "max-w-[860px]", isTopRightToolbar && "pr-36 sm:pr-44")
                                    : "mx-auto w-full max-w-4xl px-6 pb-8")
                        )}
                    >
                        {mode === "document" && documentHeader ? (
                            <div className="pb-2.5">{documentHeader}</div>
                        ) : null}
                        <EditorContent editor={editor} />
                    </div>
                </div>

                {imageSources.length > 0 && (
                    <div
                        className={cn(
                            "border-t border-[var(--line-subtle)] bg-[var(--surface-low)]/70 px-4 py-3",
                            isBorderlessPanel && "border-t-0 bg-transparent px-0 py-2",
                            mode === "document" &&
                                "border-[var(--line-subtle)] bg-transparent px-0 py-3"
                        )}
                    >
                        <div
                            className={cn(
                                mode === "document" &&
                                    (isDocumentLeft
                                        ? cn("w-full px-3", isReadingWidth && "max-w-[860px]")
                                        : "mx-auto w-full max-w-4xl px-6")
                            )}
                        >
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                                Screenshot Gallery ({imageSources.length})
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {imageSources.map((src, index) => (
                                    <button
                                        key={`${src}-${index}`}
                                        type="button"
                                        onClick={() => openImageViewerAtIndex(index)}
                                        className="group relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-sm transition hover:border-blue-300"
                                        title={`Open screenshot ${index + 1}`}
                                        aria-label={`Open screenshot ${index + 1}`}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={src}
                                            alt={`Screenshot ${index + 1}`}
                                            className="h-full w-full object-cover"
                                        />
                                        <span className="pointer-events-none absolute inset-0 bg-slate-900/0 transition group-hover:bg-slate-900/10" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Dialog
                open={viewer.open}
                onOpenChange={(open) =>
                    setViewer((current) =>
                        open ? current : { ...INITIAL_VIEWER_STATE, sources: current.sources }
                    )
                }
            >
                <DialogContent className="h-[94vh] w-[96vw] min-w-[80vw] max-w-[96vw] overflow-hidden border-slate-700 bg-black/95 p-0 sm:w-[90vw] sm:min-w-[80vw] sm:max-w-[90vw]">
                    <DialogTitle className="sr-only">Screenshot preview</DialogTitle>
                    <div className="flex h-full flex-col">
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setViewer((current) => ({
                                            ...current,
                                            index:
                                                current.sources.length > 0
                                                    ? (current.index - 1 + current.sources.length) %
                                                      current.sources.length
                                                    : 0,
                                        }))
                                    }
                                    className="rounded-md border border-white/20 p-1.5 transition hover:bg-[var(--surface-lowest)]/10"
                                    aria-label="Previous image"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setViewer((current) => ({
                                            ...current,
                                            index:
                                                current.sources.length > 0
                                                    ? (current.index + 1) % current.sources.length
                                                    : 0,
                                        }))
                                    }
                                    className="rounded-md border border-white/20 p-1.5 transition hover:bg-[var(--surface-lowest)]/10"
                                    aria-label="Next image"
                                >
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                                <span className="ml-1 text-xs font-semibold text-white/80">
                                    {viewer.sources.length > 0 ? viewer.index + 1 : 0} /{" "}
                                    {viewer.sources.length}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setViewer((current) => ({
                                            ...current,
                                            zoom: Math.max(0.4, Number((current.zoom - 0.1).toFixed(2))),
                                        }))
                                    }
                                    className="rounded-md border border-white/20 p-1.5 transition hover:bg-[var(--surface-lowest)]/10"
                                    aria-label="Zoom out"
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <span className="min-w-14 text-center text-xs font-semibold text-white/80">
                                    {Math.round(viewer.zoom * 100)}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setViewer((current) => ({
                                            ...current,
                                            zoom: Math.min(3, Number((current.zoom + 0.1).toFixed(2))),
                                        }))
                                    }
                                    className="rounded-md border border-white/20 p-1.5 transition hover:bg-[var(--surface-lowest)]/10"
                                    aria-label="Zoom in"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>

                                {currentViewerSrc && (
                                    <a
                                        href={currentViewerSrc}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-md border border-white/20 p-1.5 transition hover:bg-[var(--surface-lowest)]/10"
                                        aria-label="Download image"
                                    >
                                        <Download className="h-4 w-4" />
                                    </a>
                                )}

                                <button
                                    type="button"
                                    onClick={() => {
                                        removeImageByIndex(viewer.index)
                                        setViewer((current) => {
                                            const nextSources = [...current.sources]
                                            nextSources.splice(current.index, 1)
                                            if (!nextSources.length) return INITIAL_VIEWER_STATE
                                            return {
                                                ...current,
                                                sources: nextSources,
                                                index: Math.max(
                                                    0,
                                                    Math.min(current.index, nextSources.length - 1)
                                                ),
                                                zoom: 1,
                                            }
                                        })
                                    }}
                                    className="rounded-md border border-white/20 p-1.5 text-rose-300 transition hover:bg-rose-500/20"
                                    aria-label="Remove image from note"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setViewer(INITIAL_VIEWER_STATE)}
                                    className="rounded-md border border-white/20 p-1.5 transition hover:bg-[var(--surface-lowest)]/10"
                                    aria-label="Close image viewer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="relative flex-1 overflow-auto">
                            <div className="absolute inset-0 flex items-center justify-center p-6">
                                {currentViewerSrc && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={currentViewerSrc}
                                        alt="Project note attachment"
                                        className="max-h-full max-w-full object-contain select-none"
                                        style={{
                                            transform: `scale(${viewer.zoom})`,
                                            transformOrigin: "center center",
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
