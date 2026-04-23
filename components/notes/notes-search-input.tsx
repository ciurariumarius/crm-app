"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

type NotesSearchInputProps = {
  value: string
  onChange: (value: string) => void
}

export const NotesSearchInput = React.forwardRef<HTMLInputElement, NotesSearchInputProps>(
  function NotesSearchInput({ value, onChange }, ref) {
    return (
      <div className="relative h-11 w-full md:mx-auto md:max-w-[640px]">
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          <Search className="h-4 w-4" />
        </div>
        <Input
          ref={ref}
          placeholder="Search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-[28px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] pl-11 pr-4 text-[14px] font-medium text-[var(--text-primary)] shadow-[0_6px_18px_rgba(15,23,42,0.04)] outline-none transition placeholder:font-medium placeholder:text-[var(--text-muted)] focus-visible:border-[var(--brand-cyan)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_20%,transparent)] focus-visible:ring-offset-0"
        />
      </div>
    )
  }
)
