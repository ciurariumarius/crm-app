"use client"

interface GreetingHeaderProps {
    name?: string
}

export function GreetingHeader({ name = "Marius" }: GreetingHeaderProps) {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

    return (
        <h1 className="page-title animate-in fade-in duration-500 flex items-center h-full">
            {greeting}, {name}
        </h1>
    )
}
