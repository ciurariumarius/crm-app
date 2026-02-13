"use client"

import { useHeader } from "@/components/layout/header-context"
import { useEffect } from "react"

interface BreadcrumbsProps {
    items: { label: string; href?: string }[]
}

export function DetailedBreadcrumbs({ items }: BreadcrumbsProps) {
    const { setBreadcrumbs } = useHeader()

    useEffect(() => {
        setBreadcrumbs(items)
        return () => setBreadcrumbs([])
    }, [items, setBreadcrumbs])

    return null
}
