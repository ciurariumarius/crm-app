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
    Download,
    Heading1,
    Heading2,
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
                class: "max-w-[70%] h-auto rounded-lg border border-slate-200 shadow-sm my-3 cursor-zoom-in",
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
    toolbarActions?: React.ReactNode
    className?: string
    mode?: "panel" | "document"
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
    toolbarActions,
    className,
    mode = "panel",
}: RichTextEditorProps) {
    const [isFocused, setIsFocused] = React.useState(false)
    const [uploadState, setUploadState] = React.useState<UploadState | null>(null)
    const [viewer, setViewer] = React.useState<ImageViewerState>(INITIAL_VIEWER_STATE)
    const [imageSources, setImageSources] = React.useState<string[]>([])
    const editorRef = React.useRef<TiptapEditor | null>(null)
    const lastEditorHtmlRef = React.useRef(value)

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
                class:
                    "prose prose-sm focus:outline-none min-h-[150px] max-w-none [&_img]:max-w-[70%] [&_img]:h-auto [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200 [&_img]:shadow-sm [&_img]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-slate-200 [&_table]:rounded-lg [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm",
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
        },
        onFocus: () => setIsFocused(true),
        onBlur: () => setIsFocused(false),
        immediatelyRender: false,
    })

    React.useEffect(() => {
        editorRef.current = editor
        if (editor) {
            syncImageSources(extractImageSources(editor))
        }
    }, [editor])

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

    if (!editor) {
        return null
    }

    const currentViewerSrc = viewer.sources[viewer.index] || ""
    const showToolbar = toolbarVisibility === "always" || isFocused

    return (
        <>
            <div
                className={cn(
                    "flex flex-col overflow-hidden rounded-xl transition-colors",
                    variant === "default" &&
                        "border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring",
                    variant === "plain" &&
                        mode === "panel" &&
                        "border border-slate-200 bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_8px_24px_-20px_rgba(15,23,42,0.35)]",
                    variant === "plain" &&
                        mode === "document" &&
                        "border border-transparent bg-transparent shadow-none",
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
                            "flex items-center gap-1 p-1.5",
                            variant === "default" && "border-b bg-muted/20",
                            variant === "plain" &&
                                mode === "panel" &&
                                "border-b border-slate-200 bg-white/95",
                            variant === "plain" &&
                                mode === "document" &&
                                "mx-auto mb-4 w-full max-w-4xl rounded-xl border border-slate-200/80 bg-white/92 p-2 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.45)] backdrop-blur-sm"
                        )}
                    >
                        <Toggle
                            size="sm"
                            pressed={editor.isActive("heading", { level: 1 })}
                            onPressedChange={() =>
                                editor.chain().focus().toggleHeading({ level: 1 }).run()
                            }
                            className="h-8 px-3 text-xs font-semibold"
                            aria-label="Heading 1"
                        >
                            <Heading1 className="mr-1 h-3.5 w-3.5" />
                            H1
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive("heading", { level: 2 })}
                            onPressedChange={() =>
                                editor.chain().focus().toggleHeading({ level: 2 }).run()
                            }
                            className="h-8 px-3 text-xs font-semibold"
                            aria-label="Heading 2"
                        >
                            <Heading2 className="mr-1 h-3.5 w-3.5" />
                            H2
                        </Toggle>
                        <div className="mx-1 h-4 w-px bg-border/50" />
                        <Toggle
                            size="sm"
                            pressed={editor.isActive("bold")}
                            onPressedChange={() => editor.chain().focus().toggleBold().run()}
                            className="h-8 w-8 p-0"
                            aria-label="Bold"
                        >
                            <Bold className="h-4 w-4" />
                        </Toggle>
                        <Toggle
                            size="sm"
                            pressed={editor.isActive("bulletList")}
                            onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                            className="h-8 w-8 p-0"
                            aria-label="Bullet list"
                        >
                            <List className="h-4 w-4" />
                        </Toggle>
                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                                    .run()
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                            aria-label="Insert table"
                            title="Insert table"
                        >
                            <TableIcon className="h-4 w-4" />
                        </button>
                        {toolbarActions && (
                            <div className="ml-auto flex items-center gap-1">
                                {toolbarActions}
                            </div>
                        )}
                    </div>
                )}

                {editor && (
                    <BubbleMenu
                        editor={editor}
                        shouldShow={({ editor: currentEditor }: { editor: TiptapEditor }) =>
                            currentEditor.isActive("table")
                        }
                    >
                        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md">
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnBefore().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                            >
                                + Col
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnAfter().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                            >
                                Col +
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowBefore().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                            >
                                + Row
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowAfter().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
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
                        </div>
                    </BubbleMenu>
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
                    className={cn(
                        "min-h-[150px] flex-1 overflow-y-auto p-4",
                        variant === "plain" && mode === "panel" && "bg-white p-5",
                        variant === "plain" && mode === "document" && "bg-transparent px-0 py-2",
                        minHeightClassName
                    )}
                >
                    <div className={cn(mode === "document" && "mx-auto w-full max-w-4xl px-6 pb-8")}>
                        <EditorContent editor={editor} />
                    </div>
                </div>

                {imageSources.length > 0 && (
                    <div
                        className={cn(
                            "border-t border-slate-200/80 bg-slate-50/70 px-4 py-3",
                            mode === "document" &&
                                "border-slate-200/70 bg-transparent px-0 py-3"
                        )}
                    >
                        <div
                            className={cn(
                                mode === "document" && "mx-auto w-full max-w-4xl px-6"
                            )}
                        >
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                                Screenshot Gallery ({imageSources.length})
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {imageSources.map((src, index) => (
                                    <button
                                        key={`${src}-${index}`}
                                        type="button"
                                        onClick={() => openImageViewerAtIndex(index)}
                                        className="group relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-blue-300"
                                        title={`Open screenshot ${index + 1}`}
                                        aria-label={`Open screenshot ${index + 1}`}
                                    >
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
                                    className="rounded-md border border-white/20 p-1.5 transition hover:bg-white/10"
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
                                    className="rounded-md border border-white/20 p-1.5 transition hover:bg-white/10"
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
                                    className="rounded-md border border-white/20 p-1.5 transition hover:bg-white/10"
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
                                    className="rounded-md border border-white/20 p-1.5 transition hover:bg-white/10"
                                    aria-label="Zoom in"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>

                                {currentViewerSrc && (
                                    <a
                                        href={currentViewerSrc}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-md border border-white/20 p-1.5 transition hover:bg-white/10"
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
                                    className="rounded-md border border-white/20 p-1.5 transition hover:bg-white/10"
                                    aria-label="Close image viewer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="relative flex-1 overflow-auto">
                            <div className="absolute inset-0 flex items-center justify-center p-6">
                                {currentViewerSrc && (
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
