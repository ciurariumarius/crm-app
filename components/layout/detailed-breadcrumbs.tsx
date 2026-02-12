"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Slash } from "lucide-react"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// We can pass current context names (Partner Name, Site Name) via props or context 
// to avoid fetching on every breadcrumb render, OR keep it simple and just show "Vault / Partner / Site" text 
// or simpler, utilize the path segments.

// Ideally, for the server pages, we pass the real names.
// Let's make a Breadcrumbs component that accepts a list of items: { label: string, href?: string }[]

interface BreadcrumbsProps {
    items: { label: string; href?: string }[]
}

export function DetailedBreadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <Breadcrumb className="mb-6">
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                    <Slash />
                </BreadcrumbSeparator>
                {items.map((item, index) => {
                    const isLast = index === items.length - 1
                    return (
                        <div key={item.label} className="flex items-center gap-2">
                            <BreadcrumbItem>
                                {isLast ? (
                                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && (
                                <BreadcrumbSeparator>
                                    <Slash />
                                </BreadcrumbSeparator>
                            )}
                        </div>
                    )
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
