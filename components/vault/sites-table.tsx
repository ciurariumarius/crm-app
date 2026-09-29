"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowDownUp, Briefcase, CalendarDays, Check, ExternalLink, Search, Users, X } from "lucide-react"
import { cn, formatRelativeDate } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import { DomainFavicon } from "@/components/domains/domain-favicon"
import { ListEmptyState } from "@/components/ui/list-state"
import { sidePanelClass } from "@/lib/ui/side-panels"

export type SiteTableItem = {
    id: string
    partnerId: string
    name: string | null
    domainName: string
    faviconHash: string | null
    createdAt: Date
    updatedAt: Date
    partner: { id: string; name: string }
    _count: { projects: number }
}

type DomainFilters = {
    q: string
    partnerId: string
    projects: "all" | "with" | "without"
    createdFrom: string
    createdTo: string
}

interface SitesTableProps {
    sites: SiteTableItem[]
    partners: Array<{ id: string; name: string }>
    totalSites: number
    currentSort: string
    currentOrder: "asc" | "desc"
    filters: DomainFilters
}

export function SitesTable({ sites, partners, totalSites, currentSort, currentOrder, filters }: SitesTableProps) {
    const [selectedSite, setSelectedSite] = React.useState<SiteTableItem | null>(null)
    const [searchTerm, setSearchTerm] = React.useState(filters.q)
    const debouncedSearch = useDebounce(searchTerm, 300)
    const router = useRouter()
    const searchParams = useSearchParams()

    const updateParams = React.useCallback((updates: Record<string, string | null>, replace = false) => {
        const next = new URLSearchParams(searchParams.toString())
        for (const [key, value] of Object.entries(updates)) {
            if (!value || value === "all") next.delete(key)
            else next.set(key, value)
        }
        next.delete("page")
        const href = `/domains?${next.toString()}`
        if (replace) router.replace(href, { scroll: false })
        else router.push(href, { scroll: false })
    }, [router, searchParams])

    React.useEffect(() => {
        if (debouncedSearch === filters.q) return
        updateParams({ q: debouncedSearch || null }, true)
    }, [debouncedSearch, filters.q, updateParams])

    React.useEffect(() => setSearchTerm(filters.q), [filters.q])

    const toggleSort = (field: string) => {
        const nextOrder = currentSort === field && currentOrder === "asc" ? "desc" : "asc"
        updateParams({ sort: field === "domainName" ? null : field, order: nextOrder === "asc" ? null : nextOrder })
    }

    const openWebsite = (event: React.MouseEvent, domainName: string) => {
        event.stopPropagation()
        window.open(`https://${domainName}`, "_blank", "noopener,noreferrer")
    }

    return (
        <div className="space-y-3">
            <div className="overflow-x-auto pb-3 hidescrollbar">
                <div className="flex min-w-[800px] md:min-w-[940px] xl:min-w-[1240px] flex-col gap-1.5">
                    <div className="grid h-12 grid-cols-[minmax(260px,2fr)_180px_100px_70px_110px] items-center gap-x-3 rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-low)] px-4 text-[var(--text-secondary)] shadow-[var(--shadow-apple)]">
                        <div className="flex min-w-0 items-center gap-1">
                            <SortButton label={`Domain · ${totalSites}`} field="domainName" currentSort={currentSort} onSort={toggleSort} />
                            <Popover>
                                <PopoverTrigger asChild>
                                    <HeaderIconButton active={Boolean(filters.q)} label="Filter domains"><Search className="h-3.5 w-3.5" /></HeaderIconButton>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-72 rounded-xl p-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                                        <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search domains…" className="h-9 pl-9 pr-9" autoFocus />
                                        {searchTerm ? <button type="button" onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Clear domain search"><X className="h-3.5 w-3.5" /></button> : null}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex items-center gap-1">
                            <SortButton label="Partner" field="partner" currentSort={currentSort} onSort={toggleSort} />
                            <Popover>
                                <PopoverTrigger asChild>
                                    <HeaderIconButton active={filters.partnerId !== "all"} label="Filter partners"><Users className="h-3.5 w-3.5" /></HeaderIconButton>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-64 rounded-xl p-2">
                                    <FilterChoice selected={filters.partnerId === "all"} onClick={() => updateParams({ partnerId: null })}>All partners</FilterChoice>
                                    <div className="max-h-64 overflow-y-auto">
                                        {partners.map((partner) => <FilterChoice key={partner.id} selected={filters.partnerId === partner.id} onClick={() => updateParams({ partnerId: partner.id })}>{partner.name}</FilterChoice>)}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex items-center justify-center gap-1">
                            <SortButton label="Projects" field="projects" currentSort={currentSort} onSort={toggleSort} centered />
                            <Popover>
                                <PopoverTrigger asChild>
                                    <HeaderIconButton active={filters.projects !== "all"} label="Filter project count"><Briefcase className="h-3.5 w-3.5" /></HeaderIconButton>
                                </PopoverTrigger>
                                <PopoverContent align="center" className="w-48 rounded-xl p-2">
                                    <FilterChoice selected={filters.projects === "all"} onClick={() => updateParams({ projects: null })}>All domains</FilterChoice>
                                    <FilterChoice selected={filters.projects === "with"} onClick={() => updateParams({ projects: "with" })}>Has projects</FilterChoice>
                                    <FilterChoice selected={filters.projects === "without"} onClick={() => updateParams({ projects: "without" })}>No projects</FilterChoice>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <span className="ui-overline text-center">Visit</span>

                        <div className="flex items-center justify-end gap-1">
                            <SortButton label="Created" field="createdAt" currentSort={currentSort} onSort={toggleSort} />
                            <Popover>
                                <PopoverTrigger asChild>
                                    <HeaderIconButton active={Boolean(filters.createdFrom || filters.createdTo)} label="Filter created date"><CalendarDays className="h-3.5 w-3.5" /></HeaderIconButton>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-64 rounded-xl p-3">
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)]">From<input type="date" value={filters.createdFrom} onChange={(event) => updateParams({ createdFrom: event.target.value || null })} className="mt-1 h-9 w-full rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2 text-sm" /></label>
                                    <label className="mt-3 block text-xs font-semibold text-[var(--text-secondary)]">To<input type="date" value={filters.createdTo} onChange={(event) => updateParams({ createdTo: event.target.value || null })} className="mt-1 h-9 w-full rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2 text-sm" /></label>
                                    {(filters.createdFrom || filters.createdTo) ? <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => updateParams({ createdFrom: null, createdTo: null })}>Clear dates</Button> : null}
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {sites.map((site, index) => (
                        <div
                            key={site.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedSite(site)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    setSelectedSite(site)
                                }
                            }}
                            className="group stagger-row-enter grid min-h-14 grid-cols-[minmax(260px,2fr)_180px_100px_70px_110px] items-center gap-x-3 rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-2 shadow-[var(--shadow-apple)] outline-none transition-colors hover:border-[color:color-mix(in_srgb,var(--brand-primary)_25%,var(--line-subtle))] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                            style={{ animationDelay: `${index * 0.03}s` }}
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <DomainFavicon siteId={site.id} domain={site.domainName} faviconHash={site.faviconHash} className="h-9 w-9 rounded-lg" imageClassName="h-6 w-6" />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--brand-primary)]">{site.domainName}</p>
                                    {site.name ? <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{site.name}</p> : null}
                                </div>
                            </div>
                            <p className="truncate text-sm font-medium text-[var(--text-secondary)]">{site.partner.name}</p>
                            <p className="text-center text-sm font-semibold tabular-nums text-[var(--text-secondary)]">{site._count.projects}</p>
                            <div className="flex justify-center">
                                <Button variant="ghost" size="icon-xs" onClick={(event) => openWebsite(event, site.domainName)} aria-label={`Visit ${site.domainName}`} title="Open website"><ExternalLink className="h-4 w-4" /></Button>
                            </div>
                            <p className="text-right text-xs font-medium tabular-nums text-[var(--text-secondary)]">{formatRelativeDate(site.createdAt)}</p>
                        </div>
                    ))}

                    {sites.length === 0 ? <ListEmptyState title="No domains found" description="Try clearing one of the column filters." icon={<Search className="h-5 w-5" />} className="py-16" /> : null}
                </div>
            </div>

            <Sheet open={Boolean(selectedSite)} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("narrow")}>
                    <SheetHeader className="sr-only"><SheetTitle>Domain details</SheetTitle></SheetHeader>
                    {selectedSite ? <SiteSheetContent site={selectedSite} onUpdate={(updated) => setSelectedSite((previous) => previous ? { ...previous, ...updated } : previous)} onClose={() => setSelectedSite(null)} /> : null}
                </SheetContent>
            </Sheet>
        </div>
    )
}

function SortButton({ label, field, currentSort, onSort, centered = false }: { label: string; field: string; currentSort: string; onSort: (field: string) => void; centered?: boolean }) {
    return <button type="button" onClick={() => onSort(field)} className={cn("ui-overline flex min-w-0 items-center gap-1 rounded px-1.5 py-1 hover:text-[var(--text-primary)]", centered && "justify-center")}><span className="truncate">{label}</span><ArrowDownUp className={cn("h-3 w-3 shrink-0", currentSort === field && "text-[var(--brand-primary)]")} /></button>
}

function HeaderIconButton({ active, label, children }: { active: boolean; label: string; children: React.ReactNode }) {
    return <button type="button" aria-label={label} className={cn("relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-lowest)] hover:text-[var(--text-primary)]", active && "bg-blue-50 text-blue-600 after:absolute after:right-0.5 after:top-0.5 after:h-1.5 after:w-1.5 after:rounded-full after:bg-blue-500")}>{children}</button>
}

function FilterChoice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
    return <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[var(--surface-low)]"><Check className={cn("h-4 w-4 text-blue-600", !selected && "opacity-0")} /><span className="truncate">{children}</span></button>
}
