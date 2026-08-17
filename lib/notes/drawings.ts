export const NOTE_DRAWING_VERSION = 1 as const

export type NoteDrawingOwnerType = "note" | "project" | "task"

export type NoteDrawingOwner = {
  type: NoteDrawingOwnerType
  id: string
}

export type NoteDrawingPoint = [x: number, y: number, pressure: number]

export type NoteDrawingStroke = {
  id: string
  tool: "pen" | "highlighter"
  color: string
  size: number
  points: NoteDrawingPoint[]
}

export type NoteDrawingDocument = {
  version: typeof NOTE_DRAWING_VERSION
  strokes: NoteDrawingStroke[]
}

export type NoteDrawingRecord = {
  id: string
  owner: NoteDrawingOwner
  document: NoteDrawingDocument
  canvasWidth: number
  canvasHeight: number
  previewUrl: string
  createdAt: string
  updatedAt: string
}

export function emptyNoteDrawingDocument(): NoteDrawingDocument {
  return { version: NOTE_DRAWING_VERSION, strokes: [] }
}

export function noteDrawingNodeHtml(drawingId: string) {
  return `<div data-note-drawing-id="${drawingId}"></div>`
}

