import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

describe("desktop sidebar navigation", () => {
  it("defaults new browser profiles to the collapsed sidebar", () => {
    const source = read("components/layout/header-context.tsx")

    expect(source).toContain('const SIDEBAR_COLLAPSED_STORAGE_KEY = "ui:sidebar-collapsed-v2"')
    expect(source).toContain('return storedValue === null ? true : storedValue === "1"')
    expect(source).toContain("const getServerSidebarCollapsedSnapshot = () => true")
  })

  it("opens grouped navigation from an icon-only sidebar", () => {
    const sidebar = read("components/layout/sidebar.tsx")
    const shell = read("components/layout/shell-frame.tsx")

    expect(sidebar).toContain("if (isDesktopCollapsed)")
    expect(sidebar).toContain('aria-label={`Open ${label} menu`}')
    expect(sidebar).toContain('<DropdownMenuContent side="right" align="start"')
    expect(sidebar).toContain('renderDesktopGroup("LMS Analysis"')
    expect(sidebar).not.toContain("onFocusCapture=")
    expect(shell).toContain("const isDesktopCollapsed = isSidebarCollapsed")
  })
})
