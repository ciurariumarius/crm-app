"use client"

import * as React from "react"
import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react"
import { Loader2, Pencil } from "lucide-react"
import type { NoteDrawingRecord } from "@/lib/notes/drawings"

type DrawingNodeOptions = {
  onEditDrawing?: (drawingId: string) => void
}

function DrawingNodeView({ node, extension, selected }: NodeViewProps) {
  const drawingId = String(node.attrs.drawingId || "")
  const onEditDrawing = (extension.options as DrawingNodeOptions).onEditDrawing
  const [drawing, setDrawing] = React.useState<NoteDrawingRecord | null>(null)
  const [failed, setFailed] = React.useState(false)

  const loadDrawing = React.useCallback(() => {
    if (!drawingId) return
    setFailed(false)
    void fetch(`/api/note-drawings/${drawingId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: NoteDrawingRecord }
        if (!response.ok || !payload.data) throw new Error("Drawing unavailable")
        setDrawing(payload.data)
      })
      .catch(() => setFailed(true))
  }, [drawingId])

  React.useEffect(loadDrawing, [loadDrawing])
  React.useEffect(() => {
    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail
      if (detail?.id === drawingId) loadDrawing()
    }
    window.addEventListener("note-drawing-updated", handleUpdated)
    return () => window.removeEventListener("note-drawing-updated", handleUpdated)
  }, [drawingId, loadDrawing])

  return (
    <NodeViewWrapper
      as="figure"
      data-note-drawing-id={drawingId}
      className={`group relative my-5 overflow-hidden rounded-[18px] border bg-white shadow-sm ${selected ? "border-[var(--brand-cyan)] ring-2 ring-[color:color-mix(in_srgb,var(--brand-cyan)_20%,transparent)]" : "border-[var(--line-subtle)]"}`}
    >
      {drawing ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={drawing.previewUrl} alt="Handwritten drawing" className="block h-auto w-full" draggable={false} />
      ) : (
        <div className="flex aspect-[3/2] items-center justify-center text-sm text-[var(--text-muted)]">
          {failed ? <button type="button" className="font-medium hover:underline" onClick={loadDrawing}>Reload drawing</button> : <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
      )}
      {onEditDrawing ? (
        <button
          type="button"
          contentEditable={false}
          onClick={() => onEditDrawing(drawingId)}
          className="absolute right-3 top-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white/92 px-3 text-xs font-semibold text-slate-700 opacity-0 shadow-sm backdrop-blur transition hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 group-hover:opacity-100"
          aria-label="Edit drawing"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      ) : null}
    </NodeViewWrapper>
  )
}

export const NoteDrawingNode = Node.create<DrawingNodeOptions>({
  name: "noteDrawing",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addOptions() {
    return { onEditDrawing: undefined }
  },
  addAttributes() {
    return { drawingId: { default: null } }
  },
  parseHTML() {
    return [{
      tag: "div[data-note-drawing-id], figure[data-note-drawing-id]",
      getAttrs: (element) => ({ drawingId: (element as HTMLElement).dataset.noteDrawingId }),
    }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-note-drawing-id": HTMLAttributes.drawingId })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(DrawingNodeView)
  },
})
