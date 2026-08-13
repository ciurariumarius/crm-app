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
import { globalSearch } from "@/lib/actions/search"
import { FolderDot, ListChecks, User, Search, Loader2 } from "lucide-react"
import { useDebounce } from "react-use"
import { cn, formatProjectName } from "@/lib/utils"

type SearchProject = {
    id: string
    name?: string | null
    createdAt?: string | Date | null
    site?: {
        domainName?: string | null
        partner?: {
            id?: string
            name?: string | null
        } | null
    } | null
    services?: Array<{
        serviceName?: string | null
        isRecurring?: boolean | null
    }> | null
    [key: string]: unknown
}

type SearchTask = {
    id: string
    name?: string | null
    project?: SearchProject | null
    [key: string]: unknown
}

type SearchPartner = {
    id: string
    name?: string | null
    businessName?: string | null
}

type GlobalSearchResults = {
    projects: SearchProject[]
    tasks: SearchTask[]
    partners: SearchPartner[]
}

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
        partners: []
    })
    const [loading, setLoading] = React.useState(false)
    const [failed, setFailed] = React.useState(false)

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    useDebounce(
        async () => {
            const normalizedQuery = query.trim()
            if (normalizedQuery.length < 2) {
                setResults({ projects: [], tasks: [], partners: [] })
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
                setResults({ projects: [], tasks: [], partners: [] })
                setFailed(true)
            } finally {
                setLoading(false)
            }
        },
        300,
        [query]
    )

    const normalizedQuery = query.trim()

    const handleSelect = (href: string) => {
        setOpen(false)
        router.push(href)
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={cn(
                    "mx-auto hidden h-11 w-full max-w-[560px] items-center gap-3 rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] pl-4 pr-4 text-[var(--text-muted)] shadow-[var(--shadow-apple)] transition-all hover:border-[color:color-mix(in_srgb,var(--line-subtle)_74%,var(--text-muted)_26%)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_20%,transparent)] focus-visible:ring-offset-0 md:flex",
                    desktopTriggerClassName
                )}
            >
                <Search className="h-4 w-4 text-[var(--text-muted)]" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)] font-medium">
                    Search
                </span>
            </button>

            {/* Mobile Search Trigger */}
            {mobileMode === "full" ? (
                <button
                    onClick={() => setOpen(true)}
                    className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-3 text-left text-[var(--text-secondary)] shadow-sm transition-all hover:border-[color:color-mix(in_srgb,var(--line-subtle)_74%,var(--text-muted)_26%)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)] md:hidden"
                >
                    <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-secondary)]">
                        Search
                    </span>
                </button>
            ) : (
                <button
                    onClick={() => setOpen(true)}
                    className="flex items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-2 text-[var(--text-secondary)] shadow-sm md:hidden"
                >
                    <Search className="h-5 w-5" />
                </button>
            )}

            <CommandDialog
                open={open}
                onOpenChange={setOpen}
                shouldFilter={false} // Disable internal cmdk filtering for instant server results
            >
                <CommandInput
                    placeholder="Search"
                    value={query}
                    onValueChange={setQuery}
                />
                <CommandList>
                    {loading && (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        </div>
                    )}

                    {!loading && query.length > 0 &&
                        normalizedQuery.length < 2 && (
                            <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
                        )}

                    {!loading && normalizedQuery.length >= 2 && failed && (
                        <CommandEmpty>Search is unavailable right now. Please try again.</CommandEmpty>
                    )}

                    {!loading && normalizedQuery.length >= 2 && !failed &&
                        results.projects.length === 0 &&
                        results.tasks.length === 0 &&
                        results.partners.length === 0 && (
                            <CommandEmpty>No results found for &quot;{query}&quot;.</CommandEmpty>
                        )}

                    {!loading && results.projects.length > 0 && (
                        <CommandGroup heading="Projects">
                            {results.projects.map((project) => (
                                <CommandItem
                                    key={project.id}
                                    onSelect={() =>
                                        handleSelect(`/projects?projectId=${encodeURIComponent(project.id)}&status=All&page=1`)
                                    }
                                    className="flex items-center gap-3 cursor-pointer p-4"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-blue-50/90 dark:bg-blue-500/18 flex items-center justify-center">
                                        <FolderDot className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-[var(--text-primary)]">{formatProjectName(project)}</span>
                                        <span className="ui-text-caption text-[var(--text-muted)]">{project.site?.partner?.name}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {!loading && results.tasks.length > 0 && (
                        <CommandGroup heading="Tasks">
                            {results.tasks.map((task) => (
                                <CommandItem
                                    key={task.id}
                                    onSelect={() =>
                                        handleSelect(`/tasks?taskId=${encodeURIComponent(task.id)}&status=All&page=1`)
                                    }
                                    className="flex items-center gap-3 cursor-pointer p-4"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50/90 dark:bg-emerald-500/18 flex items-center justify-center">
                                        <ListChecks className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-[var(--text-primary)]">{task.name}</span>
                                        <span className="ui-text-caption text-[var(--text-muted)]">{task.project ? formatProjectName(task.project) : "No project"}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {!loading && results.partners.length > 0 && (
                        <CommandGroup heading="Partners">
                            {results.partners.map((partner) => (
                                <CommandItem
                                    key={partner.id}
                                    onSelect={() => handleSelect(`/partners?partnerId=${encodeURIComponent(partner.id)}`)}
                                    className="flex items-center gap-3 cursor-pointer p-4"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-amber-50/90 dark:bg-amber-500/18 flex items-center justify-center">
                                        <User className="h-4 w-4 text-amber-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-[var(--text-primary)]">{partner.name}</span>
                                        <span className="ui-text-caption text-[var(--text-muted)]">{partner.businessName || "Partner"}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    )
}
