import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), "utf8")
}

function listTsx(directory: string): string[] {
  const absolute = path.join(root, directory)
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name)
    if (entry.isDirectory()) return listTsx(relative)
    return entry.isFile() && entry.name.endsWith(".tsx") ? [relative] : []
  })
}

function run() {
  const header = read("components/layout/app-page-header.tsx")
  assert.match(header, /data-slot="app-page-header"/)
  assert.match(header, /primaryAction\?: React\.ReactNode/)
  assert.match(header, /mobilePrimaryAction\?: React\.ReactNode/)
  assert.match(header, /controls\?: React\.ReactNode/)
  assert.match(header, /footer\?: React\.ReactNode/)

  const surface = read("components/ui/app-surface.tsx")
  assert.match(surface, /export function SectionCard/)
  assert.match(surface, /export function StatCard/)
  assert.match(surface, /label: string/)
  assert.match(surface, /aria-label=\{label\}/)

  const requiredHeaderSources = [
    "app/(dashboard)/page.tsx",
    "app/(dashboard)/tasks/page.tsx",
    "app/(dashboard)/projects/page.tsx",
    "app/(dashboard)/payments/page.tsx",
    "app/(dashboard)/analytics/page.tsx",
    "app/(dashboard)/ledger/page.tsx",
    "app/(dashboard)/vault/page.tsx",
    "app/(dashboard)/settings/settings-content.tsx",
    "app/(dashboard)/lms-analysis/layout.tsx",
    "components/ppc/google-ads-dashboard.tsx",
  ]
  for (const filePath of requiredHeaderSources) {
    assert.match(read(filePath), /AppPageHeader/, `${filePath} must use AppPageHeader`)
  }

  const applicationSources = [...listTsx("app"), ...listTsx("components")]
  for (const filePath of applicationSources) {
    const source = read(filePath)
    assert.doesNotMatch(source, /text-\[(?:8|9|10|11)px\]/, `${filePath} contains functional text below 12px`)
  }

  const sidebar = read("components/layout/sidebar.tsx")
  assert.match(sidebar, /role="tooltip"/)
  assert.match(sidebar, /<DropdownMenuContent side="right" align="start"/)
  assert.doesNotMatch(sidebar, /onFocusCapture=/)

  const mobileNav = read("components/layout/mobile-bottom-nav.tsx")
  assert.match(mobileNav, /inline-flex h-11 w-11[\s\S]*?aria-label="Quick actions"/)

  process.stdout.write("verify-design-system: ok\n")
}

run()
