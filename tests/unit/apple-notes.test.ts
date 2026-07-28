import { describe, expect, it } from "vitest"
import {
  deriveNoteContentFeatures,
  extractNoteTagNames,
  getNoteRetentionCutoff,
  matchesNoteSmartFolder,
  normalizeNoteTagName,
} from "@/lib/notes/apple-notes"

describe("Apple Notes productivity helpers", () => {
  it("extracts normalized unique tags from note text", () => {
    expect(extractNoteTagNames("Plan #Client and #client plus #Încasări")).toEqual([
      { name: "Client", normalizedName: "client" },
      { name: "Încasări", normalizedName: "încasări" },
    ])
    expect(normalizeNoteTagName("## CLIENT ")).toBe("client")
  })

  it("detects checklist and attachment content", () => {
    expect(
      deriveNoteContentFeatures(
        '<ul data-type="taskList"><li data-checked="false">Task</li></ul><img src="/note.png">'
      )
    ).toEqual({ hasChecklist: true, hasAttachment: true })
  })

  it("matches all and any smart-folder criteria", () => {
    const note = {
      pinned: true,
      hasChecklist: true,
      hasAttachment: false,
      updatedAt: "2026-07-23T10:00:00.000Z",
      tagIds: ["tag-client"],
    }
    const now = new Date("2026-07-24T10:00:00.000Z")

    expect(
      matchesNoteSmartFolder(
        note,
        {
          matchMode: "all",
          tagIds: ["tag-client"],
          requirePinned: true,
          requireChecklist: true,
          requireAttachment: null,
          updatedWithinDays: 7,
        },
        now
      )
    ).toBe(true)

    expect(
      matchesNoteSmartFolder(
        note,
        {
          matchMode: "any",
          tagIds: ["missing"],
          requirePinned: null,
          requireChecklist: null,
          requireAttachment: true,
          updatedWithinDays: null,
        },
        now
      )
    ).toBe(false)
  })

  it("uses a 30-day Recently Deleted cutoff", () => {
    expect(getNoteRetentionCutoff(new Date("2026-07-24T12:00:00.000Z")).toISOString()).toBe(
      "2026-06-24T12:00:00.000Z"
    )
  })
})
