"use client"

import * as React from "react"
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { useRouter } from "next/navigation"
import {
    globalSearch,
    type GlobalSearchResults,
} from "@/lib/actions/search"
import {
    ArrowRight,
    BarChart3,
    CheckCircle2,
    Clock,
    CreditCard,
    FolderDot,
    FolderPlus,
    Globe,
    History,
    LayoutGrid,
    ListChecks,
    Loader2,
    NotebookPen,
    PlusCircle,
    Search,
    Settings,
    Sparkles,
    SquarePen,
    User,
    UserPlus,
    Users,
} from "lucide-react"
import { useDebounce } from "react-use"
import { cn, formatProjectName } from "@/lib/utils"

const RECENT_SEARCHES_KEY = "pixelist_recent_searches"
const MAX_RECENTS = 6

type RecentItem = {
    id: string
    title: string
    subtitle?: string | null
    type: "project" | "task" | "partner" | "note" | "site" | "action" | "page"
    href: string
    timestamp: number
}

type QuickAction = {
    id: string
    name: string
    description: string
    icon: React.ElementType
    iconBg: string
    href: string
    keywords: string[]
    shortcut?: string
}

type NavigationPage = {
    id: string
    name: string
    category: string
    description: string
    icon: React.ElementType
    href: string
    keywords: string[]
}

const QUICK_ACTIONS: QuickAction[] = [
    {
        id: "action-new-note",
        name: "Create New Note",
        description: "Open notes workspace and start a blank note",
        icon: SquarePen,
        iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        href: "/notes?new=1",
        keywords: ["note", "memo", "doc", "write", "create", "new"],
        shortcut: "⌘N",
    },
    {
        id: "action-new-task",
        name: "Create New Task",
        description: "Go to tasks board to create a new task",
        icon: PlusCircle,
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        href: "/tasks",
        keywords: ["task", "todo", "create", "new", "add"],
        shortcut: "⌘T",
    },
    {
        id: "action-new-project",
        name: "Create New Project",
        description: "Add a client project with services and retainers",
        icon: FolderPlus,
        iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        href: "/projects",
        keywords: ["project", "client", "site", "create", "new"],
    },
    {
        id: "action-new-partner",
        name: "Add New Partner",
        description: "Register a partner or client profile",
        icon: UserPlus,
        iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
        href: "/partners",
        keywords: ["partner", "client", "customer", "business", "create", "new"],
    },
    {
        id: "action-lms-entry",
        name: "LMS Work Entries",
        description: "Log hours and task work in LMS analysis",
        icon: Clock,
        iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        href: "/lms-analysis/tasks",
        keywords: ["lms", "work", "log", "time", "hours", "task"],
    },
]

const NAVIGATION_PAGES: NavigationPage[] = [
    {
        id: "nav-overview",
        name: "Overview",
        category: "Dashboard",
        description: "Business revenue, active tasks & LMS capacity",
        icon: LayoutGrid,
        href: "/",
        keywords: ["home", "overview", "dashboard", "stats"],
    },
    {
        id: "nav-tasks",
        name: "Tasks",
        category: "Work",
        description: "Task board, card view, and sprint status",
        icon: CheckCircle2,
        href: "/tasks",
        keywords: ["tasks", "todo", "board", "urgent"],
    },
    {
        id: "nav-notes",
        name: "Notes",
        category: "Workspace",
        description: "Apple Notes-style rich workspace & folders",
        icon: NotebookPen,
        href: "/notes",
        keywords: ["notes", "docs", "scratchpad", "folders"],
    },
    {
        id: "nav-projects",
        name: "Projects",
        category: "Clients",
        description: "Client projects, recurring retainers & status",
        icon: FolderDot,
        href: "/projects",
        keywords: ["projects", "clients", "retainers", "services"],
    },
    {
        id: "nav-partners",
        name: "Partners",
        category: "Directory",
        description: "Client profiles, domains, billing details",
        icon: Users,
        href: "/partners",
        keywords: ["partners", "contacts", "emails", "clients"],
    },
    {
        id: "nav-payments",
        name: "Payments & Revenue",
        category: "Finance",
        description: "Revenue analysis, invoices, and unpaid items",
        icon: CreditCard,
        href: "/payments",
        keywords: ["payments", "revenue", "money", "unpaid", "invoices", "bank"],
    },
    {
        id: "nav-lms",
        name: "LMS Analysis",
        category: "Capacity",
        description: "Work hours, employee logs, capacity tracking",
        icon: BarChart3,
        href: "/lms-analysis",
        keywords: ["lms", "hours", "capacity", "employee", "work"],
    },
    {
        id: "nav-time",
        name: "Time Tracking",
        category: "Productivity",
        description: "Live stopwatch and tracked task time logs",
        icon: Clock,
        href: "/time",
        keywords: ["time", "stopwatch", "timer", "tracking"],
    },
    {
        id: "nav-vault",
        name: "Vault & Sites",
        category: "Assets",
        description: "Domains, Google Tag Manager IDs & brand notes",
        icon: Globe,
        href: "/vault",
        keywords: ["vault", "sites", "domains", "gtm", "ads"],
    },
    {
        id: "nav-settings",
        name: "Settings",
        category: "System",
        description: "Workspace preferences and database backup",
        icon: Settings,
        href: "/settings",
        keywords: ["settings", "preferences", "config", "backup"],
    },
]

interface GlobalSearchProps {
    mobileMode?: "icon" | "full"
    desktopTriggerClassName?: string
}

export function GlobalSearch({ mobileMode = "icon", desktopTriggerClassName }: GlobalSearchProps) {
    const router = useRouter()
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<GlobalSearchResults>({
        projects: [],
        tasks: [],
        partners: [],
        notes: [],
        sites: [],
    })
    const [recents, setRecents] = React.useState<RecentItem[]>([])
    const [loading, setLoading] = React.useState(false)
    const [failed, setFailed] = React.useState(false)

    // Load recent searches from localStorage
    React.useEffect(() => {
        if (!open) return
        try {
            const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) {
                    setRecents(parsed.slice(0, MAX_RECENTS))
                }
            }
        } catch {}
    }, [open])

    // Keyboard shortcut ⌘K / Ctrl+K
    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((prev) => !prev)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    useDebounce(
        async () => {
            const normalizedQuery = query.trim()
            if (normalizedQuery.length < 2) {
                setResults({ projects: [], tasks: [], partners: [], notes: [], sites: [] })
                setFailed(false)
                setLoading(false)
                return
            }

            setLoading(true)
            setFailed(false)
            try {
                const searchResults = await globalSearch(normalizedQuery)
                setResults(searchResults)
            } catch (error) {
                console.error(error)
                setResults({ projects: [], tasks: [], partners: [], notes: [], sites: [] })
                setFailed(true)
            } finally {
                setLoading(false)
            }
        },
        250,
        [query]
    )

    const normalizedQuery = query.trim().toLowerCase()

    const saveRecentItem = React.useCallback((item: Omit<RecentItem, "timestamp">) => {
        try {
            const newItem: RecentItem = { ...item, timestamp: Date.now() }
            const existingRaw = localStorage.getItem(RECENT_SEARCHES_KEY)
            const existing: RecentItem[] = existingRaw ? JSON.parse(existingRaw) : []
            const filtered = existing.filter((r) => r.href !== item.href)
            const updated = [newItem, ...filtered].slice(0, MAX_RECENTS)
            localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
            setRecents(updated)
        } catch {}
    }, [])

    const handleClearRecents = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        try {
            localStorage.removeItem(RECENT_SEARCHES_KEY)
            setRecents([])
        } catch {}
    }, [])

    const handleSelect = React.useCallback((item: {
        id: string
        title: string
        subtitle?: string | null
        type: RecentItem["type"]
        href: string
    }) => {
        saveRecentItem(item)
        setOpen(false)
        setQuery("")
        router.push(item.href)
    }, [router, saveRecentItem])

    // Filter Quick Actions & Navigation pages in real-time
    const filteredActions = React.useMemo(() => {
        if (!normalizedQuery) return QUICK_ACTIONS
        return QUICK_ACTIONS.filter((action) => {
            const nameMatch = action.name.toLowerCase().includes(normalizedQuery)
            const descMatch = action.description.toLowerCase().includes(normalizedQuery)
            const kwMatch = action.keywords.some((kw) => kw.includes(normalizedQuery))
            return nameMatch || descMatch || kwMatch
        })
    }, [normalizedQuery])

    const filteredPages = React.useMemo(() => {
        if (!normalizedQuery) return NAVIGATION_PAGES
        return NAVIGATION_PAGES.filter((page) => {
            const nameMatch = page.name.toLowerCase().includes(normalizedQuery)
            const descMatch = page.description.toLowerCase().includes(normalizedQuery)
            const catMatch = page.category.toLowerCase().includes(normalizedQuery)
            const kwMatch = page.keywords.some((kw) => kw.includes(normalizedQuery))
            return nameMatch || descMatch || catMatch || kwMatch
        })
    }, [normalizedQuery])

    const totalServerResults =
        results.projects.length +
        results.tasks.length +
        results.notes.length +
        results.sites.length +
        results.partners.length

    const hasAnyResults =
        filteredActions.length > 0 ||
        filteredPages.length > 0 ||
        totalServerResults > 0

    return (
        <>
            {/* Desktop Trigger */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    "mx-auto hidden h-11 w-full max-w-[560px] items-center justify-between rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 text-[var(--text-muted)] shadow-[var(--shadow-apple)] transition-all hover:border-[color:color-mix(in_srgb,var(--line-subtle)_74%,var(--text-muted)_26%)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_20%,transparent)] focus-visible:ring-offset-0 md:flex group",
                    desktopTriggerClassName
                )}
                aria-label="Open command palette (⌘K)"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <Search className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                    <span className="min-w-0 truncate text-sm text-[var(--text-secondary)] font-medium">
                        Search projects, tasks, notes, partners, actions...
                    </span>
                </div>
                <kbd className="hidden h-5 select-none items-center gap-0.5 rounded border border-[var(--line-subtle)] bg-[var(--surface-low)] px-1.5 font-mono text-xs font-semibold text-[var(--text-muted)] lg:inline-flex">
                    ⌘K
                </kbd>
            </button>

            {/* Mobile Search Trigger */}
            {mobileMode === "full" ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex w-full items-center justify-between rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-3 text-left text-[var(--text-secondary)] shadow-sm transition-all hover:border-[color:color-mix(in_srgb,var(--line-subtle)_74%,var(--text-muted)_26%)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)] md:hidden"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                        <span className="min-w-0 truncate text-sm font-medium text-[var(--text-secondary)]">
                            Search or type command...
                        </span>
                    </div>
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-2 text-[var(--text-secondary)] shadow-sm hover:bg-[var(--surface-low)] md:hidden"
                    aria-label="Open search"
                >
                    <Search className="h-5 w-5" />
                </button>
            )}

            <CommandDialog
                open={open}
                onOpenChange={(nextOpen) => {
                    setOpen(nextOpen)
                    if (!nextOpen) setQuery("")
                }}
                shouldFilter={false}
            >
                <div className="relative">
                    <CommandInput
                        placeholder="Search projects, tasks, notes, partners, or type a command..."
                        value={query}
                        onValueChange={setQuery}
                        className="text-sm"
                    />
                    {loading && (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
                        </div>
                    )}
                </div>

                <CommandList className="max-h-[460px] overflow-y-auto px-2 py-2 notes-thin-scrollbar">
                    {/* Empty query: show Recent Searches (if any) */}
                    {!normalizedQuery && recents.length > 0 && (
                        <CommandGroup
                            heading={
                                <div className="flex items-center justify-between pr-2">
                                    <span className="flex items-center gap-1.5">
                                        <History className="h-3 w-3" /> Recent Searches
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleClearRecents}
                                        className="text-xs font-normal lowercase tracking-normal text-[var(--text-muted)] hover:text-[var(--state-urgent)] transition-colors"
                                    >
                                        clear
                                    </button>
                                </div>
                            }
                        >
                            {recents.map((item) => (
                                <CommandItem
                                    key={`recent-${item.id}-${item.href}`}
                                    onSelect={() => handleSelect(item)}
                                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-low)] text-[var(--text-muted)]">
                                            <History className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                                                {item.title}
                                            </span>
                                            {item.subtitle && (
                                                <span className="truncate text-xs text-[var(--text-muted)]">
                                                    {item.subtitle}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--surface-low)] px-2 py-0.5 rounded-md">
                                        {item.type}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Quick Actions (always visible on empty, or filtered when typing) */}
                    {filteredActions.length > 0 && (
                        <CommandGroup heading={<span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-amber-500" /> Quick Actions</span>}>
                            {filteredActions.map((action) => {
                                const Icon = action.icon
                                return (
                                    <CommandItem
                                        key={action.id}
                                        onSelect={() =>
                                            handleSelect({
                                                id: action.id,
                                                title: action.name,
                                                subtitle: action.description,
                                                type: "action",
                                                href: action.href,
                                            })
                                        }
                                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", action.iconBg)}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                                                    {action.name}
                                                </span>
                                                <span className="truncate text-xs text-[var(--text-muted)]">
                                                    {action.description}
                                                </span>
                                            </div>
                                        </div>
                                        {action.shortcut && (
                                            <kbd className="hidden h-5 select-none items-center rounded border border-[var(--line-subtle)] bg-[var(--surface-low)] px-1.5 font-mono text-xs font-semibold text-[var(--text-muted)] sm:inline-flex">
                                                {action.shortcut}
                                            </kbd>
                                        )}
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    )}

                    {/* Server Search Results: Projects */}
                    {!loading && results.projects.length > 0 && (
                        <CommandGroup heading="Projects">
                            {results.projects.map((project) => (
                                <CommandItem
                                    key={`proj-${project.id}`}
                                    onSelect={() =>
                                        handleSelect({
                                            id: project.id,
                                            title: formatProjectName(project),
                                            subtitle: project.site?.domainName ?? project.site?.partner?.name ?? "Project",
                                            type: "project",
                                            href: `/projects?projectId=${encodeURIComponent(project.id)}&status=All&page=1`,
                                        })
                                    }
                                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                            <FolderDot className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                    {formatProjectName(project)}
                                                </span>
                                                {project.status && (
                                                    <span className={cn(
                                                        "text-xs font-semibold px-1.5 py-0.5 rounded",
                                                        project.status === "Active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400"
                                                    )}>
                                                        {project.status}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="truncate text-xs text-[var(--text-muted)]">
                                                {project.site?.domainName ? `${project.site.domainName} · ` : ""}{project.site?.partner?.name || "No partner"}
                                            </span>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Server Search Results: Tasks */}
                    {!loading && results.tasks.length > 0 && (
                        <CommandGroup heading="Tasks">
                            {results.tasks.map((task) => (
                                <CommandItem
                                    key={`task-${task.id}`}
                                    onSelect={() =>
                                        handleSelect({
                                            id: task.id,
                                            title: task.name,
                                            subtitle: task.project?.name ? formatProjectName(task.project) : "Task",
                                            type: "task",
                                            href: `/tasks?taskId=${encodeURIComponent(task.id)}&status=All&page=1`,
                                        })
                                    }
                                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                            <ListChecks className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                    {task.name}
                                                </span>
                                                {task.urgency === "Urgent" && (
                                                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400">
                                                        Urgent
                                                    </span>
                                                )}
                                            </div>
                                            <span className="truncate text-xs text-[var(--text-muted)]">
                                                {task.project ? formatProjectName(task.project) : "Standalone task"}
                                            </span>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Server Search Results: Notes */}
                    {!loading && results.notes.length > 0 && (
                        <CommandGroup heading="Notes">
                            {results.notes.map((note) => (
                                <CommandItem
                                    key={`note-${note.id}`}
                                    onSelect={() =>
                                        handleSelect({
                                            id: note.id,
                                            title: note.title,
                                            subtitle: note.folderName ? `Folder: ${note.folderName}` : "Notes",
                                            type: "note",
                                            href: `/notes?note=${encodeURIComponent(note.id)}`,
                                        })
                                    }
                                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                            <NotebookPen className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                    {note.title}
                                                </span>
                                                {note.folderName && (
                                                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--surface-low)] text-[var(--text-muted)]">
                                                        {note.folderName}
                                                    </span>
                                                )}
                                            </div>
                                            {note.snippet && (
                                                <span className="truncate text-xs text-[var(--text-muted)] font-normal">
                                                    {note.snippet}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Server Search Results: Sites / Domains */}
                    {!loading && results.sites.length > 0 && (
                        <CommandGroup heading="Domains & Sites">
                            {results.sites.map((site) => (
                                <CommandItem
                                    key={`site-${site.id}`}
                                    onSelect={() =>
                                        handleSelect({
                                            id: site.id,
                                            title: site.domainName,
                                            subtitle: site.partnerName ? `Partner: ${site.partnerName}` : "Vault site",
                                            type: "site",
                                            href: `/vault?domain=${encodeURIComponent(site.domainName)}`,
                                        })
                                    }
                                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                                            <Globe className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                {site.domainName}
                                            </span>
                                            <span className="truncate text-xs text-[var(--text-muted)]">
                                                {site.partnerName ? `Partner: ${site.partnerName}` : "Site Vault"}
                                            </span>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Server Search Results: Partners */}
                    {!loading && results.partners.length > 0 && (
                        <CommandGroup heading="Partners">
                            {results.partners.map((partner) => (
                                <CommandItem
                                    key={`partner-${partner.id}`}
                                    onSelect={() =>
                                        handleSelect({
                                            id: partner.id,
                                            title: partner.name,
                                            subtitle: partner.businessName || partner.emailPrimary || "Partner",
                                            type: "partner",
                                            href: `/partners?partnerId=${encodeURIComponent(partner.id)}`,
                                        })
                                    }
                                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                {partner.name}
                                            </span>
                                            <span className="truncate text-xs text-[var(--text-muted)]">
                                                {partner.businessName || partner.emailPrimary || "Partner profile"}
                                            </span>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Navigation Pages */}
                    {filteredPages.length > 0 && (
                        <CommandGroup heading="Navigation">
                            {filteredPages.map((page) => {
                                const Icon = page.icon
                                return (
                                    <CommandItem
                                        key={page.id}
                                        onSelect={() =>
                                            handleSelect({
                                                id: page.id,
                                                title: page.name,
                                                subtitle: page.description,
                                                type: "page",
                                                href: page.href,
                                            })
                                        }
                                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-low)] text-[var(--text-secondary)]">
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                                                    {page.name}
                                                </span>
                                                <span className="truncate text-xs text-[var(--text-muted)]">
                                                    {page.description}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-xs text-[var(--text-muted)] font-mono">
                                            {page.href}
                                        </span>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    )}

                    {/* Empty states */}
                    {!loading && normalizedQuery.length >= 2 && !hasAnyResults && !failed && (
                        <CommandEmpty className="py-12 text-center">
                            <p className="text-sm font-medium text-[var(--text-secondary)]">
                                No results found for &ldquo;{query}&rdquo;
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                Try searching for a project name, task, note title, domain, partner, or command.
                            </p>
                        </CommandEmpty>
                    )}

                    {!loading && failed && (
                        <CommandEmpty className="py-8 text-center text-sm text-[var(--state-urgent)]">
                            Search is temporarily unavailable. Please try again.
                        </CommandEmpty>
                    )}
                </CommandList>

                <div className="flex items-center justify-between border-t border-[var(--line-subtle)] bg-[var(--surface-low)]/50 px-4 py-2 text-xs text-[var(--text-muted)]">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="rounded border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-1 py-0.5 font-mono text-xs">↑↓</kbd> navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="rounded border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-1 py-0.5 font-mono text-xs">↵</kbd> open
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="rounded border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-1 py-0.5 font-mono text-xs">esc</kbd> close
                        </span>
                    </div>
                    <span className="hidden sm:inline font-mono text-xs text-[var(--text-muted)]">
                        Spotlight Search
                    </span>
                </div>
            </CommandDialog>
        </>
    )
}

