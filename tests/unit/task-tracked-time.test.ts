import { describe, expect, it } from "vitest"
import {
  buildTaskTimeTotalPlan,
  formatTaskTrackedSeconds,
  parseTaskTrackedMinutesInput,
} from "@/lib/tasks/tracked-time"

describe("task tracked time", () => {
  it("parses a direct total including zero", () => {
    expect(parseTaskTrackedMinutesInput("100")).toBe(100)
    expect(parseTaskTrackedMinutesInput("0")).toBe(0)
    expect(parseTaskTrackedMinutesInput("1.5")).toBeUndefined()
    expect(parseTaskTrackedMinutesInput("-1")).toBeUndefined()
  })

  it("formats compact hour and minute totals", () => {
    expect(formatTaskTrackedSeconds(0)).toBe("0m")
    expect(formatTaskTrackedSeconds(40 * 60)).toBe("40m")
    expect(formatTaskTrackedSeconds(100 * 60)).toBe("1h 40m")
  })

  it("creates a new adjustment when the total increases", () => {
    expect(buildTaskTimeTotalPlan([
      { id: "today", durationSeconds: 40 * 60 },
      { id: "yesterday", durationSeconds: 60 * 60 },
    ], 130 * 60)).toEqual({
      createSeconds: 30 * 60,
      updates: [],
      deleteIds: [],
    })
  })

  it("reconciles the newest sessions when the total decreases", () => {
    expect(buildTaskTimeTotalPlan([
      { id: "today", durationSeconds: 40 * 60 },
      { id: "yesterday", durationSeconds: 60 * 60 },
    ], 50 * 60)).toEqual({
      createSeconds: 0,
      updates: [{ id: "yesterday", durationSeconds: 50 * 60 }],
      deleteIds: ["today"],
    })
  })
})
