import { describe, expect, it } from "vitest"
import {
  buildTaskTimeTotalPlan,
  formatTaskTrackedSeconds,
  parseTaskTrackedMinutesInput,
  parseFlexibleMinutes,
} from "@/lib/tasks/tracked-time"

describe("task tracked time", () => {
  it("parses a direct total including zero", () => {
    expect(parseTaskTrackedMinutesInput("100")).toBe(100)
    expect(parseTaskTrackedMinutesInput("0")).toBe(0)
    expect(parseTaskTrackedMinutesInput("1.5")).toBeUndefined()
    expect(parseTaskTrackedMinutesInput("-1")).toBeUndefined()
  })

  it("parses flexible minute and hour inputs", () => {
    expect(parseFlexibleMinutes("100")).toBe(100)
    expect(parseFlexibleMinutes("0")).toBe(0)
    expect(parseFlexibleMinutes("30m")).toBe(30)
    expect(parseFlexibleMinutes("1h")).toBe(60)
    expect(parseFlexibleMinutes("1.5h")).toBe(90)
    expect(parseFlexibleMinutes("1h 30m")).toBe(90)
    expect(parseFlexibleMinutes("2h 15m")).toBe(135)
    expect(parseFlexibleMinutes("invalid")).toBeUndefined()
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
