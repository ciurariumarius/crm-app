"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const moduleLinks = [
  { label: "Tasks", href: "/lms-analysis/work-log" },
  { label: "Tasks Analysis", href: "/lms-analysis/tasks" },
  { label: "Projects", href: "/lms-analysis/projects" },
  { label: "Settings", href: "/lms-analysis/data" },
] as const

function isActivePath(pathname: string, href: string) {
  if (href === "/lms-analysis") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function LmsTasksModuleNav() {
  const pathname = usePathname()

  return (
    <nav className="overflow-x-auto rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-2">
      <div className="flex min-w-max items-center gap-2">
        {moduleLinks.map((item) => {
          const isActive = isActivePath(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold tracking-[0.01em] transition-colors",
                isActive
                  ? "bg-[color:color-mix(in_srgb,var(--primary-container)_36%,var(--surface-lowest))] text-[var(--primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)] hover:text-[var(--text-primary)]"
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
