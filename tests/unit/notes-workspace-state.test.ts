import { describe, expect, it, vi } from "vitest"
import {
  clearProjectNoteDraftIfContent,
  applyFolderCountChange,
  enqueueSerializedNoteSave,
  isNoteDraftDirty,
  markProjectNoteDraftSaved,
  recordProjectNoteDraft,
  resolveNoteEditorDraft,
  resolveNotesUrlNoteId,
  resolveProjectNoteDraftContent,
  resolveNotesScope,
  shouldAcceptNoteEditorChange,
  shouldDiscardNewNote,
  shouldApplyNotesRequest,
  clampNotesPaneWidth,
  parseStoredNotesPaneWidth,
  NOTES_FOLDERS_MIN_WIDTH,
  NOTES_FOLDERS_MAX_WIDTH,
  NOTES_FOLDERS_DEFAULT_WIDTH,
  NOTES_LIST_MIN_WIDTH,
  NOTES_LIST_MAX_WIDTH,
  NOTES_LIST_DEFAULT_WIDTH,
} from "@/lib/notes/workspace-state"
import {
  hasCurrentNotesWriteProtocol,
  NOTES_WRITE_PROTOCOL_VERSION,
} from "@/lib/notes/write-protocol"
import {
  hasMeaningfulRichTextContent,
  hasNoteContentStateChanged,
  normalizeRichTextContent,
  normalizeRichTextLink,
} from "@/lib/notes/content"
import { createSignedProjectNoteUrl } from "@/lib/project-note-storage"

const notes = [
  { id: "note-1", sourceType: "note" as const, archived: false, deletedAt: null },
  { id: "note-2", sourceType: "note" as const, archived: false, deletedAt: null },
  { id: "archived", sourceType: "note" as const, archived: true, deletedAt: null },
  { id: "deleted", sourceType: "note" as const, archived: false, deletedAt: "2026-07-30" },
  { id: "project:1", sourceType: "project" as const, archived: false, deletedAt: null },
  { id: "task:1", sourceType: "task" as const, archived: false, deletedAt: null },
]

describe("Notes workspace state", () => {
  it("updates folder counts without allowing negative totals", () => {
    const folders = [{ id: "a", count: 1 }, { id: "b", count: 2 }]
    expect(applyFolderCountChange(folders, "a", "b")).toEqual([
      { id: "a", count: 0 },
      { id: "b", count: 3 },
    ])
    expect(applyFolderCountChange([{ id: "a", count: 0 }], "a", null)).toEqual([
      { id: "a", count: 0 },
    ])
  })

  it("keeps note URLs aligned with the responsive pane", () => {
    expect(resolveNotesUrlNoteId({ isMobile: true, pane: "list", selectedNoteId: "note-1" })).toBeNull()
    expect(resolveNotesUrlNoteId({ isMobile: true, pane: "editor", selectedNoteId: "note-1" })).toBe("note-1")
    expect(resolveNotesUrlNoteId({ isMobile: false, pane: "list", selectedNoteId: "note-1" })).toBe("note-1")
  })

  it("rejects stale async Notes responses", () => {
    expect(shouldApplyNotesRequest(4, 4)).toBe(true)
    expect(shouldApplyNotesRequest(3, 4)).toBe(false)
  })

  it("normalizes safe links and rejects executable protocols", () => {
    expect(normalizeRichTextLink("pixelist.ro")).toBe("https://pixelist.ro")
    expect(normalizeRichTextLink("mailto:hello@pixelist.ro")).toBe("mailto:hello@pixelist.ro")
    expect(normalizeRichTextLink("/notes?note=1")).toBe("/notes?note=1")
    expect(normalizeRichTextLink("javascript:alert(1)")).toBeNull()
    expect(normalizeRichTextLink("data:text/html,test")).toBeNull()
  })

  it("creates durable asset URLs while retaining explicit expiring URLs", () => {
    const previousSecret = process.env.PROJECT_NOTES_SIGNING_SECRET
    process.env.PROJECT_NOTES_SIGNING_SECRET = "notes-test-signing-secret"
    try {
      const durable = createSignedProjectNoteUrl("note-1/image.png")
      const expiring = createSignedProjectNoteUrl("note-1/image.png", { expiresAtUnix: 2_000_000_000 })
      expect(durable).toContain("/api/project-notes/file?path=note-1%2Fimage.png&sig=")
      expect(durable).not.toContain("&exp=")
      expect(expiring).toContain("&exp=2000000000")
    } finally {
      if (previousSecret === undefined) delete process.env.PROJECT_NOTES_SIGNING_SECRET
      else process.env.PROJECT_NOTES_SIGNING_SECRET = previousSecret
    }
  })

  it("canonicalizes empty rich-text documents", () => {
    expect(hasMeaningfulRichTextContent("<p></p>")).toBe(false)
    expect(hasMeaningfulRichTextContent("<p>&nbsp;</p>")).toBe(false)
    expect(hasMeaningfulRichTextContent("<p>Write this</p>")).toBe(true)
    expect(hasMeaningfulRichTextContent('<img src="/preview.png" alt="">')).toBe(true)
    expect(hasMeaningfulRichTextContent('<div data-note-drawing-id="drawing-1"></div>')).toBe(true)
    expect(normalizeRichTextContent("<p></p>")).toBe("")
    expect(normalizeRichTextContent(null)).toBe("")
    expect(normalizeRichTextContent("<p>Write this</p>")).toBe("<p>Write this</p>")
  })

  it("does not mark an opened but untouched note as changed", () => {
    expect(hasNoteContentStateChanged({
      savedContent: "<p>Same note</p>",
      nextContent: "<p>Same note</p>",
      savedFolderId: null,
      nextFolderId: null,
    })).toBe(false)

    expect(hasNoteContentStateChanged({
      savedContent: "<p>Same note</p>",
      nextContent: "<p>Edited note</p>",
      savedFolderId: null,
      nextFolderId: null,
    })).toBe(true)

    expect(hasNoteContentStateChanged({
      savedContent: "<p>Same note</p>",
      nextContent: "<p>Same note</p>",
      savedFolderId: null,
      nextFolderId: "folder-1",
    })).toBe(true)
  })

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

  it("clamps and parses customized pane widths within permitted ranges", () => {
    expect(clampNotesPaneWidth(150, NOTES_FOLDERS_MIN_WIDTH, NOTES_FOLDERS_MAX_WIDTH, NOTES_FOLDERS_DEFAULT_WIDTH)).toBe(180)
    expect(clampNotesPaneWidth(450, NOTES_FOLDERS_MIN_WIDTH, NOTES_FOLDERS_MAX_WIDTH, NOTES_FOLDERS_DEFAULT_WIDTH)).toBe(380)
    expect(clampNotesPaneWidth(220, NOTES_FOLDERS_MIN_WIDTH, NOTES_FOLDERS_MAX_WIDTH, NOTES_FOLDERS_DEFAULT_WIDTH)).toBe(220)
    expect(clampNotesPaneWidth(null, NOTES_FOLDERS_MIN_WIDTH, NOTES_FOLDERS_MAX_WIDTH, NOTES_FOLDERS_DEFAULT_WIDTH)).toBe(180)
    expect(clampNotesPaneWidth(Number.NaN, NOTES_FOLDERS_MIN_WIDTH, NOTES_FOLDERS_MAX_WIDTH, NOTES_FOLDERS_DEFAULT_WIDTH)).toBe(180)

    expect(parseStoredNotesPaneWidth("260", NOTES_LIST_MIN_WIDTH, NOTES_LIST_MAX_WIDTH, NOTES_LIST_DEFAULT_WIDTH)).toBe(260)
    expect(parseStoredNotesPaneWidth("120", NOTES_LIST_MIN_WIDTH, NOTES_LIST_MAX_WIDTH, NOTES_LIST_DEFAULT_WIDTH)).toBe(200)
    expect(parseStoredNotesPaneWidth("800", NOTES_LIST_MIN_WIDTH, NOTES_LIST_MAX_WIDTH, NOTES_LIST_DEFAULT_WIDTH)).toBe(500)
    expect(parseStoredNotesPaneWidth(null, NOTES_LIST_MIN_WIDTH, NOTES_LIST_MAX_WIDTH, NOTES_LIST_DEFAULT_WIDTH)).toBe(230)
    expect(parseStoredNotesPaneWidth("invalid", NOTES_LIST_MIN_WIDTH, NOTES_LIST_MAX_WIDTH, NOTES_LIST_DEFAULT_WIDTH)).toBe(230)
  })
})
