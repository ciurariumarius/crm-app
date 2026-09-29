"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { mergeAttributes, Node } from "@tiptap/core"
import type { Editor as TiptapEditor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    ArrowLeft,
    ArrowRight,
    Bold,
    Check,
    Code2,
    Copy,
    Download,
    ExternalLink,
    Eye,
    FileText,
    ImagePlus,
    Italic,
    Link2,
    List,
    ListChecks,
    Maximize2,
    Table as TableIcon,
    Minus,
    MoreHorizontal,
    Paperclip,
    Plus,
    Trash2,
    UploadCloud,
    X,
} from "lucide-react"
import { Toggle } from "@/components/ui/toggle"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { normalizeRichTextLink } from "@/lib/notes/content"

const MAX_UPLOAD_FILE_BYTES = 25 * 1024 * 1024

function formatFileSize(bytes: number) {
    if (!bytes || Number.isNaN(bytes)) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function cleanAttachmentTitle(name: string | null | undefined): string {
    if (!name) return "Attachment"
    return (
        name
            .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uD800-\uDFFF\uFFFD\u25A0-\u25FF\u2300-\u23FF📄📝📊📎📦📁]+\s*/gu, "")
            .replace(/^[📄📝📊📎📦📁\uFFFD\u25A1\u25A0\u2388\u2327\u232B\u25AF\u25AE\uFFFE\u{1F4C4}\u{1F4DD}\u{1F4CA}\u{1F4CE}]+\s*/giu, "")
            .replace(/\s*\(\s*\d+(?:\.\d+)?\s*(?:B|KB|MB|GB)\s*\)$/i, "")
            .trim() || "Attachment"
    )
}

const FILE_ICONS_SVG_DATA: Record<string, string> = {
    pdf: `data:image/svg+xml;utf8,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h2a1.5 1.5 0 0 0 0-3H9v6"/></svg>'
    )}`,
    doc: `data:image/svg+xml;utf8,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>'
    )}`,
    sheet: `data:image/svg+xml;utf8,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="12" y1="9" x2="12" y2="21"/></svg>'
    )}`,
    image: `data:image/svg+xml;utf8,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
    )}`,
    zip: `data:image/svg+xml;utf8,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>'
    )}`,
    file: `data:image/svg+xml;utf8,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
    )}`,
}

function renderFileIconSpec(extension: string) {
    const ext = String(extension || "file").toLowerCase()
    if (ext === "pdf") {
        return [
            "div",
            {
                class:
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 shadow-2xs pointer-events-none select-none",
            },
            [
                "img",
                {
                    src: FILE_ICONS_SVG_DATA.pdf,
                    class: "h-5 w-5 pointer-events-none select-none",
                    alt: "PDF",
                    draggable: "false",
                },
            ],
        ]
    }
    if (["doc", "docx", "txt", "rtf", "md"].includes(ext)) {
        return [
            "div",
            {
                class:
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 shadow-2xs pointer-events-none select-none",
            },
            [
                "img",
                {
                    src: FILE_ICONS_SVG_DATA.doc,
                    class: "h-5 w-5 pointer-events-none select-none",
                    alt: "Document",
                    draggable: "false",
                },
            ],
        ]
    }
    if (["xls", "xlsx", "csv"].includes(ext)) {
        return [
            "div",
            {
                class:
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 shadow-2xs pointer-events-none select-none",
            },
            [
                "img",
                {
                    src: FILE_ICONS_SVG_DATA.sheet,
                    class: "h-5 w-5 pointer-events-none select-none",
                    alt: "Spreadsheet",
                    draggable: "false",
                },
            ],
        ]
    }
    if (["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"].includes(ext)) {
        return [
            "div",
            {
                class:
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 shadow-2xs pointer-events-none select-none",
            },
            [
                "img",
                {
                    src: FILE_ICONS_SVG_DATA.image,
                    class: "h-5 w-5 pointer-events-none select-none",
                    alt: "Image",
                    draggable: "false",
                },
            ],
        ]
    }
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
        return [
            "div",
            {
                class:
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 shadow-2xs pointer-events-none select-none",
            },
            [
                "img",
                {
                    src: FILE_ICONS_SVG_DATA.zip,
                    class: "h-5 w-5 pointer-events-none select-none",
                    alt: "Archive",
                    draggable: "false",
                },
            ],
        ]
    }
    return [
        "div",
        {
            class:
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-low)] border border-[var(--line-subtle)] text-[var(--text-secondary)] shadow-2xs pointer-events-none select-none",
        },
        [
            "img",
            {
                src: FILE_ICONS_SVG_DATA.file,
                class: "h-5 w-5 pointer-events-none select-none",
                alt: "File",
                draggable: "false",
            },
        ],
    ]
}

function upgradeLegacyAttachmentLinks(html: string): string {
    if (!html) return ""
    if (
        !html.includes("/api/project-notes/file") &&
        !html.includes(".pdf") &&
        !html.includes(".doc") &&
        !html.includes(".xls") &&
        !html.includes(".zip")
    ) {
        return html
    }
    return html.replace(
        /<p[^>]*>(?:\s*<strong[^>]*>)?\s*<a\s+[^>]*href=["']([^"']*(?:\/api\/project-notes\/file|\.pdf|\.docx?|\.xlsx?|\.zip)[^"']*)["'][^>]*>(?:<strong[^>]*>)?(?:[^\w\s<]*\s*)?([^<]+?)(?:\s*\(([^)]+)\))?(?:<\/strong>)?<\/a>\s*(?:<\/strong>)?\s*<\/p>/gi,
        (_, href, name, size) => {
            const cleanName = cleanAttachmentTitle(name)
            const ext = cleanName.split(".").pop()?.toLowerCase() || "file"
            const sizeFormatted = (size || "").trim()
            return `<div data-type="file-attachment" data-src="${href}" data-name="${cleanName}" data-size="${sizeFormatted}" data-extension="${ext}"></div>`
        }
    )
}

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
            width: {
                default: null,
                parseHTML: (element) => element.getAttribute("width") || element.style.width || null,
                renderHTML: (attributes) => {
                    if (!attributes.width) return {}
                    return {
                        width: attributes.width,
                        style: `width: ${attributes.width}; max-width: 100%;`,
                    }
                },
            },
            alignment: {
                default: "left",
                parseHTML: (element) =>
                    element.getAttribute("data-alignment") ||
                    (element.style.marginLeft === "auto" && element.style.marginRight === "auto"
                        ? "center"
                        : element.style.marginLeft === "auto"
                        ? "right"
                        : "left"),
                renderHTML: (attributes) => {
                    if (!attributes.alignment || attributes.alignment === "left") return {}
                    return {
                        "data-alignment": attributes.alignment,
                    }
                },
            },
        }
    },
    parseHTML() {
        return [{ tag: "img[src]" }]
    },
    renderHTML({ HTMLAttributes }) {
        const alignment = HTMLAttributes["data-alignment"] || "left"
        const alignClass =
            alignment === "center"
                ? "mx-auto block"
                : alignment === "right"
                ? "ml-auto block"
                : "mr-auto block"
        return [
            "img",
            mergeAttributes(HTMLAttributes, {
                class: cn(
                    "h-auto rounded-lg border border-[var(--line-subtle)] shadow-sm my-3 cursor-pointer transition-all",
                    alignClass
                ),
            }),
        ]
    },
})

const FileAttachment = Node.create({
    name: "fileAttachment",
    group: "block",
    draggable: true,
    selectable: true,
    atom: true,
    addAttributes() {
        return {
            src: { default: "" },
            name: { default: "Attachment" },
            size: { default: "" },
            extension: { default: "file" },
            mimeType: { default: "" },
        }
    },
    parseHTML() {
        return [
            {
                tag: 'div[data-type="file-attachment"]',
                getAttrs: (element) => {
                    const el = element as HTMLElement
                    const rawName = el.getAttribute("data-name") || "Attachment"
                    const cleanName = cleanAttachmentTitle(rawName)
                    const ext = (
                        el.getAttribute("data-extension") ||
                        cleanName.split(".").pop() ||
                        ""
                    ).toLowerCase()
                    return {
                        src: el.getAttribute("data-src") || el.getAttribute("href") || "",
                        name: cleanName,
                        size: el.getAttribute("data-size") || "",
                        extension: ext,
                        mimeType: el.getAttribute("data-mime") || "",
                    }
                },
            },
            {
                tag: 'a[href*="/api/project-notes/file"]',
                getAttrs: (element) => {
                    const el = element as HTMLElement
                    const href = el.getAttribute("href") || ""
                    const text = el.textContent || ""
                    const sizeMatch = text.match(/\(([^)]+)\)$/)
                    const size = sizeMatch ? sizeMatch[1] : ""
                    const cleanName = cleanAttachmentTitle(text)
                    const ext = cleanName.split(".").pop()?.toLowerCase() || "file"
                    return {
                        src: href,
                        name: cleanName,
                        size: size || "",
                        extension: ext,
                        mimeType: "",
                    }
                },
            },
        ]
    },
    renderHTML({ HTMLAttributes }) {
        const cleanName = cleanAttachmentTitle(HTMLAttributes.name)
        const ext = String(
            HTMLAttributes.extension || cleanName.split(".").pop() || "file"
        ).toLowerCase()
        const isPdf = ext === "pdf"
        const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"].includes(ext)
        const isDoc = ["doc", "docx", "txt", "rtf", "md"].includes(ext)
        const isSheet = ["xls", "xlsx", "csv"].includes(ext)
        const isZip = ["zip", "rar", "7z", "tar", "gz"].includes(ext)
        const typeLabel = isPdf
            ? "PDF Document"
            : isImage
            ? "Image"
            : isDoc
            ? "Document"
            : isSheet
            ? "Spreadsheet"
            : isZip
            ? "Archive"
            : "File"

        return [
            "div",
            mergeAttributes(HTMLAttributes, {
                "data-type": "file-attachment",
                "data-src": HTMLAttributes.src,
                "data-name": cleanName,
                "data-size": HTMLAttributes.size,
                "data-extension": ext,
                "data-mime": HTMLAttributes.mimeType || "",
                class:
                    "note-file-card not-prose my-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-2xs transition-all hover:bg-[var(--surface-low)] hover:border-[var(--line-strong)] max-w-md select-none group cursor-pointer no-underline",
            }),
            [
                "div",
                { class: "flex items-center gap-3 min-w-0 flex-1 pointer-events-none" },
                renderFileIconSpec(ext),
                [
                    "div",
                    { class: "min-w-0 flex-1" },
                    [
                        "div",
                        {
                            class:
                                "truncate text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors",
                            title: cleanName,
                        },
                        cleanName,
                    ],
                    [
                        "div",
                        { class: "flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-0.5" },
                        `${typeLabel}${HTMLAttributes.size ? ` • ${HTMLAttributes.size}` : ""}`,
                    ],
                ],
            ],
            [
                "div",
                { class: "flex items-center gap-1 shrink-0" },
                isPdf || isImage
                    ? [
                          "button",
                          {
                              type: "button",
                              "data-preview-file": "true",
                              "data-file-src": HTMLAttributes.src,
                              "data-file-name": HTMLAttributes.name,
                              "data-file-size": HTMLAttributes.size,
                              "data-file-type": isImage ? "image" : "pdf",
                              class:
                                  "inline-flex h-8 px-2.5 items-center justify-center gap-1 rounded-lg text-xs font-semibold bg-[var(--surface-low)] text-[var(--text-secondary)] hover:bg-[var(--surface-lowest)] hover:text-[var(--text-primary)] border border-[var(--line-subtle)] transition-colors no-underline cursor-pointer",
                              title: isImage ? "Preview Image" : "Preview PDF",
                          },
                          "Preview",
                      ]
                    : [
                          "a",
                          {
                              href: HTMLAttributes.src,
                              target: "_blank",
                              rel: "noopener noreferrer nofollow",
                              class:
                                  "inline-flex h-8 px-2.5 items-center justify-center gap-1 rounded-lg text-xs font-semibold bg-[var(--surface-low)] text-[var(--text-secondary)] hover:bg-[var(--surface-lowest)] hover:text-[var(--text-primary)] border border-[var(--line-subtle)] transition-colors no-underline",
                              title: "Open file",
                          },
                          "Open",
                      ],
                [
                    "a",
                    {
                        href: HTMLAttributes.src,
                        download: HTMLAttributes.name,
                        class:
                            "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-lowest)] hover:text-[var(--text-primary)] border border-[var(--line-subtle)] transition-colors no-underline",
                        title: "Download",
                    },
                    "↓",
                ],
            ],
        ]
    },
})

const FolderMention = Node.create({
    name: "folderMention",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
        return {
            folderId: { default: null },
            label: { default: "" },
        }
    },
    parseHTML() {
        return [{
            tag: "span[data-note-folder-id]",
            getAttrs: (element) => ({
                folderId: (element as HTMLElement).dataset.noteFolderId || null,
                label: (element as HTMLElement).dataset.noteFolderLabel || (element as HTMLElement).textContent?.replace(/^#/, "") || "",
            }),
        }]
    },
    renderHTML({ HTMLAttributes }) {
        const label = String(HTMLAttributes.label || "Folder")
        return [
            "span",
            mergeAttributes({
                "data-note-folder-id": HTMLAttributes.folderId,
                "data-note-folder-label": label,
                "aria-label": `Folder ${label}`,
                class: "inline-flex rounded-full bg-[var(--state-info-surface)] px-2 py-0.5 text-[0.88em] font-semibold text-[var(--info)]",
            }),
            `#${label}`,
        ]
    },
})

export type RichTextFolderOption = {
    id: string | null
    name: string
}

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
    documentPadding?: "default" | "compact" | "none"
    readOnly?: boolean
    imageUploadFallback?: "data-url" | "error"
    imageUploadsDisabled?: boolean
    showImageGallery?: boolean
    folderOptions?: RichTextFolderOption[]
    onFolderMentionChange?: (folderId: string | null, html: string) => void
    externalUpdateToken?: number
    onBlur?: () => void
}

type FolderSuggestionState = {
    from: number
    to: number
    query: string
    selectedIndex: number
    left: number
    top: number
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
        } else if (node.type.name === "fileAttachment" && node.attrs?.src) {
            const ext = String(node.attrs.extension || "").toLowerCase()
            const isImg =
                ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"].includes(ext) ||
                String(node.attrs.src).startsWith("data:image/")
            if (isImg) {
                sources.push(String(node.attrs.src))
            }
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
    documentPadding = "default",
    readOnly = false,
    imageUploadFallback = "data-url",
    imageUploadsDisabled = false,
    showImageGallery = true,
    folderOptions = [],
    onFolderMentionChange,
    externalUpdateToken,
    onBlur,
}: RichTextEditorProps) {
    const [isFocused, setIsFocused] = React.useState(false)
    const [uploadState, setUploadState] = React.useState<UploadState | null>(null)
    const [viewer, setViewer] = React.useState<ImageViewerState>(INITIAL_VIEWER_STATE)
    const [pdfPreviewState, setPdfPreviewState] = React.useState<{
        src: string
        name: string
        size?: string
    } | null>(null)
    const [imageSources, setImageSources] = React.useState<string[]>([])
    const [codeCopyState, setCodeCopyState] = React.useState<"idle" | "copied" | "error">("idle")
    const [folderSuggestion, setFolderSuggestion] = React.useState<FolderSuggestionState | null>(null)
    const [isDraggingOver, setIsDraggingOver] = React.useState(false)
    const dragDepthRef = React.useRef(0)
    const editorRef = React.useRef<TiptapEditor | null>(null)
    const editorViewportRef = React.useRef<HTMLDivElement | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement | null>(null)
    const lastEditorHtmlRef = React.useRef(value)
    const [codeCopyAnchor, setCodeCopyAnchor] = React.useState<{ top: number; left: number } | null>(null)
    const [activeCodeBlockElement, setActiveCodeBlockElement] = React.useState<HTMLElement | null>(null)
    const lastFocusTokenRef = React.useRef<string | number | undefined>(undefined)
    const lastExternalUpdateTokenRef = React.useRef<number | undefined>(externalUpdateToken)
    const folderSuggestionRef = React.useRef<FolderSuggestionState | null>(null)

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
        if (showImageGallery) syncImageSources(extractImageSources(editor))
    }, [showImageGallery, syncImageSources])

    const insertFileAttachment = React.useCallback(
        (item: { url: string; name: string; size?: number; isImage?: boolean }) => {
            const editor = editorRef.current
            if (!editor || !item.url) return

            const cleanName = cleanAttachmentTitle(item.name)
            const sizeFormatted = item.size ? formatFileSize(item.size) : ""
            const ext = cleanName.split(".").pop()?.toLowerCase() || "file"
            const isImage =
                item.isImage ||
                ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"].includes(ext) ||
                item.url.startsWith("data:image/")

            if (isImage) {
                editor
                    .chain()
                    .focus()
                    .insertContent([
                        {
                            type: "image",
                            attrs: {
                                src: item.url,
                                alt: cleanName || "Image",
                                title: cleanName,
                                width: "100%",
                                alignment: "left",
                            },
                        },
                        {
                            type: "paragraph",
                        },
                    ])
                    .run()
                syncImageSources(extractImageSources(editor))
                return
            }

            editor
                .chain()
                .focus()
                .insertContent([
                    {
                        type: "fileAttachment",
                        attrs: {
                            src: item.url,
                            name: cleanName,
                            size: sizeFormatted,
                            extension: ext,
                            mimeType: "",
                        },
                    },
                    {
                        type: "paragraph",
                    },
                ])
                .run()
        },
        [syncImageSources]
    )

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

    const uploadFile = React.useCallback(
        async (file: File): Promise<{ url: string; name: string; size: number; isImage: boolean }> => {
            if (file.size > MAX_UPLOAD_FILE_BYTES) {
                throw new Error(`File "${file.name || "item"}" exceeds 25MB limit.`)
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
                    const errPayload = await response.json().catch(() => null)
                    throw new Error(errPayload?.error || "Upload failed")
                }

                const payload = (await response.json()) as {
                    success?: boolean
                    urls?: string[]
                    files?: Array<{ url: string; name: string; size: number; isImage: boolean }>
                }
                if (payload.success) {
                    if (payload.files?.[0]) {
                        return payload.files[0]
                    }
                    if (payload.urls?.[0]) {
                        return {
                            url: payload.urls[0],
                            name: file.name || "Attachment",
                            size: file.size,
                            isImage: file.type.startsWith("image/"),
                        }
                    }
                }
            } catch (error) {
                if (imageUploadFallback === "error") {
                    throw error instanceof Error ? error : new Error("Upload failed")
                }
            }

            if (imageUploadFallback === "error") {
                throw new Error("Upload failed")
            }

            const isImg = file.type.startsWith("image/")
            if (isImg) {
                const dataUrl = await fileToDataUrl(file)
                return {
                    url: dataUrl,
                    name: file.name || "Screenshot",
                    size: file.size,
                    isImage: true,
                }
            }

            throw new Error("Upload failed")
        },
        [imageUploadFallback, uploadProjectId]
    )

    const uploadAndInsertFiles = React.useCallback(
        async (files: File[]) => {
            if (imageUploadsDisabled || !files.length) return
            const editor = editorRef.current
            if (editor) {
                const docText = editor.getText().trim()
                const hasExistingContent = docText.length > 0 || editor.state.doc.childCount > 1
                if (hasExistingContent) {
                    const lastChild = editor.state.doc.lastChild
                    if (lastChild && lastChild.type.name !== "horizontalRule") {
                        editor.chain().focus().setHorizontalRule().run()
                    }
                }
            }

            setUploadState({ completed: 0, total: files.length })

            try {
                for (let index = 0; index < files.length; index += 1) {
                    const file = files[index]
                    const uploaded = await uploadFile(file)
                    insertFileAttachment(uploaded)
                    setUploadState({ completed: index + 1, total: files.length })
                }

                setTimeout(() => setUploadState(null), 900)
            } catch (error) {
                setUploadState({
                    completed: 0,
                    total: files.length,
                    error: error instanceof Error ? error.message : "Failed to upload file",
                })
                setTimeout(() => setUploadState(null), 2500)
            }
        },
        [imageUploadsDisabled, insertFileAttachment, uploadFile]
    )

    const handleToolbarFileUpload = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files || [])
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
            const list = sources.includes(src)
                ? sources
                : sources.length > 0
                ? [...sources, src]
                : [src]
            const clickedIndex = list.findIndex((item) => item === src)
            setViewer({
                open: true,
                sources: list,
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

    const folderOptionsRef = React.useRef(folderOptions)
    const onFolderMentionChangeRef = React.useRef(onFolderMentionChange)
    folderOptionsRef.current = folderOptions
    onFolderMentionChangeRef.current = onFolderMentionChange

    const matchingFolderOptions = React.useCallback((query: string) => {
        const needle = query.trim().toLocaleLowerCase()
        return folderOptionsRef.current
            .filter((option) => !needle || option.name.toLocaleLowerCase().includes(needle))
            .slice(0, 8)
    }, [])

    const closeFolderSuggestion = React.useCallback(() => {
        folderSuggestionRef.current = null
        setFolderSuggestion(null)
    }, [])

    const refreshFolderSuggestion = React.useCallback((currentEditor: TiptapEditor) => {
        if (!folderOptionsRef.current.length || !currentEditor.state.selection.empty) {
            closeFolderSuggestion()
            return
        }
        const { $from } = currentEditor.state.selection
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\n", "\n")
        const match = textBefore.match(/(?:^|\s)#([^#\n]*)$/u)
        if (!match) {
            closeFolderSuggestion()
            return
        }
        const query = match[1] || ""
        if (!matchingFolderOptions(query).length) {
            closeFolderSuggestion()
            return
        }
        const from = $from.pos - query.length - 1
        const coordinates = currentEditor.view.coordsAtPos($from.pos)
        const visualViewport = window.visualViewport
        const viewportLeft = visualViewport?.offsetLeft ?? 0
        const viewportTop = visualViewport?.offsetTop ?? 0
        const viewportWidth = visualViewport?.width ?? window.innerWidth
        const viewportHeight = visualViewport?.height ?? window.innerHeight
        const next: FolderSuggestionState = {
            from,
            to: $from.pos,
            query,
            selectedIndex: Math.min(
                folderSuggestionRef.current?.selectedIndex ?? 0,
                Math.max(0, matchingFolderOptions(query).length - 1)
            ),
            left: Math.max(viewportLeft + 12, Math.min(coordinates.left, viewportLeft + viewportWidth - 268)),
            top: Math.max(viewportTop + 12, Math.min(coordinates.bottom + 8, viewportTop + viewportHeight - 280)),
        }
        folderSuggestionRef.current = next
        setFolderSuggestion(next)
    }, [closeFolderSuggestion, matchingFolderOptions])

    const applyFolderSuggestion = React.useCallback((optionIndex?: number) => {
        const currentEditor = editorRef.current
        const suggestion = folderSuggestionRef.current
        if (!currentEditor || !suggestion) return false
        const options = matchingFolderOptions(suggestion.query)
        const option = options[optionIndex ?? suggestion.selectedIndex]
        if (!option) return false

        const transaction = currentEditor.state.tr
        const existingMentions: Array<{ from: number; to: number }> = []
        currentEditor.state.doc.descendants((node, position) => {
            if (node.type.name === "folderMention") {
                existingMentions.push({ from: position, to: position + node.nodeSize })
            }
            return true
        })
        for (const range of existingMentions.sort((a, b) => b.from - a.from)) {
            transaction.delete(range.from, range.to)
        }
        const from = transaction.mapping.map(suggestion.from)
        const to = transaction.mapping.map(suggestion.to)
        transaction.delete(from, to)
        if (option.id) {
            const mention = currentEditor.schema.nodes.folderMention?.create({
                folderId: option.id,
                label: option.name,
            })
            if (mention) transaction.insert(from, [mention, currentEditor.schema.text(" ")])
        }
        currentEditor.view.dispatch(transaction)
        currentEditor.view.focus()
        closeFolderSuggestion()
        const html = currentEditor.getHTML()
        lastEditorHtmlRef.current = html
        onFolderMentionChangeRef.current?.(option.id, html)
        return true
    }, [closeFolderSuggestion, matchingFolderOptions])

    const notesFirstLineClass = notesMode
        ? notesAppearance === "apple"
            ? "[&>*:first-child]:mt-0 [&>*:first-child]:mb-1 [&>*:first-child]:text-[1.45rem] [&>*:first-child]:font-semibold [&>*:first-child]:tracking-[-0.02em] [&>*:first-child]:leading-[1.2] [&>*:first-child]:text-[var(--text-primary)] md:[&>*:first-child]:text-[1.62rem]"
            : "[&>*:first-child]:mt-0 [&>*:first-child]:mb-0.5 [&>*:first-child]:text-[1.08rem] [&>*:first-child]:font-medium [&>*:first-child]:tracking-[-0.01em] [&>*:first-child]:leading-[1.34] [&>*:first-child]:text-[var(--text-primary)] md:[&>*:first-child]:text-[1.15rem]"
        : ""

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                link: {
                    openOnClick: false,
                    autolink: true,
                    defaultProtocol: "https",
                    HTMLAttributes: {
                        rel: "noopener noreferrer nofollow",
                        target: "_blank",
                    },
                },
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            ScreenshotImage,
            FileAttachment,
            FolderMention,
            Placeholder.configure({
                placeholder: placeholder !== undefined ? placeholder : (notesMode ? "" : "Start writing..."),
                emptyEditorClass:
                    "is-editor-empty before:content-[attr(data-placeholder)] before:text-muted-foreground before:float-left before:pointer-events-none before:h-0",
            }),
        ],
        editable: !readOnly,
        content: upgradeLegacyAttachmentLinks(value),
        editorProps: {
            attributes: {
                role: "textbox",
                "aria-label": "Note content",
                "aria-multiline": "true",
                inputmode: "text",
                autocorrect: "off",
                autocapitalize: "sentences",
                spellcheck: "false",
                autocomplete: "off",
                enterkeyhint: "enter",
                class: cn(
                    "prose prose-sm focus:outline-none min-h-[150px] max-w-none [&_a]:no-underline [&_hr]:my-4 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[var(--line-subtle)] [&_.note-file-card]:no-underline [&_.note-file-card_*]:no-underline [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:border [&_img]:border-[var(--line-subtle)] [&_img]:shadow-sm [&_img]:my-3 [&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-[var(--brand-primary)] [&_img.ProseMirror-selectednode]:ring-offset-2 [&_h1]:text-[1.5rem] [&_h1]:font-bold [&_h1]:tracking-[-0.02em] [&_h1]:leading-tight [&_h1]:mt-5 [&_h1]:mb-2 [&_h2]:text-[1.2rem] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:leading-tight [&_h2]:mt-4 [&_h2]:mb-2 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-1 [&_pre]:relative [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[var(--line-subtle)] [&_pre]:bg-[var(--surface-low)] [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-[var(--text-primary)] [&_pre]:shadow-[inset_0_1px_0_color-mix(in_srgb,var(--surface-lowest)_70%,transparent)] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-mono [&_pre_code]:text-xs [&_pre_code]:leading-6 [&_code]:rounded [&_code]:bg-[var(--surface-low)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-[var(--text-secondary)] [&_.tableWrapper]:max-w-full [&_.tableWrapper]:overflow-x-auto [&_table]:min-w-[520px] [&_table]:border-collapse [&_table]:border [&_table]:border-[var(--line-subtle)] [&_table]:rounded-lg [&_th]:border [&_th]:border-[var(--line-subtle)] [&_th]:bg-[var(--surface-low)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:border [&_td]:border-[var(--line-subtle)] [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm",
                    "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li]:gap-2 [&_ul[data-type=taskList]_li>label]:mt-1 [&_ul[data-type=taskList]_li>div]:min-w-0 [&_ul[data-type=taskList]_input]:accent-[var(--brand-primary)]",
                    mode === "document" && "min-h-full",
                    notesMode && "text-[17px] leading-[1.65] [&_p]:my-[0.7em]",
                    notesFirstLineClass
                ),
            },
            handleKeyDown(_, event) {
                const suggestion = folderSuggestionRef.current
                if (suggestion) {
                    const options = matchingFolderOptions(suggestion.query)
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault()
                        const direction = event.key === "ArrowDown" ? 1 : -1
                        const next = {
                            ...suggestion,
                            selectedIndex:
                                (suggestion.selectedIndex + direction + options.length) % options.length,
                        }
                        folderSuggestionRef.current = next
                        setFolderSuggestion(next)
                        return true
                    }
                    if (event.key === "Enter") {
                        event.preventDefault()
                        return applyFolderSuggestion()
                    }
                    if (event.key === "Escape") {
                        event.preventDefault()
                        closeFolderSuggestion()
                        return true
                    }
                }
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
                if (readOnly || imageUploadsDisabled) return false
                const files = Array.from(event.clipboardData?.files || [])
                if (!files.length) return false
                void uploadAndInsertFiles(files)
                event.preventDefault()
                return true
            },
            handleDrop(view, event) {
                dragDepthRef.current = 0
                setIsDraggingOver(false)
                if (readOnly || imageUploadsDisabled) return false
                const files = Array.from(event.dataTransfer?.files || [])
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
            handleDoubleClick(_, __, event) {
                const target = event.target as HTMLElement
                if (target?.tagName === "IMG") {
                    const src = (target as HTMLImageElement).src
                    if (src) {
                        openImageViewer(src)
                        return true
                    }
                }
                return false
            },
            handleDOMEvents: {
                click(_, event) {
                    const target = event.target as HTMLElement | null
                    const previewBtn = target?.closest('[data-preview-file="true"]') as HTMLElement | null
                    if (previewBtn) {
                        event.preventDefault()
                        event.stopPropagation()
                        const src =
                            previewBtn.getAttribute("data-file-src") || previewBtn.getAttribute("href") || ""
                        const name = cleanAttachmentTitle(
                            previewBtn.getAttribute("data-file-name") || "Document.pdf"
                        )
                        const size = previewBtn.getAttribute("data-file-size") || ""
                        const fileType = previewBtn.getAttribute("data-file-type") || ""
                        const ext = (name.split(".").pop() || "").toLowerCase()
                        const isImg =
                            fileType === "image" ||
                            ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"].includes(ext) ||
                            src.startsWith("data:image/")

                        if (src) {
                            if (isImg) {
                                openImageViewer(src)
                            } else {
                                setPdfPreviewState({ src, name, size })
                            }
                            return true
                        }
                    }
                    const fileCard = target?.closest('[data-type="file-attachment"]') as HTMLElement | null
                    if (fileCard && !target?.closest("a[download], [data-download-file]")) {
                        const src = fileCard.getAttribute("data-src") || ""
                        const name = cleanAttachmentTitle(
                            fileCard.getAttribute("data-name") || "Document"
                        )
                        const size = fileCard.getAttribute("data-size") || ""
                        const ext = (
                            fileCard.getAttribute("data-extension") ||
                            name.split(".").pop() ||
                            ""
                        ).toLowerCase()
                        const isImg =
                            ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"].includes(ext) ||
                            src.startsWith("data:image/")

                        if (isImg && src) {
                            event.preventDefault()
                            event.stopPropagation()
                            openImageViewer(src)
                            return true
                        }
                        if ((ext === "pdf" || src.includes(".pdf")) && src) {
                            event.preventDefault()
                            event.stopPropagation()
                            setPdfPreviewState({ src, name, size })
                            return true
                        }
                    }
                    const legacyPdfLink = target?.closest(
                        'a[href*=".pdf"], a[href*="/api/project-notes/file"]'
                    ) as HTMLAnchorElement | null
                    if (legacyPdfLink && !legacyPdfLink.hasAttribute("download")) {
                        const href = legacyPdfLink.getAttribute("href") || ""
                        const isPdf =
                            href.toLowerCase().includes(".pdf") ||
                            legacyPdfLink.textContent?.toLowerCase().includes(".pdf")
                        if (isPdf) {
                            event.preventDefault()
                            event.stopPropagation()
                            setPdfPreviewState({
                                src: href,
                                name: cleanAttachmentTitle(legacyPdfLink.textContent || "PDF Document"),
                                size: "",
                            })
                            return true
                        }
                    }
                    return false
                },
            },
            handleClick(_, __, event) {
                const target = event.target as HTMLElement
                if (target?.tagName === "IMG") {
                    return false
                }
                const previewBtn = target?.closest('[data-preview-file="true"]') as HTMLElement | null
                if (previewBtn) {
                    event.preventDefault()
                    event.stopPropagation()
                    const src =
                        previewBtn.getAttribute("data-file-src") || previewBtn.getAttribute("href") || ""
                    const name = cleanAttachmentTitle(
                        previewBtn.getAttribute("data-file-name") || "Document.pdf"
                    )
                    const size = previewBtn.getAttribute("data-file-size") || ""
                    const fileType = previewBtn.getAttribute("data-file-type") || ""
                    const ext = (name.split(".").pop() || "").toLowerCase()
                    const isImg =
                        fileType === "image" ||
                        ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"].includes(ext) ||
                        src.startsWith("data:image/")

                    if (src) {
                        if (isImg) {
                            openImageViewer(src)
                        } else {
                            setPdfPreviewState({ src, name, size })
                        }
                        return true
                    }
                }
                const fileCard = target?.closest('[data-type="file-attachment"]') as HTMLElement | null
                if (fileCard && !target.closest("a[download], [data-download-file]")) {
                    const src = fileCard.getAttribute("data-src") || ""
                    const name = cleanAttachmentTitle(
                        fileCard.getAttribute("data-name") || "Document"
                    )
                    const size = fileCard.getAttribute("data-size") || ""
                    const ext = (
                        fileCard.getAttribute("data-extension") ||
                        name.split(".").pop() ||
                        ""
                    ).toLowerCase()
                    const isImg =
                        ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"].includes(ext) ||
                        src.startsWith("data:image/")

                    if (isImg && src) {
                        event.preventDefault()
                        event.stopPropagation()
                        openImageViewer(src)
                        return true
                    }
                    if ((ext === "pdf" || src.includes(".pdf")) && src) {
                        event.preventDefault()
                        event.stopPropagation()
                        setPdfPreviewState({ src, name, size })
                        return true
                    }
                }
                const legacyPdfLink = target?.closest(
                    'a[href*=".pdf"], a[href*="/api/project-notes/file"]'
                ) as HTMLAnchorElement | null
                if (legacyPdfLink && !legacyPdfLink.hasAttribute("download")) {
                    const href = legacyPdfLink.getAttribute("href") || ""
                    const isPdf =
                        href.toLowerCase().includes(".pdf") ||
                        legacyPdfLink.textContent?.toLowerCase().includes(".pdf")
                    if (isPdf) {
                        event.preventDefault()
                        event.stopPropagation()
                        setPdfPreviewState({
                            src: href,
                            name: cleanAttachmentTitle(legacyPdfLink.textContent || "PDF Document"),
                            size: "",
                        })
                        return true
                    }
                }
                return false
            },
        },
        onUpdate: ({ editor: currentEditor }) => {
            const html = currentEditor.getHTML()
            lastEditorHtmlRef.current = html
            onChange(html)
            refreshFolderSuggestion(currentEditor)
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
            closeFolderSuggestion()
            setCodeCopyAnchor(null)
            setActiveCodeBlockElement(null)
            onBlur?.()
        },
        immediatelyRender: false,
    })

    React.useEffect(() => {
        editorRef.current = editor
        if (editor) {
            if (showImageGallery) syncImageSources(extractImageSources(editor))
            updateCodeCopyAnchor(editor)
        }
    }, [editor, showImageGallery, syncImageSources, updateCodeCopyAnchor])

    React.useEffect(() => {
        if (!editor) return
        editor.setEditable(!readOnly)
    }, [editor, readOnly])

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
        const sanitizedValue = value
        if (sanitizedValue === editor.getHTML()) return
        const forceExternalUpdate = externalUpdateToken !== lastExternalUpdateTokenRef.current
        if (!forceExternalUpdate && sanitizedValue === lastEditorHtmlRef.current) return
        if (!forceExternalUpdate && editor.isFocused) return

        editor.commands.setContent(sanitizedValue, { emitUpdate: false })
        lastEditorHtmlRef.current = sanitizedValue
        lastExternalUpdateTokenRef.current = externalUpdateToken
    }, [value, editor, externalUpdateToken])

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
    const isAppleNotesAppearance = notesMode && notesAppearance === "apple"
    const resolvedToolbarPinned = isAppleNotesAppearance ? true : (notesMode ? false : toolbarPinned)
    const resolvedToolbarVisibility = isAppleNotesAppearance ? "always" : (notesMode ? "focus" : toolbarVisibility)
    const resolvedToolbarPreset = notesMode ? "minimal" : toolbarPreset
    const resolvedToolbarTone = notesMode ? "quiet" : toolbarTone
    const resolvedToolbarPlacement = isAppleNotesAppearance ? "inline" : (notesMode ? "top-right" : toolbarPlacement)
    const isToolbarPinned = resolvedToolbarPinned
    const showToolbar = !readOnly && (isAppleNotesAppearance || isToolbarPinned || resolvedToolbarVisibility === "always" || isFocused)
    const isMinimalToolbar = resolvedToolbarPreset === "minimal"
    const isCompactToolbar = isMinimalToolbar || isToolbarPinned
    const isTopRightToolbar = resolvedToolbarPlacement === "top-right"
    const isBorderlessPanel = variant === "plain" && mode === "panel" && panelStyle === "borderless"
    const isDocumentLeft = mode === "document" && documentLayout === "left"
    const isQuietToolbar = resolvedToolbarTone === "quiet"
    const isReadingWidth = mode === "document" && documentWidth === "reading"
    const compactControlClass = notesMode ? "h-9 w-9 md:h-8 md:w-8 lg:h-7 lg:w-7" : "h-8 w-8"
    const compactIconClass = notesMode ? "h-[1rem] w-[1rem] md:h-[0.94rem] md:w-[0.94rem] lg:h-[0.86rem] lg:w-[0.86rem]" : "h-4 w-4"
    const notesControlClass = notesMode
        ? isAppleNotesAppearance
            ? "rounded-full border border-transparent text-[var(--text-secondary)] data-[state=on]:border-[color:color-mix(in_srgb,var(--brand-cyan)_34%,var(--line-subtle))] data-[state=on]:bg-[color:color-mix(in_srgb,var(--brand-cyan)_13%,var(--surface-lowest))] data-[state=on]:text-[var(--primary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] focus-visible:ring-[var(--brand-cyan)]"
            : "rounded-full border border-transparent text-[var(--text-secondary)] data-[state=on]:border-[var(--line-subtle)] data-[state=on]:bg-[var(--surface-low)] data-[state=on]:text-[var(--text-primary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
        : ""

    return (
        <>
            <div
                className={cn(
                    "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl transition-colors",
                    isTopRightToolbar && "relative",
                    variant === "default" &&
                        "border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring",
                    variant === "plain" &&
                        mode === "panel" &&
                        (isBorderlessPanel
                            ? "border-0 bg-transparent shadow-none"
                            : "border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]"),
                    variant === "plain" &&
                        mode === "document" &&
                        (isAppleNotesAppearance
                            ? "border-0 bg-transparent shadow-none"
                            : "border border-transparent bg-transparent shadow-none"),
                    className
                )}
            >
                {showToolbar && !isAppleNotesAppearance && (
                    <div
                        onMouseDown={(event) => {
                            const target = event.target as HTMLElement
                            if (target.closest("input, select, textarea")) return
                            event.preventDefault()
                        }}
                        className={cn(
                            "flex items-center",
                            notesMode && "hidden md:flex",
                            isTopRightToolbar &&
                                "absolute right-2.5 top-2.5 z-30 max-w-[calc(100%-1.25rem)] rounded-full border border-[var(--line-subtle)]/70 bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)] shadow-[var(--shadow-apple)] supports-[backdrop-filter]:backdrop-blur-xl md:right-3 md:top-3",
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
                                        isReadingWidth ? "w-[calc(100%-0.5rem)] max-w-[760px]" : "w-[calc(100%-0.5rem)]",
                                        isQuietToolbar
                                            ? "border border-[var(--line-subtle)]/65 bg-[color:color-mix(in_srgb,var(--surface-lowest)_84%,var(--surface-low)_16%)] shadow-[var(--shadow-apple)]"
                                            : "border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)] shadow-[var(--shadow-apple)]"
                                    )
                                    : cn(
                                        "mx-4 md:mx-auto mt-4 mb-6 w-full md:w-[calc(100%-2rem)] max-w-4xl rounded-xl px-3 pt-2 pb-2 backdrop-blur-sm",
                                        isQuietToolbar
                                            ? "border border-[var(--line-subtle)]/65 bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]"
                                            : "border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]"
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
                        {notesMode ? (
                            <Toggle
                                size="sm"
                                pressed={editor.isActive("heading", { level: 2 })}
                                onPressedChange={(pressed) =>
                                    pressed
                                        ? editor.chain().focus().setHeading({ level: 2 }).run()
                                        : editor.chain().focus().setParagraph().run()
                                }
                                className={cn(compactControlClass, "p-0 text-xs font-semibold", notesControlClass)}
                                aria-label="Text format"
                                title="Text format"
                            >
                                Aa
                            </Toggle>
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
                        {notesMode ? (
                            <Toggle
                                size="sm"
                                pressed={editor.isActive("taskList")}
                                onPressedChange={() => editor.chain().focus().toggleTaskList().run()}
                                className={cn(compactControlClass, "p-0", notesControlClass)}
                                aria-label="Checklist"
                                title="Checklist"
                            >
                                <ListChecks className={compactIconClass} />
                            </Toggle>
                        ) : null}
                        {notesMode ? (
                            <button
                                type="button"
                                onClick={() =>
                                    editor
                                        .chain()
                                        .focus()
                                        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                                        .run()
                                }
                                className={cn(
                                    "inline-flex items-center justify-center border border-transparent transition",
                                    compactControlClass,
                                    notesControlClass
                                )}
                                aria-label="Insert table"
                                title="Insert table"
                            >
                                <TableIcon className={compactIconClass} />
                            </button>
                        ) : null}
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
                            onClick={() => fileInputRef.current?.click()}
                            disabled={imageUploadsDisabled}
                            className={cn(
                                "inline-flex items-center justify-center rounded-md border border-transparent text-[var(--text-secondary)] transition hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]",
                                compactControlClass,
                                notesMode && "rounded-full"
                            )}
                            aria-label="Add file"
                            title={imageUploadsDisabled ? "Wait for the task target to finish saving" : "Add file (PDF, images, docs)"}
                        >
                            <Paperclip className={compactIconClass} />
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
                    ref={fileInputRef}
                    type="file"
                    accept="*/*"
                    multiple
                    disabled={imageUploadsDisabled}
                    className="hidden"
                    onChange={handleToolbarFileUpload}
                />

                {editor && (
                    <BubbleMenu
                        editor={editor}
                        shouldShow={({ editor: currentEditor }: { editor: TiptapEditor }) =>
                            currentEditor.isActive("image") &&
                            !readOnly &&
                            !Boolean(resolveActiveCodeBlockElement(currentEditor))
                        }
                    >
                        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-lg backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150">
                            <span className="px-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                Size
                            </span>
                            {[
                                { label: "25%", value: "25%" },
                                { label: "50%", value: "50%" },
                                { label: "75%", value: "75%" },
                                { label: "100%", value: "100%" },
                            ].map((preset) => {
                                const currentWidth = editor.getAttributes("image")?.width
                                const isActive =
                                    currentWidth === preset.value || (!currentWidth && preset.value === "100%")
                                return (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            editor
                                                .chain()
                                                .focus()
                                                .updateAttributes("image", { width: preset.value })
                                                .run()
                                        }}
                                        className={cn(
                                            "inline-flex h-7 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors",
                                            isActive
                                                ? "bg-[var(--surface-low)] text-[var(--text-primary)] font-bold shadow-2xs"
                                                : "text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                        )}
                                    >
                                        {preset.label}
                                    </button>
                                )
                            })}

                            <div className="mx-1 h-4 w-px bg-[var(--line-subtle)]" />

                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    const currentWidth = editor.getAttributes("image")?.width || "100%"
                                    const num = Number.parseInt(currentWidth.replace("%", ""), 10) || 100
                                    const next = Math.max(15, num - 10)
                                    editor
                                        .chain()
                                        .focus()
                                        .updateAttributes("image", { width: `${next}%` })
                                        .run()
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                title="Shrink width"
                                aria-label="Shrink width"
                            >
                                <Minus className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    const currentWidth = editor.getAttributes("image")?.width || "100%"
                                    const num = Number.parseInt(currentWidth.replace("%", ""), 10) || 100
                                    const next = Math.min(100, num + 10)
                                    editor
                                        .chain()
                                        .focus()
                                        .updateAttributes("image", { width: `${next}%` })
                                        .run()
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                title="Enlarge width"
                                aria-label="Enlarge width"
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </button>

                            <div className="mx-1 h-4 w-px bg-[var(--line-subtle)]" />

                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() =>
                                    editor
                                        .chain()
                                        .focus()
                                        .updateAttributes("image", { alignment: "left" })
                                        .run()
                                }
                                className={cn(
                                    "inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]",
                                    (editor.getAttributes("image")?.alignment === "left" ||
                                        !editor.getAttributes("image")?.alignment) &&
                                        "bg-[var(--surface-low)] text-[var(--text-primary)] font-bold"
                                )}
                                title="Align left"
                                aria-label="Align left"
                            >
                                <AlignLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() =>
                                    editor
                                        .chain()
                                        .focus()
                                        .updateAttributes("image", { alignment: "center" })
                                        .run()
                                }
                                className={cn(
                                    "inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]",
                                    editor.getAttributes("image")?.alignment === "center" &&
                                        "bg-[var(--surface-low)] text-[var(--text-primary)] font-bold"
                                )}
                                title="Align center"
                                aria-label="Align center"
                            >
                                <AlignCenter className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() =>
                                    editor
                                        .chain()
                                        .focus()
                                        .updateAttributes("image", { alignment: "right" })
                                        .run()
                                }
                                className={cn(
                                    "inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]",
                                    editor.getAttributes("image")?.alignment === "right" &&
                                        "bg-[var(--surface-low)] text-[var(--text-primary)] font-bold"
                                )}
                                title="Align right"
                                aria-label="Align right"
                            >
                                <AlignRight className="h-3.5 w-3.5" />
                            </button>

                            <div className="mx-1 h-4 w-px bg-[var(--line-subtle)]" />

                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    const src = editor.getAttributes("image")?.src
                                    if (src) openImageViewer(src)
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                title="Preview full size"
                                aria-label="Preview full size"
                            >
                                <Maximize2 className="h-3.5 w-3.5" />
                            </button>

                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    editor.chain().focus().deleteSelection().run()
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--state-urgent)] transition-colors hover:bg-[var(--state-danger-surface)]"
                                title="Delete image"
                                aria-label="Delete image"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </BubbleMenu>
                )}

                {editor && (
                    <BubbleMenu
                        editor={editor}
                        shouldShow={({ editor: currentEditor }: { editor: TiptapEditor }) =>
                            currentEditor.isActive("fileAttachment") &&
                            !readOnly &&
                            !Boolean(resolveActiveCodeBlockElement(currentEditor))
                        }
                    >
                        <div className="flex items-center gap-1 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-lg backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150">
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    const attrs = editor.getAttributes("fileAttachment")
                                    if (attrs?.src) {
                                        const ext = (
                                            attrs.extension ||
                                            attrs.name?.split(".").pop() ||
                                            ""
                                        ).toLowerCase()
                                        if (ext === "pdf" || attrs.src.includes(".pdf")) {
                                            setPdfPreviewState({
                                                src: attrs.src,
                                                name: attrs.name,
                                                size: attrs.size,
                                            })
                                        } else {
                                            window.open(attrs.src, "_blank", "noopener,noreferrer")
                                        }
                                    }
                                }}
                                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                            >
                                <Eye className="h-3.5 w-3.5" />
                                Preview
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    const attrs = editor.getAttributes("fileAttachment")
                                    if (attrs?.src) {
                                        const a = document.createElement("a")
                                        a.href = attrs.src
                                        a.download = attrs.name || "download"
                                        a.click()
                                    }
                                }}
                                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Download
                            </button>
                            <div className="mx-1 h-4 w-px bg-[var(--line-subtle)]" />
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    editor.chain().focus().deleteSelection().run()
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--state-urgent)] transition-colors hover:bg-[var(--state-danger-surface)]"
                                title="Delete attachment"
                                aria-label="Delete attachment"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </BubbleMenu>
                )}

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
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                            >
                                + Col
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnAfter().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                            >
                                Col +
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowBefore().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                            >
                                + Row
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowAfter().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                            >
                                Row +
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteColumn().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-[var(--state-urgent)] hover:bg-[var(--state-danger-surface)]"
                            >
                                Del Col
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteRow().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-[var(--state-urgent)] hover:bg-[var(--state-danger-surface)]"
                            >
                                Del Row
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteTable().run()}
                                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-semibold text-[var(--state-urgent)] hover:bg-[var(--state-danger-surface)]"
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
                                "absolute z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-sm transition",
                                codeCopyState === "copied"
                                    ? "text-[var(--state-success)]"
                                    : codeCopyState === "error"
                                        ? "text-[var(--state-urgent)]"
                                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
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
                                ? "border border-[color:color-mix(in_srgb,var(--state-urgent)_28%,var(--line-subtle))] bg-[var(--state-danger-surface)] text-[var(--state-urgent)]"
                                : "border border-[color:color-mix(in_srgb,var(--info)_28%,var(--line-subtle))] bg-[var(--state-info-surface)] text-[var(--info)]"
                        )}
                    >
                        <span>
                            {uploadState.error
                                ? uploadState.error
                                : `Uploading files ${uploadState.completed}/${uploadState.total}`}
                        </span>
                        {!uploadState.error && <span>{Math.round((uploadState.completed / uploadState.total) * 100)}%</span>}
                    </div>
                )}

                <div
                    ref={editorViewportRef}
                    onMouseDown={handleEditorViewportMouseDown}
                    onDragEnter={(e) => {
                        if (readOnly || imageUploadsDisabled) return
                        if (e.dataTransfer?.types?.includes("Files")) {
                            dragDepthRef.current += 1
                            setIsDraggingOver(true)
                        }
                    }}
                    onDragLeave={(e) => {
                        if (readOnly || imageUploadsDisabled) return
                        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
                        if (dragDepthRef.current === 0) {
                            setIsDraggingOver(false)
                        }
                    }}
                    onDragOver={(e) => {
                        if (readOnly || imageUploadsDisabled) return
                        if (e.dataTransfer?.types?.includes("Files")) {
                            e.preventDefault()
                        }
                    }}
                    onDrop={() => {
                        dragDepthRef.current = 0
                        setIsDraggingOver(false)
                    }}
                    className={cn(
                        "relative min-h-0 h-full flex-1 overflow-y-auto transition-colors",
                        isDraggingOver && "bg-[color-mix(in_srgb,var(--brand-primary)_4%,transparent)]",
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
                    {isDraggingOver ? (
                        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-[var(--brand-primary)] bg-[var(--surface-lowest)]/95 px-4 py-5 text-sm font-semibold text-[var(--brand-primary)] shadow-md backdrop-blur-xs">
                            <UploadCloud className="h-5 w-5 animate-bounce" />
                            <span>Drop files here (PDF, images, docs)</span>
                        </div>
                    ) : null}
                    <div
                        className={cn(
                            mode === "document" &&
                                (isDocumentLeft
                                    ? cn(
                                          "min-h-full w-full",
                                          documentPadding === "none"
                                              ? "px-0 pt-0 pb-4"
                                              : documentPadding === "compact"
                                              ? "px-0.5 pt-0 pb-6 sm:px-1"
                                              : (isAppleNotesAppearance
                                                    ? "px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 md:px-8 md:pb-12"
                                                    : "px-3 pb-7"),
                                          isReadingWidth && "max-w-[760px]"
                                      )
                                    : "mx-auto w-full max-w-4xl px-6 pb-8")
                        )}
                    >
                        {mode === "document" && documentHeader ? (
                            <div className="pb-0.5">{documentHeader}</div>
                        ) : null}
                        {isAppleNotesAppearance && showToolbar ? (
                            <div
                                data-slot="notes-formatting-toolbar"
                                onMouseDown={(event) => {
                                    const target = event.target as HTMLElement
                                    if (target.closest("input, select, textarea")) return
                                    event.preventDefault()
                                }}
                                className="mb-2 mt-0.5 flex w-fit max-w-full items-center gap-1.5 sm:gap-2.5 overflow-x-auto rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2 sm:px-3 py-1 shadow-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            >
                                <Toggle
                                    size="sm"
                                    pressed={editor.isActive("heading", { level: 1 }) || editor.isActive("heading", { level: 2 })}
                                    onPressedChange={(pressed) =>
                                        pressed
                                            ? editor.chain().focus().setHeading({ level: 1 }).run()
                                            : editor.chain().focus().setParagraph().run()
                                    }
                                    className="h-9 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] data-[state=on]:bg-[var(--surface-low)] data-[state=on]:text-[var(--text-primary)] md:h-7 md:px-2"
                                    aria-label="Text format"
                                    title="Text format"
                                >
                                    Aa
                                </Toggle>
                                <Toggle
                                    size="sm"
                                    pressed={editor.isActive("bold")}
                                    onPressedChange={(pressed) =>
                                        pressed
                                            ? editor.chain().focus().setBold().run()
                                            : editor.chain().focus().unsetBold().run()
                                    }
                                    className="h-9 w-9 shrink-0 rounded-lg p-0 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] data-[state=on]:bg-[var(--surface-low)] data-[state=on]:text-[var(--text-primary)] md:h-7 md:w-7"
                                    aria-label="Bold"
                                >
                                    <Bold className="h-4 w-4" />
                                </Toggle>
                                <Toggle
                                    size="sm"
                                    pressed={editor.isActive("italic")}
                                    onPressedChange={(pressed) =>
                                        pressed
                                            ? editor.chain().focus().setItalic().run()
                                            : editor.chain().focus().unsetItalic().run()
                                    }
                                    className="h-9 w-9 shrink-0 rounded-lg p-0 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] data-[state=on]:bg-[var(--surface-low)] data-[state=on]:text-[var(--text-primary)] md:h-7 md:w-7"
                                    aria-label="Italic"
                                >
                                    <Italic className="h-4 w-4" />
                                </Toggle>
                                <Toggle
                                    size="sm"
                                    pressed={editor.isActive("bulletList")}
                                    onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                                    className="h-9 w-9 shrink-0 rounded-lg p-0 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] data-[state=on]:bg-[var(--surface-low)] data-[state=on]:text-[var(--text-primary)] md:h-7 md:w-7"
                                    aria-label="Bullet list"
                                >
                                    <List className="h-4 w-4" />
                                </Toggle>
                                <Toggle
                                    size="sm"
                                    pressed={editor.isActive("taskList")}
                                    onPressedChange={() => editor.chain().focus().toggleTaskList().run()}
                                    className="h-9 w-9 shrink-0 rounded-lg p-0 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] data-[state=on]:bg-[var(--surface-low)] data-[state=on]:text-[var(--text-primary)] md:h-7 md:w-7"
                                    aria-label="Checklist"
                                    title="Checklist"
                                >
                                    <ListChecks className="h-4 w-4" />
                                </Toggle>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const previousUrl = editor.getAttributes("link")?.href
                                        const requestedUrl = window.prompt("URL", previousUrl || "")
                                        if (requestedUrl === null) return
                                        const url = normalizeRichTextLink(requestedUrl)
                                        if (url === "") {
                                            editor.chain().focus().extendMarkRange("link").unsetLink().run()
                                            return
                                        }
                                        if (!url) {
                                            toast.error("Use a valid http, https, mailto, or tel link.")
                                            return
                                        }
                                        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
                                    }}
                                    className={cn(
                                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] md:h-7 md:w-7",
                                        editor.isActive("link") && "bg-[var(--surface-low)] text-[var(--text-primary)]"
                                    )}
                                    aria-label="Link"
                                    title="Link"
                                >
                                    <Link2 className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={imageUploadsDisabled}
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] md:h-7 md:w-7"
                                    aria-label="Add file"
                                    title="Add file (PDF, images, docs)"
                                >
                                    <Paperclip className="h-4 w-4" />
                                </button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] md:h-7 md:w-7"
                                            aria-label="More formatting options"
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onSelect={() => editor.chain().focus().toggleCodeBlock().run()}>
                                            <Code2 className="mr-2 h-4 w-4" /> Code block
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                                            <TableIcon className="mr-2 h-4 w-4" /> Insert Table
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => fileInputRef.current?.click()} disabled={imageUploadsDisabled}>
                                            <Paperclip className="mr-2 h-4 w-4" /> Add file / document
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => fileInputRef.current?.click()} disabled={imageUploadsDisabled}>
                                            <ImagePlus className="mr-2 h-4 w-4" /> Upload Image
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => editor.chain().focus().setHorizontalRule().run()}>
                                            <Minus className="mr-2 h-4 w-4" /> Divider
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                {toolbarActions ? (
                                    <>
                                        <div className="h-4 w-px bg-[var(--line-subtle)] shrink-0" />
                                        <div className="flex items-center gap-1 shrink-0">
                                            {toolbarActions}
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        ) : null}
                        <EditorContent editor={editor} />
                    </div>
                </div>

                {showImageGallery && imageSources.length > 0 && (
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
                                        ? cn("w-full px-3", isReadingWidth && "max-w-[760px]")
                                        : "mx-auto w-full max-w-4xl px-6")
                            )}
                        >
                            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
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

            {folderSuggestion ? (
                <div
                    className="fixed z-[90] w-64 overflow-hidden rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-[var(--shadow-apple)]"
                    style={{ left: folderSuggestion.left, top: folderSuggestion.top }}
                    role="listbox"
                    aria-label="Choose folder"
                >
                    {matchingFolderOptions(folderSuggestion.query).map((option, index) => (
                        <button
                            key={option.id ?? "all-notes"}
                            type="button"
                            role="option"
                            aria-selected={index === folderSuggestion.selectedIndex}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applyFolderSuggestion(index)}
                            className={cn(
                                "flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-medium",
                                index === folderSuggestion.selectedIndex
                                    ? "bg-[var(--state-info-surface)] text-[var(--info)]"
                                    : "text-[var(--text-primary)] hover:bg-[var(--surface-low)]"
                            )}
                        >
                            <span className="truncate">#{option.name}</span>
                        </button>
                    ))}
                </div>
            ) : null}

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

            {/* PDF Viewer Dialog */}
            <Dialog
                open={Boolean(pdfPreviewState)}
                onOpenChange={(open) => {
                    if (!open) setPdfPreviewState(null)
                }}
            >
                <DialogContent className="h-[92vh] w-[95vw] min-w-[85vw] max-w-6xl overflow-hidden border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-0 shadow-2xl flex flex-col">
                    <DialogHeader className="flex flex-row items-center justify-between border-b border-[var(--line-subtle)] px-4 py-3 bg-[var(--surface-low)]">
                        <div className="flex items-center gap-2.5 min-w-0 pr-4">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 shadow-2xs">
                                <img
                                    src={FILE_ICONS_SVG_DATA.pdf}
                                    className="h-4.5 w-4.5 pointer-events-none select-none"
                                    alt="PDF"
                                />
                            </span>
                            <div className="min-w-0">
                                <DialogTitle className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                    {pdfPreviewState?.name || "PDF Document"}
                                </DialogTitle>
                                {pdfPreviewState?.size ? (
                                    <p className="text-xs text-[var(--text-muted)]">
                                        {pdfPreviewState.size}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <a
                                href={pdfPreviewState?.src || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">New tab</span>
                            </a>
                            <a
                                href={pdfPreviewState?.src || "#"}
                                download={pdfPreviewState?.name || "document.pdf"}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Download</span>
                            </a>
                            <button
                                type="button"
                                onClick={() => setPdfPreviewState(null)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                aria-label="Close PDF preview"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </DialogHeader>
                    <div className="relative flex-1 w-full bg-slate-900/5 overflow-hidden">
                        {pdfPreviewState?.src ? (
                            <object
                                data={pdfPreviewState.src}
                                type="application/pdf"
                                className="h-full w-full"
                            >
                                <iframe
                                    src={pdfPreviewState.src}
                                    title={pdfPreviewState.name || "PDF Preview"}
                                    className="h-full w-full border-0 bg-[var(--surface-lowest)]"
                                />
                            </object>
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
