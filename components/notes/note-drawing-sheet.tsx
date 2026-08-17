"use client"

import * as React from "react"
import { getStroke } from "perfect-freehand"
import {
  Check,
  Eraser,
  Highlighter,
  Loader2,
  Pencil,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  emptyNoteDrawingDocument,
  type NoteDrawingDocument,
  type NoteDrawingOwner,
  type NoteDrawingPoint,
  type NoteDrawingRecord,
  type NoteDrawingStroke,
} from "@/lib/notes/drawings"

const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 800
const COLORS = ["#17201c", "#0f766e", "#2563eb", "#dc2626", "#9333ea", "#d97706"]
type DrawingTool = "pen" | "highlighter" | "eraser"

function svgPathFromStroke(points: number[][]) {
  if (!points.length) return ""
  const average = (a: number, b: number) => (a + b) / 2
  let path = `M ${points[0][0]} ${points[0][1]} Q`
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    const next = points[index + 1]
    if (next) path += ` ${point[0]} ${point[1]} ${average(point[0], next[0])} ${average(point[1], next[1])}`
    else path += ` ${point[0]} ${point[1]} ${point[0]} ${point[1]}`
  }
  return `${path} Z`
}

function strokePath(stroke: NoteDrawingStroke) {
  return svgPathFromStroke(
    getStroke(
      stroke.points.map(([x, y, pressure]) => [x * CANVAS_WIDTH, y * CANVAS_HEIGHT, pressure]),
      {
        size: stroke.size,
        thinning: stroke.tool === "highlighter" ? 0.15 : 0.62,
        smoothing: 0.58,
        streamline: 0.45,
        simulatePressure: false,
      }
    )
  )
}

function cloneStrokes(strokes: NoteDrawingStroke[]) {
  return strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => [...point] as NoteDrawingPoint) }))
}

async function createPreview(strokes: NoteDrawingStroke[]) {
  const paths = strokes.map((stroke) => (
    `<path d="${strokePath(stroke)}" fill="${stroke.color}" fill-opacity="${stroke.tool === "highlighter" ? 0.28 : 1}"/>`
  )).join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"><rect width="100%" height="100%" rx="24" fill="#ffffff"/>${paths}</svg>`
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image()
      next.onload = () => resolve(next)
      next.onerror = () => reject(new Error("Failed to render drawing preview"))
      next.src = url
    })
    const canvas = document.createElement("canvas")
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Drawing preview is unavailable")
    context.drawImage(image, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Failed to export drawing")), "image/png")
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

type NoteDrawingSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  owner: NoteDrawingOwner | null
  drawingId?: string | null
  onSaved: (drawing: NoteDrawingRecord) => void
}

export function NoteDrawingSheet({
  open,
  onOpenChange,
  owner,
  drawingId,
  onSaved,
}: NoteDrawingSheetProps) {
  const [document, setDocument] = React.useState<NoteDrawingDocument>(emptyNoteDrawingDocument)
  const [tool, setTool] = React.useState<DrawingTool>("pen")
  const [color, setColor] = React.useState(COLORS[0])
  const [size, setSize] = React.useState(10)
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [undoStack, setUndoStack] = React.useState<NoteDrawingStroke[][]>([])
  const [redoStack, setRedoStack] = React.useState<NoteDrawingStroke[][]>([])
  const activeStrokeIdRef = React.useRef<string | null>(null)
  const activePointerIdRef = React.useRef<number | null>(null)
  const lastPenAtRef = React.useRef(0)

  React.useEffect(() => {
    if (!open) return
    setUndoStack([])
    setRedoStack([])
    if (!drawingId) {
      setDocument(emptyNoteDrawingDocument())
      setUpdatedAt(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetch(`/api/note-drawings/${drawingId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { success?: boolean; data?: NoteDrawingRecord; error?: string }
        if (!response.ok || !payload.data) throw new Error(payload.error || "Failed to load drawing")
        if (!cancelled) {
          setDocument(payload.data.document)
          setUpdatedAt(payload.data.updatedAt)
        }
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Failed to load drawing")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [drawingId, open])

  const commitHistory = React.useCallback((current: NoteDrawingStroke[]) => {
    setUndoStack((stack) => [...stack.slice(-39), cloneStrokes(current)])
    setRedoStack([])
  }, [])

  const eraseAt = React.useCallback((point: NoteDrawingPoint) => {
    setDocument((current) => {
      const threshold = Math.max(0.018, size / CANVAS_WIDTH * 2.4)
      const next = current.strokes.filter((stroke) => !stroke.points.some(([x, y]) => Math.hypot(x - point[0], y - point[1]) <= threshold))
      if (next.length === current.strokes.length) return current
      return { ...current, strokes: next }
    })
  }, [size])

  const pointFromEvent = React.useCallback((event: React.PointerEvent<SVGSVGElement>): NoteDrawingPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      event.pointerType === "pen" && event.pressure > 0 ? event.pressure : 0.5,
    ]
  }, [])

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "pen") lastPenAtRef.current = Date.now()
    if (event.pointerType === "touch" && Date.now() - lastPenAtRef.current < 1200) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointerIdRef.current = event.pointerId
    commitHistory(document.strokes)
    const point = pointFromEvent(event)
    if (tool === "eraser") {
      eraseAt(point)
      return
    }
    const id = crypto.randomUUID()
    activeStrokeIdRef.current = id
    setDocument((current) => ({
      ...current,
      strokes: [...current.strokes, { id, tool, color, size, points: [point] }],
    }))
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return
    if (event.pointerType === "pen") lastPenAtRef.current = Date.now()
    const events = typeof event.nativeEvent.getCoalescedEvents === "function"
      ? event.nativeEvent.getCoalescedEvents()
      : [event.nativeEvent]
    if (tool === "eraser") {
      for (const pointer of events) {
        const rect = event.currentTarget.getBoundingClientRect()
        eraseAt([
          Math.min(1, Math.max(0, (pointer.clientX - rect.left) / rect.width)),
          Math.min(1, Math.max(0, (pointer.clientY - rect.top) / rect.height)),
          0.5,
        ])
      }
      return
    }
    const strokeId = activeStrokeIdRef.current
    if (!strokeId) return
    const rect = event.currentTarget.getBoundingClientRect()
    const points = events.map((pointer) => ([
      Math.min(1, Math.max(0, (pointer.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (pointer.clientY - rect.top) / rect.height)),
      pointer.pointerType === "pen" && pointer.pressure > 0 ? pointer.pressure : 0.5,
    ] as NoteDrawingPoint))
    setDocument((current) => ({
      ...current,
      strokes: current.strokes.map((stroke) => stroke.id === strokeId
        ? { ...stroke, points: [...stroke.points, ...points] }
        : stroke),
    }))
  }

  const finishPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return
    activePointerIdRef.current = null
    activeStrokeIdRef.current = null
  }

  const undo = () => {
    const previous = undoStack.at(-1)
    if (!previous) return
    setRedoStack((stack) => [...stack, cloneStrokes(document.strokes)])
    setDocument((current) => ({ ...current, strokes: cloneStrokes(previous) }))
    setUndoStack((stack) => stack.slice(0, -1))
  }

  const redo = () => {
    const next = redoStack.at(-1)
    if (!next) return
    setUndoStack((stack) => [...stack, cloneStrokes(document.strokes)])
    setDocument((current) => ({ ...current, strokes: cloneStrokes(next) }))
    setRedoStack((stack) => stack.slice(0, -1))
  }

  const save = async () => {
    if (!owner || !document.strokes.length) return
    setSaving(true)
    try {
      const preview = await createPreview(document.strokes)
      const formData = new FormData()
      formData.set("owner", JSON.stringify(owner))
      formData.set("strokeData", JSON.stringify(document))
      formData.set("canvasWidth", String(CANVAS_WIDTH))
      formData.set("canvasHeight", String(CANVAS_HEIGHT))
      formData.set("preview", preview, "drawing.png")
      if (updatedAt) formData.set("expectedUpdatedAt", updatedAt)
      const response = await fetch(drawingId ? `/api/note-drawings/${drawingId}` : "/api/note-drawings", {
        method: drawingId ? "PATCH" : "POST",
        body: formData,
      })
      const payload = await response.json() as { success?: boolean; data?: NoteDrawingRecord; error?: string; code?: string }
      if (!response.ok || !payload.data) throw new Error(payload.error || "Failed to save drawing")
      onSaved(payload.data)
      window.dispatchEvent(new CustomEvent("note-drawing-updated", { detail: { id: payload.data.id } }))
      onOpenChange(false)
      toast.success(drawingId ? "Drawing updated" : "Drawing inserted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save drawing")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex h-[min(92dvh,900px)] w-[min(96vw,1280px)] max-w-none flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-[var(--line-subtle)] px-4 py-3 sm:px-5">
          <DialogTitle>{drawingId ? "Edit drawing" : "New drawing"}</DialogTitle>
          <DialogDescription className="sr-only">Draw with Apple Pencil, another stylus, touch, or mouse.</DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--line-subtle)] bg-[var(--surface-low)] px-3 py-2">
          {(["pen", "highlighter", "eraser"] as const).map((item) => {
            const Icon = item === "pen" ? Pencil : item === "highlighter" ? Highlighter : Eraser
            return (
              <Button key={item} type="button" size="sm" variant={tool === item ? "default" : "ghost"} className="h-9 rounded-xl capitalize" onClick={() => setTool(item)}>
                <Icon className="h-4 w-4" />{item}
              </Button>
            )
          })}
          <div className="mx-1 h-7 w-px bg-[var(--line-subtle)]" />
          {COLORS.map((item) => (
            <button key={item} type="button" aria-label={`Use ${item}`} onClick={() => setColor(item)} className={cn("h-7 w-7 rounded-full border-2 shadow-sm", color === item ? "border-[var(--text-primary)] ring-2 ring-[var(--surface-lowest)]" : "border-[var(--surface-lowest)]")} style={{ backgroundColor: item }} />
          ))}
          <label className="ml-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            Size
            <input type="range" min="2" max="48" value={size} onChange={(event) => setSize(Number(event.target.value))} className="w-24 accent-[var(--primary)]" />
          </label>
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={undo} disabled={!undoStack.length} aria-label="Undo"><Undo2 className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={redo} disabled={!redoStack.length} aria-label="Redo"><Redo2 className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-rose-600" onClick={() => { commitHistory(document.strokes); setDocument(emptyNoteDrawingDocument()) }} disabled={!document.strokes.length} aria-label="Clear drawing"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-highest)] p-2 sm:p-4">
          <div className="mx-auto aspect-[3/2] max-h-full max-w-full overflow-hidden rounded-[18px] border border-[var(--line-subtle)] bg-white shadow-[var(--shadow-apple)]">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[var(--text-muted)]"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <svg
                viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                className="h-full w-full select-none touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
                aria-label="Drawing canvas"
                role="img"
              >
                <rect width="100%" height="100%" fill="#ffffff" />
                {document.strokes.map((stroke) => (
                  <path key={stroke.id} d={strokePath(stroke)} fill={stroke.color} fillOpacity={stroke.tool === "highlighter" ? 0.28 : 1} />
                ))}
              </svg>
            )}
          </div>
        </div>
        <DialogFooter className="shrink-0 flex-row justify-end border-t border-[var(--line-subtle)] px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}><RotateCcw className="h-4 w-4" />Cancel</Button>
          <Button type="button" onClick={() => void save()} disabled={saving || loading || !owner || !document.strokes.length}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {drawingId ? "Save drawing" : "Insert drawing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

