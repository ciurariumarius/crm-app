"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SidePanelManualTimeFormProps = {
    minutes: string
    notes: string
    onMinutesChange: (value: string) => void
    onNotesChange: (value: string) => void
    onSave: () => void
    isSaving?: boolean
    disabled?: boolean
    saveLabel?: string
    className?: string
}

export function SidePanelManualTimeForm({
    minutes,
    notes,
    onMinutesChange,
    onNotesChange,
    onSave,
    isSaving = false,
    disabled = false,
    saveLabel = "Save",
    className,
}: SidePanelManualTimeFormProps) {
    return (
        <div className={className || "rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-[var(--shadow-apple)]"}>
            <div className="grid gap-3 sm:grid-cols-[150px_1fr_auto]">
                <Input
                    type="number"
                    value={minutes}
                    disabled={disabled}
                    onChange={(event) => onMinutesChange(event.target.value)}
                    placeholder="Minutes"
                    className="h-10 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)]"
                />
                <Input
                    value={notes}
                    disabled={disabled}
                    onChange={(event) => onNotesChange(event.target.value)}
                    placeholder="Optional note"
                    className="h-10 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)]"
                />
                <Button
                    onClick={onSave}
                    disabled={disabled || isSaving || !minutes}
                    className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveLabel}
                </Button>
            </div>
        </div>
    )
}
