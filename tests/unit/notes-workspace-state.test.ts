import { describe, expect, it, vi } from "vitest"
import {
  enqueueSerializedNoteSave,
  resolveNotesScope,
} from "@/lib/notes/workspace-state"

const notes = [
  { id: "note-1", sourceType: "note" as const, archived: false, deletedAt: null },
  { id: "note-2", sourceType: "note" as const, archived: false, deletedAt: null },
  { id: "archived", sourceType: "note" as const, archived: true, deletedAt: null },
  { id: "deleted", sourceType: "note" as const, archived: false, deletedAt: "2026-07-30" },
  { id: "project:1", sourceType: "project" as const, archived: false, deletedAt: null },
  { id: "task:1", sourceType: "task" as const, archived: false, deletedAt: null },
]

describe("Notes workspace state", () => {
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
})
