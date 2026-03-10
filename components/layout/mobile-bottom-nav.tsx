"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Briefcase, CheckCircle2, FolderPlus, Home, Menu, Plus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useHeader } from "@/components/layout/header-context"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { GlobalCreateTaskDialog, type TaskDialogProject } from "@/components/tasks/global-create-task-dialog"
import type { PartnerWithSites } from "@/types"
import type { Service } from "@prisma/client"

type MobileBottomNavProps = {
    quickActionPartners: PartnerWithSites[]
    quickActionServices: Service[]
    quickActionProjects: TaskDialogProject[]
}

function isActivePath(pathname: string, href: string) {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({
    href,
    label,
    icon: Icon,
    active,
}: {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
    active: boolean
}) {
    return (
        <Link
            href={href}
            className={cn(
                "inline-flex h-[58px] flex-col items-center justify-center gap-1 rounded-xl transition-all",
                active ? "text-[#2563EB]" : "text-slate-400 hover:text-slate-600"
            )}
        >
            <Icon className={cn("h-5 w-5", active && "scale-105")} strokeWidth={1.7} />
            <span
                className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.08em]",
                    active ? "text-[#2563EB]" : "text-slate-500"
                )}
            >
                {label}
            </span>
        </Link>
    )
}

export function MobileBottomNav({
    quickActionPartners,
    quickActionServices,
    quickActionProjects,
}: MobileBottomNavProps) {
    const pathname = usePathname()
    const { setIsMobileMenuOpen } = useHeader()
    const [quickActionsOpen, setQuickActionsOpen] = React.useState(false)
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)

    return (
        <>
            <nav
                className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/92 backdrop-blur-[10px] md:hidden"
                aria-label="Mobile navigation"
            >
                <div className="relative px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-2">
                    <button
                        type="button"
                        onClick={() => setQuickActionsOpen(true)}
                        className="absolute left-1/2 top-1/2 z-10 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#1D4ED8] bg-[#2563EB] text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.85)] transition-transform active:scale-[0.97]"
                        aria-label="Quick actions"
                    >
                        <Plus className="h-6 w-6" strokeWidth={2.3} />
                    </button>

                    <div className="grid grid-cols-5 gap-1">
                        <NavLink href="/" label="Home" icon={Home} active={isActivePath(pathname, "/")} />
                        <NavLink href="/tasks" label="Tasks" icon={CheckCircle2} active={isActivePath(pathname, "/tasks")} />
                        <div aria-hidden="true" />
                        <NavLink href="/projects" label="Projects" icon={Briefcase} active={isActivePath(pathname, "/projects")} />
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="inline-flex h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-slate-500 transition-colors hover:text-slate-700"
                            aria-label="Open menu"
                        >
                            <Menu className="h-5 w-5" strokeWidth={1.7} />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Menu</span>
                        </button>
                    </div>
                </div>
            </nav>

            <Sheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
                <SheetContent
                    side="bottom"
                    showCloseButton={false}
                    className="rounded-t-[20px] border-x-0 border-b-0 border-t border-slate-200 bg-white/96 p-0 backdrop-blur-[8px]"
                >
                    <SheetTitle className="sr-only">Quick actions</SheetTitle>
                    <div className="p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3">
                        <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />
                        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                            Quick Actions
                        </p>

                        <button
                            type="button"
                            onClick={() => {
                                setQuickActionsOpen(false)
                                setCreateTaskOpen(true)
                            }}
                            className="w-full rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3.5 text-left transition-colors hover:bg-[#DBEAFE]"
                        >
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1D4ED8]">
                                <Sparkles className="h-4 w-4" />
                                Add Task
                            </span>
                            <p className="mt-1 text-xs text-slate-500">Create a task from anywhere in the app.</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setQuickActionsOpen(false)
                                setCreateProjectOpen(true)
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
                        >
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <FolderPlus className="h-4 w-4 text-[#2563EB]" />
                                Add Project
                            </span>
                            <p className="mt-1 text-xs text-slate-500">Start a new project with partner, domain and services.</p>
                        </button>
                    </div>
                </SheetContent>
            </Sheet>

            <GlobalCreateTaskDialog
                open={createTaskOpen}
                onOpenChange={setCreateTaskOpen}
                projects={quickActionProjects}
            />
            <GlobalCreateProjectDialog
                open={createProjectOpen}
                onOpenChange={setCreateProjectOpen}
                partners={quickActionPartners}
                services={quickActionServices}
            />
        </>
    )
}
