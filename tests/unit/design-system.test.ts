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
})
