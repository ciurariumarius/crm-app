"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, User, X, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import Link from "next/link"
import { useDebounce } from "@/hooks/use-debounce"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { buttonLinkClassName } from "@/components/ui/button-link"
import {
    FilterBarDivider,
    FilterBarGroup,
    FilterBarRow,
    FilterBarScroll,
    FilterBarShell,
    FilterResultsRow,
} from "@/components/ui/filter-bar"

interface DomainsFiltersProps {
    partners: Array<{ id: string; name: string }>
    totalLogs: number
}

export function DomainsFilters({ partners, totalLogs }: DomainsFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Local state for search
    const [searchTerm, setSearchTerm] = React.useState(searchParams.get("q") || "")
    const debouncedSearch = useDebounce(searchTerm, 300)

    const currentPartnerId = searchParams.get("partnerId") || "all"

    // Update URL on search
    React.useEffect(() => {
        const params = new URLSearchParams(searchParams.toString())
        const currentQ = params.get("q") || ""

        if (debouncedSearch !== currentQ) {
            if (debouncedSearch) {
                params.set("q", debouncedSearch)
            } else {
                params.delete("q")
            }
            params.delete("page")
            router.replace(`/domains?${params.toString()}`, { scroll: false })
        }
    }, [debouncedSearch, router, searchParams])

    const buildHref = (overrides: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(overrides).forEach(([key, value]) => {
            if (value === null || value === "all") {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })
        params.delete("page")
        return `/domains?${params.toString()}`
    }

    const pushWithOverrides = (overrides: Record<string, string | null>) => {
        router.push(buildHref(overrides))
    }

    const clearAllHref = "/domains"
    const selectedPartner = partners.find((p) => p.id === currentPartnerId)
    const activeFilters: { key: string; label: string; href: string }[] = []
    
    if (searchTerm) {
        activeFilters.push({
            key: "q",
            label: `Search: ${searchTerm}`,
            href: buildHref({ q: null })
        })
    }
    if (currentPartnerId !== "all" && selectedPartner) {
        activeFilters.push({ 
            key: "partnerId", 
            label: `Partner: ${selectedPartner.name}`, 
            href: buildHref({ partnerId: "all" }) 
        })
    }

    return (
        <div className="space-y-3">
            <FilterBarShell>
                <FilterBarScroll>
                    <FilterBarRow className="md:gap-4">
                    <div className="relative h-10 w-full md:w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search domains..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 border-slate-200 bg-white/50 pl-10 text-sm font-medium tracking-[0.02em] text-slate-700 shadow-none transition-all hover:bg-white hover:border-slate-300 focus-visible:ring-0 focus-visible:border-blue-500"
                        />
                        {searchTerm && (
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                type="button"
                                onClick={() => setSearchTerm("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>

                    <FilterBarDivider className="hidden md:block" />

                    <FilterBarGroup className="gap-4 md:gap-4">
                    <PartnerCombobox
                        partners={partners}
                        currentPartner={currentPartnerId}
                        onSelect={(value) => pushWithOverrides({ partnerId: value })}
                    />
                    </FilterBarGroup>

                    {activeFilters.length > 0 && (
                        <div className="md:ml-auto">
                            <Link
                                href={clearAllHref}
                                className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "text-[12px]" })}
                            >
                                Clear all
                            </Link>
                        </div>
                    )}
                    </FilterBarRow>
                </FilterBarScroll>
            </FilterBarShell>

            <FilterResultsRow>
                <p className="ui-text-label">{totalLogs} Results found</p>
                {activeFilters.length > 0 && <span className="text-slate-300">|</span>}
                {activeFilters.map((filter) => (
                    <Link
                        key={filter.key}
                        href={filter.href}
                        className={buttonLinkClassName({ size: "sm", variant: "subtle", className: "h-8 gap-1 text-[12px]" })}
                    >
                        <span>{filter.label}</span>
                        <X className="h-3 w-3 text-slate-400" />
                    </Link>
                ))}
            </FilterResultsRow>
        </div>
    )
}

function PartnerCombobox({
    partners,
    currentPartner,
    onSelect,
}: {
    partners: Array<{ id: string; name: string }>
    currentPartner: string
    onSelect: (value: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const isActive = currentPartner !== "all"
    const selectedPartner = partners.find((p) => p.id === currentPartner)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-[12px] font-medium tracking-[0.02em] transition-all shadow-none",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <User className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                    <span className="max-w-[150px] truncate">{selectedPartner?.name || "Partner"}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[280px] rounded-xl border border-slate-200 bg-white p-0 shadow-xl">
                <Command className="rounded-xl">
                    <CommandInput placeholder="Search partner..." />
                    <CommandList>
                        <CommandEmpty>No partner found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="all partners"
                                onSelect={() => {
                                    onSelect("all")
                                    setOpen(false)
                                }}
                                className="cursor-pointer rounded-lg px-3 py-2 text-[12px] font-medium tracking-[0.02em]"
                            >
                                <Check className={cn("mr-2 h-4 w-4", !isActive ? "opacity-100" : "opacity-0")} />
                                All partners
                            </CommandItem>
                            {partners.map((partner) => (
                                <CommandItem
                                    key={partner.id}
                                    value={partner.name}
                                    onSelect={() => {
                                        onSelect(partner.id)
                                        setOpen(false)
                                    }}
                                    className="cursor-pointer rounded-lg px-3 py-2 text-[12px] font-medium tracking-[0.02em]"
                                >
                                    <Check className={cn("mr-2 h-4 w-4", currentPartner === partner.id ? "opacity-100" : "opacity-0")} />
                                    {partner.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
