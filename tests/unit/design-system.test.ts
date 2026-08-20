import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { statusToneFromLabel } from "@/components/ui/status-chip"

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

describe("design system contracts", () => {
  it("keeps payment and workflow status tones semantically distinct", () => {
    expect(statusToneFromLabel("Paid")).toBe("paid")
    expect(statusToneFromLabel("Unpaid")).toBe("unpaid")
    expect(statusToneFromLabel("Active")).toBe("active")
    expect(statusToneFromLabel("Urgent")).toBe("urgent")
  })

  it("requires accessible labels for the shared icon button", () => {
    const source = read("components/ui/app-surface.tsx")
    expect(source).toContain("label: string")
    expect(source).toContain("aria-label={label}")
  })

  it("uses one owned surface for the shared page header", () => {
    const source = read("components/layout/app-page-header.tsx")
    expect(source).toContain('data-slot="app-page-header"')
    expect(source.match(/<header/g)).toHaveLength(1)
  })

  it("keeps task and project sidebars focused with accessible tabs", () => {
    const primitives = read("components/ui/side-panel-primitives.tsx")
    const taskSidebar = read("components/tasks/task-details.tsx")
    const projectSidebar = read("components/projects/project-sheet-content.tsx")

    expect(primitives).toContain('role="tablist"')
    expect(primitives).toContain('role="tab"')
    expect(primitives).toContain('event.key === "ArrowRight"')
    expect(primitives).toContain('event.key === "ArrowLeft"')
    expect(taskSidebar).toContain('{ value: "overview", label: "Overview" }')
    expect(taskSidebar).toContain('{ value: "notes", label: "Notes" }')
    expect(taskSidebar).toContain('{ value: "time", label: "Time" }')
    expect(taskSidebar).toContain('{ value: "activity", label: "Activity" }')
    expect(projectSidebar).toContain('{ value: "tasks", label: "Tasks"')
    expect(projectSidebar).toContain('ariaLabel="Project details"')
    expect(taskSidebar).not.toContain("<SidePanelMetaBar")
    expect(projectSidebar).not.toContain("<SidePanelMetaBar")
  })

  it("separates task detail, title, and note save payloads", () => {
    const taskSidebar = read("components/tasks/task-details.tsx")
    expect(taskSidebar).toContain("const persistTaskDescription")
    expect(taskSidebar).toContain("const commitTitle = async")
    expect(taskSidebar).toContain("const updateSnapshot = {")
    expect(taskSidebar).toMatch(/const updateSnapshot = \{\s*urgency,/)
    expect(taskSidebar).toContain("Discard unsaved task detail changes?")
    expect(taskSidebar).not.toContain("Discard unsaved project detail changes?")
  })
})
