"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Search, User, FolderKanban, X } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

interface PaymentsFiltersProps {
    partners: any[]
    projects: any[]
}

export function PaymentsFilters({ partners, projects }: PaymentsFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const currentPartnerId = searchParams.get("partnerId") || "all"
    const currentProjectId = searchParams.get("projectId") || "all"

    const updateFilters = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "all") {
            params.delete(key)
        } else {
            params.set(key, value)
        }
        params.delete("page") // Reset to first page on filter change
        router.push(`/payments?${params.toString()}`)
    }

    const clearFilters = () => {
        router.push("/payments")
    }

    const hasFilters = currentPartnerId !== "all" || currentProjectId !== "all"

    return (
        <div className="flex flex-col md:flex-row items-center gap-4 bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex flex-1 items-center gap-4 w-full md:w-auto">
                <div className="flex-1">
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Select value={currentPartnerId} onValueChange={(v) => updateFilters("partnerId", v)}>
                            <SelectTrigger className="pl-10">
                                <SelectValue placeholder="All Partners" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Partners</SelectItem>
                                {partners.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex-1">
                    <div className="relative">
                        <FolderKanban className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Select value={currentProjectId} onValueChange={(v) => updateFilters("projectId", v)}>
                            <SelectTrigger className="pl-10">
                                <SelectValue placeholder="All Projects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Projects</SelectItem>
                                {projects.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name || p.site?.domainName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                </Button>
            )}
        </div>
    )
}
