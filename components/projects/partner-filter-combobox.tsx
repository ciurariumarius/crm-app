"use client"

import * as React from "react"
import { Check, ChevronDown, Users } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

interface PartnerFilterComboboxProps {
    partners: { id: string; name: string }[]
    currentPartnerId?: string | null
}

export function PartnerFilterCombobox({
    partners,
    currentPartnerId,
}: PartnerFilterComboboxProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [open, setOpen] = React.useState(false)

    const selectedPartner = partners.find((partner) => partner.id === currentPartnerId) || null

    const updatePartner = (partnerId: string | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (partnerId) {
            params.set("partnerId", partnerId)
        } else {
            params.delete("partnerId")
        }
        params.set("page", "1")

        const queryString = params.toString()
        router.push(queryString ? `${pathname}?${queryString}` : pathname)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] transition-colors",
                        currentPartnerId
                            ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    )}
                >
                    <Users className={cn("h-4 w-4", currentPartnerId ? "text-[#3B82F6]" : "text-slate-400")} />
                    <span className="max-w-[180px] truncate">{selectedPartner?.name || "Partner"}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 rounded-xl border border-slate-200 bg-white p-0 shadow-xl">
                <Command className="rounded-xl">
                    <CommandInput placeholder="Search partner..." />
                    <CommandList>
                        <CommandEmpty>No partner found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem onSelect={() => updatePartner(null)} className="cursor-pointer rounded-lg">
                                <Check className={cn("mr-2 h-4 w-4", !currentPartnerId ? "opacity-100" : "opacity-0")} />
                                All partners
                            </CommandItem>
                            {partners.map((partner) => (
                                <CommandItem
                                    key={partner.id}
                                    value={partner.name}
                                    onSelect={() => updatePartner(partner.id)}
                                    className="cursor-pointer rounded-lg"
                                >
                                    <Check className={cn("mr-2 h-4 w-4", currentPartnerId === partner.id ? "opacity-100" : "opacity-0")} />
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
