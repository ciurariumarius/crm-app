import { describe, expect, it } from "vitest"
import {
  MAX_TASK_ESTIMATED_MINUTES,
  formatTaskEstimatedMinutes,
  parseTaskEstimatedMinutesInput,
} from "@/lib/tasks/estimated-time"

describe("task planned time input", () => {
  it("accepts blank or valid whole minutes", () => {
    expect(parseTaskEstimatedMinutesInput("")).toBeNull()
    expect(parseTaskEstimatedMinutesInput("  ")).toBeNull()
    expect(parseTaskEstimatedMinutesInput("1")).toBe(1)
    expect(parseTaskEstimatedMinutesInput("60")).toBe(60)
    expect(parseTaskEstimatedMinutesInput(String(MAX_TASK_ESTIMATED_MINUTES))).toBe(MAX_TASK_ESTIMATED_MINUTES)
  })

  it("formats task estimates compactly for cards", () => {
    expect(formatTaskEstimatedMinutes(null)).toBeNull()
    expect(formatTaskEstimatedMinutes(15)).toBe("15m")
    expect(formatTaskEstimatedMinutes(60)).toBe("1h")
    expect(formatTaskEstimatedMinutes(90)).toBe("1h 30m")
  })

  it.each(["0", "-1", "1.5", "abc", String(MAX_TASK_ESTIMATED_MINUTES + 1)])(
    "rejects invalid value %s",
    (value) => {
      expect(parseTaskEstimatedMinutesInput(value)).toBeUndefined()
    }
  )
})
