"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"

export function MobileSearch() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isOpen, setIsOpen] = React.useState(false)
    const [searchTerm, setSearchTerm] = React.useState(searchParams.get("q") || "")
    const debouncedSearch = useDebounce(searchTerm, 300)

    React.useEffect(() => {
        if (searchParams.get("q") !== searchTerm && searchParams.get("q") !== null) {
            setSearchTerm(searchParams.get("q") || "")
        }
    }, [searchParams])

    React.useEffect(() => {
        const params = new URLSearchParams(searchParams.toString())
        const currentQ = params.get("q") || ""
        if (debouncedSearch !== currentQ) {
            if (debouncedSearch) {
                params.set("q", debouncedSearch)
            } else {
                params.delete("q")
            }
            router.replace(`?${params.toString()}`)
        }
    }, [debouncedSearch, router, searchParams])

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-muted-foreground/50 hover:text-foreground cursor-pointer transition-colors"
                title="Search"
            >
                <Search className="w-5 h-5" strokeWidth={2.5} />
            </button>

            {isOpen && (
                <div className="absolute top-12 -right-4 md:right-0 z-50 flex items-center bg-white dark:bg-zinc-900 rounded-xl border border-border/60 shadow-lg h-12 px-4 animate-in slide-in-from-top-2 w-[calc(100vw-32px)] sm:w-[320px]">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0 mr-2" />
                    <Input
                        autoFocus
                        placeholder="FIND TASK..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-full bg-transparent border-none focus-visible:ring-0 placeholder:text-muted-foreground/40 text-[10px] sm:text-xs font-bold tracking-widest uppercase transition-all duration-300 w-full px-0 text-foreground"
                    />
                    <button
                        onClick={() => {
                            setSearchTerm("")
                            setIsOpen(false)
                        }}
                        className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    )
}
