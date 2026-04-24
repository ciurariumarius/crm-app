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
                "relative inline-flex h-[56px] flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-1 transition-colors",
                active
                    ? "border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_95%,var(--surface-low)_5%)] text-[var(--primary)] shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
            aria-current={active ? "page" : undefined}
        >
            <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
            <span
                className={cn(
                    "text-[10px] font-medium tracking-[0.03em]",
                    active ? "text-[var(--primary)]" : "text-[var(--text-secondary)]"
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
    const homeActive = isActivePath(pathname, "/")
    const tasksActive = isActivePath(pathname, "/tasks")
    const projectsActive = isActivePath(pathname, "/projects")
    const menuActive = !homeActive && !tasksActive && !projectsActive
    const { setIsMobileMenuOpen } = useHeader()
    const [quickActionsOpen, setQuickActionsOpen] = React.useState(false)
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)
    const [isDockHidden, setIsDockHidden] = React.useState(false)
    const lastScrollYRef = React.useRef(0)
    const directionalTravelRef = React.useRef(0)
    const lastDirectionRef = React.useRef<"up" | "down" | null>(null)
    const touchStartYRef = React.useRef<number | null>(null)
    const appScrollContainerRef = React.useRef<HTMLElement | null>(null)
    const HIDE_MIN_SCROLL = 72
    const HIDE_DISTANCE = 26
    const SHOW_DISTANCE = 16

    React.useEffect(() => {
        appScrollContainerRef.current = document.getElementById("app-scroll-container")
    }, [])

    React.useEffect(() => {
        const currentY = Math.max(
            appScrollContainerRef.current?.scrollTop ?? 0,
            window.scrollY ?? 0,
            document.documentElement?.scrollTop ?? 0
        )
        setIsDockHidden(false)
        lastScrollYRef.current = currentY
        directionalTravelRef.current = 0
        lastDirectionRef.current = null
        touchStartYRef.current = null
    }, [pathname])

    React.useEffect(() => {
        const getFallbackY = () =>
            Math.max(
                appScrollContainerRef.current?.scrollTop ?? 0,
                window.scrollY ?? 0,
                document.documentElement?.scrollTop ?? 0
            )

        const getScrollableTargetY = (target: EventTarget | null) => {
            if (target && target instanceof HTMLElement && target.scrollHeight > target.clientHeight + 1) {
                return target.scrollTop
            }
            return 0
        }

        const handleScroll = (currentY: number) => {
            const delta = currentY - lastScrollYRef.current

            if (currentY <= 20) {
                setIsDockHidden(false)
                lastScrollYRef.current = currentY
                directionalTravelRef.current = 0
                lastDirectionRef.current = null
                return
            }

            if (Math.abs(delta) < 0.5) {
                return
            }

            const direction: "up" | "down" = delta > 0 ? "down" : "up"
            if (lastDirectionRef.current !== direction) {
                directionalTravelRef.current = 0
                lastDirectionRef.current = direction
            }

            directionalTravelRef.current += Math.abs(delta)

            if (
                direction === "down" &&
                currentY > HIDE_MIN_SCROLL &&
                directionalTravelRef.current >= HIDE_DISTANCE
            ) {
                setIsDockHidden(true)
                directionalTravelRef.current = 0
            } else if (
                direction === "up" &&
                directionalTravelRef.current >= SHOW_DISTANCE
            ) {
                setIsDockHidden(false)
                directionalTravelRef.current = 0
            }

            lastScrollYRef.current = currentY
        }

        const onContainerScroll = () => {
            handleScroll(appScrollContainerRef.current?.scrollTop ?? getFallbackY())
        }

        const onWindowScroll = () => {
            handleScroll(getFallbackY())
        }

        const onDocumentScrollCapture = (event: Event) => {
            const y = Math.max(getFallbackY(), getScrollableTargetY(event.target))
            handleScroll(y)
        }

        const onWheel = (event: WheelEvent) => {
            if (event.deltaY > 6) {
                const currentY = getFallbackY()
                if (currentY > HIDE_MIN_SCROLL) {
                    setIsDockHidden(true)
                }
            } else if (event.deltaY < -6) {
                setIsDockHidden(false)
            }
        }

        const onTouchStart = (event: TouchEvent) => {
            touchStartYRef.current = event.touches[0]?.clientY ?? null
        }

        const onTouchMove = (event: TouchEvent) => {
            const startY = touchStartYRef.current
            const currentY = event.touches[0]?.clientY
            if (startY === null || currentY === undefined) return
            const delta = startY - currentY
            if (delta > 8) {
                const fallbackY = getFallbackY()
                if (fallbackY > HIDE_MIN_SCROLL) {
                    setIsDockHidden(true)
                }
            } else if (delta < -8) {
                setIsDockHidden(false)
            }
            touchStartYRef.current = currentY
        }

        const scrollContainer = appScrollContainerRef.current
        if (scrollContainer) {
            scrollContainer.addEventListener("scroll", onContainerScroll, { passive: true })
        }

        window.addEventListener("scroll", onWindowScroll, { passive: true })
        document.addEventListener("scroll", onDocumentScrollCapture, { passive: true, capture: true })
        window.addEventListener("wheel", onWheel, { passive: true })
        window.addEventListener("touchstart", onTouchStart, { passive: true })
        window.addEventListener("touchmove", onTouchMove, { passive: true })

        return () => {
            if (scrollContainer) {
                scrollContainer.removeEventListener("scroll", onContainerScroll)
            }
            window.removeEventListener("scroll", onWindowScroll)
            document.removeEventListener("scroll", onDocumentScrollCapture, true)
            window.removeEventListener("wheel", onWheel)
            window.removeEventListener("touchstart", onTouchStart)
            window.removeEventListener("touchmove", onTouchMove)
        }
    }, [HIDE_DISTANCE, HIDE_MIN_SCROLL, SHOW_DISTANCE])

    React.useEffect(() => {
        if (quickActionsOpen || createProjectOpen || createTaskOpen) {
            setIsDockHidden(false)
        }
    }, [createProjectOpen, createTaskOpen, quickActionsOpen])

    return (
        <>
            <nav
                className={cn(
                    "pointer-events-none fixed inset-x-0 bottom-[max(0.35rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3 transition-all duration-300 md:hidden",
                    isDockHidden ? "translate-y-[120%] opacity-0" : "translate-y-0 opacity-100"
                )}
                aria-label="Mobile navigation"
            >
                <div className="pointer-events-auto relative w-full max-w-[430px] rounded-[22px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,transparent)] shadow-[0_14px_26px_-18px_rgba(15,23,42,0.42)] backdrop-blur-[12px]">
                    <button
                        type="button"
                        onClick={() => setQuickActionsOpen(true)}
                        className="absolute left-1/2 top-1/2 z-20 inline-flex h-9 w-9 -translate-x-1/2 -translate-y-[52%] items-center justify-center rounded-full border border-primary/35 bg-primary text-primary-foreground shadow-[0_10px_20px_-10px_color-mix(in_srgb,var(--primary)_70%,transparent),0_4px_12px_-6px_rgba(15,23,42,0.35)] transition-transform active:scale-[0.97]"
                        aria-label="Quick actions"
                    >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>

                    <div className="grid grid-cols-5 gap-1 px-1.5 pb-[max(0.3rem,env(safe-area-inset-bottom))] pt-2">
                        <NavLink href="/" label="Home" icon={Home} active={homeActive} />
                        <NavLink href="/tasks" label="Tasks" icon={CheckCircle2} active={tasksActive} />
                        <div aria-hidden="true" />
                        <NavLink href="/projects" label="Projects" icon={Briefcase} active={projectsActive} />
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(true)}
                            className={cn(
                                "relative inline-flex h-[56px] flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-1 transition-colors",
                                menuActive
                                    ? "border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_95%,var(--surface-low)_5%)] text-[var(--primary)] shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)]"
                                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            )}
                            aria-label="Open menu"
                            aria-current={menuActive ? "page" : undefined}
                        >
                            <Menu className="h-4.5 w-4.5" strokeWidth={1.9} />
                            <span
                                className={cn(
                                    "text-[10px] font-medium tracking-[0.03em]",
                                    menuActive ? "text-[var(--primary)]" : "text-[var(--text-secondary)]"
                                )}
                            >
                                Menu
                            </span>
                        </button>
                    </div>
                </div>
            </nav>

            <Sheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
                <SheetContent
                    side="bottom"
                    showCloseButton={false}
                    className="rounded-t-[20px] border-x-0 border-b-0 border-t border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,transparent)] p-0 backdrop-blur-[8px]"
                >
                    <SheetTitle className="sr-only">Quick actions</SheetTitle>
                    <div className="p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3">
                        <div className="mx-auto h-1.5 w-10 rounded-full bg-[var(--line-subtle)]" />
                        <p className="text-center text-[12px] font-medium tracking-[0.04em] text-[var(--text-secondary)]">
                            Quick Actions
                        </p>

                        <button
                            type="button"
                            onClick={() => {
                                setQuickActionsOpen(false)
                                setCreateTaskOpen(true)
                            }}
                            className="w-full rounded-2xl border border-[color:color-mix(in_srgb,var(--primary-container)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--primary-container)_16%,var(--surface-lowest))] px-4 py-3.5 text-left transition-colors hover:bg-[color:color-mix(in_srgb,var(--primary-container)_24%,var(--surface-lowest))]"
                        >
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
                                <Sparkles className="h-4 w-4" />
                                Add Task
                            </span>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">Create a task from anywhere in the app.</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setQuickActionsOpen(false)
                                setCreateProjectOpen(true)
                            }}
                            className="w-full rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-3.5 text-left transition-colors hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)]"
                        >
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                                <FolderPlus className="h-4 w-4 text-[var(--primary)]" />
                                Add Project
                            </span>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">Start a new project with partner, domain and services.</p>
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
