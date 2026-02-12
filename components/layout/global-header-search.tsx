"use client"

import * as React from "react"
import { Search as SearchIcon, Globe, Briefcase } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

export function GlobalHeaderSearch() {
    const [query, setQuery] = React.useState("")
    const router = useRouter()

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (!query) return

        // Decide where to go based on prefix or just go to projects by default?
        // Let's just redirect to a general search result or clarify:
        // Actually, the user wanted to find Sites or Projects.
        // I'll make it search projects by default but maybe they can prefix with 's:' for sites.

        if (query.toLocaleLowerCase().startsWith("s:")) {
            router.push(`/vault/sites?q=${query.slice(2).trim()}`)
        } else {
            router.push(`/projects?q=${query}`)
        }
    }

    return (
        <form onSubmit={handleSearch} className="relative w-full max-w-sm hidden md:block">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects (or 's: site')..."
                className="pl-10 h-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/50"
            />
        </form>
    )
}
