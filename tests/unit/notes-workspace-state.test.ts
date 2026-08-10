import { describe, expect, it, vi } from "vitest"
import {
  clearProjectNoteDraftIfContent,
  enqueueSerializedNoteSave,
  isNoteDraftDirty,
  markProjectNoteDraftSaved,
  recordProjectNoteDraft,
  resolveNoteEditorDraft,
  resolveProjectNoteDraftContent,
  resolveNotesScope,
  shouldAcceptNoteEditorChange,
  shouldDiscardNewNote,
} from "@/lib/notes/workspace-state"
import {
  hasCurrentNotesWriteProtocol,
  NOTES_WRITE_PROTOCOL_VERSION,
} from "@/lib/notes/write-protocol"

const notes = [
  { id: "note-1", sourceType: "note" as const, archived: false, deletedAt: null },
  { id: "note-2", sourceType: "note" as const, archived: false, deletedAt: null },
  { id: "archived", sourceType: "note" as const, archived: true, deletedAt: null },
  { id: "deleted", sourceType: "note" as const, archived: false, deletedAt: "2026-07-30" },
  { id: "project:1", sourceType: "project" as const, archived: false, deletedAt: null },
  { id: "task:1", sourceType: "task" as const, archived: false, deletedAt: null },
]

describe("Notes workspace state", () => {
  it("rejects every stale Notes write protocol", () => {
    expect(hasCurrentNotesWriteProtocol(NOTES_WRITE_PROTOCOL_VERSION)).toBe(true)
    expect(hasCurrentNotesWriteProtocol(undefined)).toBe(false)
    expect(hasCurrentNotesWriteProtocol("2026-08-01-old-client")).toBe(false)
  })

  it("switches to all active personal notes without requiring a search query", () => {
    expect(resolveNotesScope(notes, [notes[1]], "view").map((note) => note.id)).toEqual([
      "note-2",
    ])
    expect(resolveNotesScope(notes, [notes[1]], "all").map((note) => note.id)).toEqual([
      "note-1",
      "note-2",
    ])
  })

  it("serializes saves for the same note so the newest content wins", async () => {
    const queues = new Map<string, Promise<string>>()
    const order: string[] = []
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = enqueueSerializedNoteSave(queues, "note-1", async () => {
      order.push("first:start")
      await firstGate
      order.push("first:end")
      return "first"
    })
    const secondSave = vi.fn(async () => {
      order.push("second")
      return "second"
    })
    const second = enqueueSerializedNoteSave(queues, "note-1", secondSave)

    await Promise.resolve()
    expect(secondSave).not.toHaveBeenCalled()
    releaseFirst?.()
    await expect(first).resolves.toBe("first")
    await expect(second).resolves.toBe("second")
    expect(order).toEqual(["first:start", "first:end", "second"])
    expect(queues.size).toBe(0)
  })

  it("continues with the newest save after an earlier failure", async () => {
    const queues = new Map<string, Promise<string>>()
    const failed = enqueueSerializedNoteSave(queues, "note-1", async () => {
      throw new Error("offline")
    })
    const recovered = enqueueSerializedNoteSave(queues, "note-1", async () => "latest")

    await expect(failed).rejects.toThrow("offline")
    await expect(recovered).resolves.toBe("latest")
  })

  it("never autosaves an initialized note until a user edit advances its revision", () => {
    expect(isNoteDraftDirty(0, 0)).toBe(false)
    expect(isNoteDraftDirty(1, 0)).toBe(true)
    expect(isNoteDraftDirty(2, 1)).toBe(true)
    expect(isNoteDraftDirty(2, 2)).toBe(false)
  })

  it("never hands the previous note draft to a newly selected editor", () => {
    expect(
      resolveNoteEditorDraft(
        "note-b",
        "note-a",
        "<p>Note A latest draft</p>",
        undefined,
        "<p>Note B server content</p>"
      )
    ).toBe("<p>Note B server content</p>")
    expect(
      resolveNoteEditorDraft(
        "note-b",
        "note-a",
        "<p>Note A latest draft</p>",
        "<p>Note B unsaved draft</p>",
        "<p>Note B server content</p>"
      )
    ).toBe("<p>Note B unsaved draft</p>")
  })

  it("accepts editor updates only from the currently selected note", () => {
    expect(shouldAcceptNoteEditorChange("note-a", "note-a")).toBe(true)
    expect(shouldAcceptNoteEditorChange("note-a", "note-b")).toBe(false)
    expect(shouldAcceptNoteEditorChange("note-a", null)).toBe(false)
  })

  it("discards only newly created notes that remain blank", () => {
    expect(shouldDiscardNewNote(true, "")).toBe(true)
    expect(shouldDiscardNewNote(true, "<p></p>")).toBe(true)
    expect(shouldDiscardNewNote(true, "<p>&nbsp;</p>")).toBe(true)
    expect(shouldDiscardNewNote(true, "<p>Keep me</p>")).toBe(false)
    expect(shouldDiscardNewNote(false, "<p></p>")).toBe(false)
  })

  it("hands an unsaved project-note draft to the Notes page without accepting conflicts", () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }

    recordProjectNoteDraft(storage, "project-1", "<p>Newest text</p>", "<p>Old text</p>", 100)
    expect(
      resolveProjectNoteDraftContent(storage, "project-1", "<p>Old text</p>", 101)
    ).toBe("<p>Newest text</p>")
    expect(
      resolveProjectNoteDraftContent(storage, "project-1", "<p>Changed elsewhere</p>", 101)
    ).toBeNull()

    markProjectNoteDraftSaved(storage, "project-1", "<p>Newest text</p>")
    expect(
      resolveProjectNoteDraftContent(storage, "project-1", "<p>Newest text</p>", 102)
    ).toBeNull()
  })

  it("keeps the latest draft when an older queued project-note save finishes", () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }

    recordProjectNoteDraft(storage, "project-1", "<p>First edit</p>", "<p>Old</p>", 100)
    recordProjectNoteDraft(storage, "project-1", "<p>Second edit</p>", "<p>Old</p>", 101)
    markProjectNoteDraftSaved(storage, "project-1", "<p>First edit</p>")

    expect(
      resolveProjectNoteDraftContent(storage, "project-1", "<p>First edit</p>", 102)
    ).toBe("<p>Second edit</p>")

    clearProjectNoteDraftIfContent(storage, "project-1", "<p>First edit</p>")
    expect(
      resolveProjectNoteDraftContent(storage, "project-1", "<p>First edit</p>", 103)
    ).toBe("<p>Second edit</p>")
  })

  it("recovers a meaningful legacy draft after the buggy Notes page wrote empty HTML", () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }
    values.set("crm:project-note-draft:project-1", JSON.stringify({
      content: "<p>Recover this text</p>",
      editedAt: 100,
      knownServerContents: [""],
    }))

    expect(
      resolveProjectNoteDraftContent(storage, "project-1", "<p></p>", 101)
    ).toBe("<p>Recover this text</p>")
    expect(values.has("crm:project-note-draft:project-1")).toBe(false)
  })
})
