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
    FolderDot,
    FolderPlus,
    Globe,
    History,
    ListChecks,
    Loader2,
    NotebookPen,
    PlusCircle,
    Search,
    Sparkles,
    SquarePen,
    User,
    UserPlus,
} from "lucide-react"
import { useDebounce } from "react-use"
import { cn, formatProjectName } from "@/lib/utils"

const RECENT_SEARCHES_KEY = "pixelist_recent_searches"
const MAX_RECENTS = 6

type RecentItem = {
    id: string
    title: string
    subtitle?: string | null
    type: "project" | "task" | "partner" | "note" | "site" | "action"
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
    },
    {
        id: "action-new-task",
        name: "Create New Task",
        description: "Go to tasks board to create a new task",
        icon: PlusCircle,
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        href: "/tasks",
        keywords: ["task", "todo", "create", "new", "add"],
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
                const res = await fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}`, {
                    headers: { Accept: "application/json" },
                    cache: "no-store",
                })
                if (res.ok) {
                    const data = await res.json()
                    if (data && data.success) {
                        setResults({
                            projects: Array.isArray(data.projects) ? data.projects : [],
                            tasks: Array.isArray(data.tasks) ? data.tasks : [],
                            partners: Array.isArray(data.partners) ? data.partners : [],
                            notes: Array.isArray(data.notes) ? data.notes : [],
                            sites: Array.isArray(data.sites) ? data.sites : [],
                        })
                        setFailed(false)
                        return
                    }
                }

                // Fallback to server action
                const searchResults = await globalSearch(normalizedQuery)
                setResults(searchResults)
                setFailed(false)
            } catch (error) {
                console.error("[global-search] error fetching search results", error)
                try {
                    const fallbackResults = await globalSearch(normalizedQuery)
                    setResults(fallbackResults)
                    setFailed(false)
                } catch {
                    setResults({ projects: [], tasks: [], partners: [], notes: [], sites: [] })
                    setFailed(true)
                }
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

    // Filter Quick Actions in real-time
    const filteredActions = React.useMemo(() => {
        if (!normalizedQuery) return QUICK_ACTIONS
        return QUICK_ACTIONS.filter((action) => {
            const nameMatch = action.name.toLowerCase().includes(normalizedQuery)
            const descMatch = action.description.toLowerCase().includes(normalizedQuery)
            const kwMatch = action.keywords.some((kw) => kw.includes(normalizedQuery))
            return nameMatch || descMatch || kwMatch
        })
    }, [normalizedQuery])

    const totalServerResults =
        results.projects.length +
        results.tasks.length +
        results.notes.length +
        results.sites.length +
        results.partners.length

    const hasAnyResults = filteredActions.length > 0 || totalServerResults > 0

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
                aria-label="Open search (⌘K)"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <Search className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                    <span className="min-w-0 truncate text-sm text-[var(--text-secondary)] font-medium">
                        Search projects, tasks, notes, partners...
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
                            Search...
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
                dialogClassName="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl"
            >
                <div className="relative">
                    <CommandInput
                        placeholder="Search projects, tasks, notes, partners, domains..."
                        value={query}
                        onValueChange={setQuery}
                        className="text-base"
                    />
                    {loading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
                        </div>
                    )}
                </div>

                <CommandList className="max-h-[580px] sm:max-h-[640px] overflow-y-auto px-3 py-3 notes-thin-scrollbar">
                    {/* Empty query: show Recent Searches (if any) */}
                    {!normalizedQuery && recents.length > 0 && (
                        <CommandGroup
                            heading={
                                <div className="flex items-center justify-between pr-2">
                                    <span className="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider">
                                        <History className="h-3.5 w-3.5" /> Recent Searches
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleClearRecents}
                                        className="text-xs font-normal lowercase tracking-normal text-[var(--text-muted)] hover:text-[var(--state-urgent)] transition-colors cursor-pointer"
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
                                    className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-low)] text-[var(--text-muted)]">
                                            <History className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                {item.title}
                                            </span>
                                            {item.subtitle && (
                                                <span className="truncate text-xs text-[var(--text-muted)]">
                                                    {item.subtitle}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--surface-low)] px-2.5 py-1 rounded-md">
                                        {item.type}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Quick Actions */}
                    {filteredActions.length > 0 && (
                        <CommandGroup heading={<span className="flex items-center gap-1.5 font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider"><Sparkles className="h-3.5 w-3.5 text-amber-500" /> Quick Actions</span>}>
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
                                        className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", action.iconBg)}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                    {action.name}
                                                </span>
                                                <span className="truncate text-xs text-[var(--text-muted)]">
                                                    {action.description}
                                                </span>
                                            </div>
                                        </div>
                                        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    )}

                    {/* Server Search Results: Projects */}
                    {!loading && results.projects.length > 0 && (
                        <CommandGroup heading={<span className="font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider">Projects</span>}>
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
                                    className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                            <FolderDot className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                    {formatProjectName(project)}
                                                </span>
                                                {project.status && (
                                                    <span className={cn(
                                                        "text-xs font-semibold px-2 py-0.5 rounded-md",
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
                                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Server Search Results: Tasks */}
                    {!loading && results.tasks.length > 0 && (
                        <CommandGroup heading={<span className="font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider">Tasks</span>}>
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
                                    className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                            <ListChecks className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                    {task.name}
                                                </span>
                                                {task.urgency === "Urgent" && (
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-red-500/15 text-red-600 dark:text-red-400">
                                                        Urgent
                                                    </span>
                                                )}
                                            </div>
                                            <span className="truncate text-xs text-[var(--text-muted)]">
                                                {task.project ? formatProjectName(task.project) : "Standalone task"}
                                            </span>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Server Search Results: Notes */}
                    {!loading && results.notes.length > 0 && (
                        <CommandGroup heading={<span className="font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider">Notes</span>}>
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
                                    className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                            <NotebookPen className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                                    {note.title}
                                                </span>
                                                {note.folderName && (
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[var(--surface-low)] text-[var(--text-muted)]">
                                                        {note.folderName}
                                                    </span>
                                                )}
                                            </div>
                                            {note.snippet && (
                                                <span className="truncate text-xs text-[var(--text-muted)] font-normal mt-0.5">
                                                    {note.snippet}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Server Search Results: Sites / Domains */}
                    {!loading && results.sites.length > 0 && (
                        <CommandGroup heading={<span className="font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider">Domains & Sites</span>}>
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
                                    className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
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
                                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Server Search Results: Partners */}
                    {!loading && results.partners.length > 0 && (
                        <CommandGroup heading={<span className="font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider">Partners</span>}>
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
                                    className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
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
                                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {/* Empty states */}
                    {!loading && normalizedQuery.length >= 2 && !hasAnyResults && !failed && (
                        <CommandEmpty className="py-16 text-center">
                            <p className="text-sm font-medium text-[var(--text-secondary)]">
                                No results found for &ldquo;{query}&rdquo;
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-1.5">
                                Try searching for a project name, task, note title, domain, or partner.
                            </p>
                        </CommandEmpty>
                    )}

                    {!loading && failed && (
                        <CommandEmpty className="py-12 text-center text-sm text-[var(--state-urgent)]">
                            Search is temporarily unavailable. Please try again.
                        </CommandEmpty>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    )
}
