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
import { globalSearch } from "@/lib/actions/search"
import { ProjectSheetContext } from "@/components/projects/project-sheet-wrapper"
import { TaskSheetContext } from "@/components/tasks/task-sheet-wrapper"
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
    username?: string | null
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
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<GlobalSearchResults>({
        projects: [],
        tasks: [],
        partners: []
    })
    const [loading, setLoading] = React.useState(false)

    const { openProject } = React.useContext(ProjectSheetContext)
    const { openTask } = React.useContext(TaskSheetContext)

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
            if (query.length < 2) {
                setResults({ projects: [], tasks: [], partners: [] })
                setLoading(false)
                return
            }

            setLoading(true)
            try {
                const searchResults = await globalSearch(query)
                setResults(searchResults)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        },
        300,
        [query]
    )

    const handleSelect = (callback: () => void) => {
        setOpen(false)
        callback()
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={cn(
                    "mx-auto hidden h-11 w-full max-w-[560px] items-center gap-3 rounded-full border border-slate-200/90 bg-white/95 pl-4 pr-4 text-slate-400 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_20%,white)] focus-visible:ring-offset-0 md:flex",
                    desktopTriggerClassName
                )}
            >
                <Search className="h-4 w-4 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-500 font-medium">
                    Search
                </span>
            </button>

            {/* Mobile Search Trigger */}
            {mobileMode === "full" ? (
                <button
                    onClick={() => setOpen(true)}
                    className="flex w-full items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-left text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 md:hidden"
                >
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-500">
                        Search
                    </span>
                </button>
            ) : (
                <button
                    onClick={() => setOpen(true)}
                    className="flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm md:hidden"
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
                                    onSelect={() => handleSelect(() => openProject(project.id))}
                                    className="flex items-center gap-3 cursor-pointer p-4"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <FolderDot className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-700">{formatProjectName(project)}</span>
                                        <span className="ui-text-caption text-slate-400">{project.site?.partner?.name}</span>
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
                                    onSelect={() => handleSelect(() => openTask(task.id, task))}
                                    className="flex items-center gap-3 cursor-pointer p-4"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <ListChecks className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-700">{task.name}</span>
                                        <span className="ui-text-caption text-slate-400">{task.project ? formatProjectName(task.project) : "No project"}</span>
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
                                    onSelect={() => handleSelect(() => { })}
                                    className="flex items-center gap-3 cursor-pointer p-4"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                        <User className="h-4 w-4 text-amber-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-700">{partner.name}</span>
                                        <span className="ui-text-caption text-slate-400">@{partner.username || partner.businessName}</span>
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
