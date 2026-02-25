"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface GreetingHeaderProps {
    name?: string
}

export function GreetingHeader({ name = "Marius" }: GreetingHeaderProps) {
    const [greeting, setGreeting] = useState<string>("")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const hour = new Date().getHours()

        if (hour < 12) {
            setGreeting("Good morning")
        } else if (hour < 18) {
            setGreeting("Good afternoon")
        } else {
            setGreeting("Good evening")
        }
    }, [])

    if (!mounted) {
        return <Skeleton className="h-10 w-64 bg-muted/20" />
    }

    return (
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground animate-in fade-in duration-500 leading-none flex items-center h-full">
            {greeting}, {name}
        </h1>
    )
}
