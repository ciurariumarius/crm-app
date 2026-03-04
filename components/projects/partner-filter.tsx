"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Users } from "lucide-react"

interface PartnerFilterProps {
    partners: { id: string; name: string }[]
    currentPartnerId?: string
}

export function PartnerFilter({ partners, currentPartnerId }: PartnerFilterProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handlePartnerChange = (id: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (id === "all") {
            params.delete("partnerId")
        } else {
            params.set("partnerId", id)
        }
        router.push(`/projects?${params.toString()}`)
    }

    return (
        <div className="flex items-center gap-2">
            <Select value={currentPartnerId || "all"} onValueChange={handlePartnerChange}>
                <SelectTrigger className="w-[180px] h-9 border-none bg-muted/30 shadow-none text-xs font-semibold focus:ring-0">
                    <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <SelectValue placeholder="All Partners" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all" className="text-xs font-semibold">All Partners</SelectItem>
                    {partners.map((partner) => (
                        <SelectItem
                            key={partner.id}
                            value={partner.id}
                            className="text-xs font-semibold"
                        >
                            {partner.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
