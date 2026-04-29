"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type CloseProjectDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (payload: { closedOn: string; isHeavyRevenueMonth: boolean }) => Promise<void> | void
    projectName?: string | null
    isSubmitting?: boolean
    initialClosedOn?: string
    initialIsHeavyRevenueMonth?: boolean
}

function todayDateInputValue() {
    const now = new Date()
    const year = now.getFullYear()
    const month = `${now.getMonth() + 1}`.padStart(2, "0")
    const day = `${now.getDate()}`.padStart(2, "0")
    return `${year}-${month}-${day}`
}

export function CloseProjectDialog({
    open,
    onOpenChange,
    onConfirm,
    projectName,
    isSubmitting = false,
    initialClosedOn,
    initialIsHeavyRevenueMonth = false,
}: CloseProjectDialogProps) {
    const [closedOn, setClosedOn] = React.useState(initialClosedOn || todayDateInputValue())
    const [isHeavyRevenueMonth, setIsHeavyRevenueMonth] = React.useState(initialIsHeavyRevenueMonth)

    React.useEffect(() => {
        if (!open) return
        setClosedOn(initialClosedOn || todayDateInputValue())
        setIsHeavyRevenueMonth(initialIsHeavyRevenueMonth)
    }, [open, initialClosedOn, initialIsHeavyRevenueMonth])

    const handleConfirm = async () => {
        if (!closedOn) return
        await onConfirm({ closedOn, isHeavyRevenueMonth })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[min(92vw,520px)] rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-0 shadow-2xl">
                <DialogHeader className="border-b border-[var(--line-subtle)] px-6 py-5">
                    <DialogTitle className="text-lg font-bold text-[var(--text-primary)]">
                        Close project
                    </DialogTitle>
                    <DialogDescription className="text-sm text-[var(--text-secondary)]">
                        {projectName
                            ? `Set closure details for ${projectName}.`
                            : "Set closure details for this project."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 px-6 py-5">
                    <div className="space-y-2">
                        <label htmlFor="close-project-date" className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                            Close date
                        </label>
                        <Input
                            id="close-project-date"
                            type="date"
                            value={closedOn}
                            onChange={(event) => setClosedOn(event.target.value)}
                            className="h-11 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-sm font-semibold text-[var(--text-primary)]"
                            max="9999-12-31"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                            Heavy revenue for close month
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setIsHeavyRevenueMonth(true)}
                                className={cn(
                                    "h-11 rounded-xl border text-sm font-semibold transition-colors",
                                    isHeavyRevenueMonth
                                        ? "border-[color:color-mix(in_srgb,var(--state-success)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-success)_14%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-success)_82%,var(--text-primary))]"
                                        : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                                )}
                            >
                                Yes
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsHeavyRevenueMonth(false)}
                                className={cn(
                                    "h-11 rounded-xl border text-sm font-semibold transition-colors",
                                    !isHeavyRevenueMonth
                                        ? "border-[color:color-mix(in_srgb,var(--state-overdue)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-overdue)_12%,var(--surface-lowest))] text-[color:color-mix(in_srgb,var(--state-overdue)_82%,var(--text-primary))]"
                                        : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                                )}
                            >
                                No
                            </button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-[var(--line-subtle)] px-6 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl border-[var(--line-subtle)]"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="h-10 rounded-xl"
                        onClick={() => void handleConfirm()}
                        disabled={isSubmitting || !closedOn}
                    >
                        {isSubmitting ? "Closing..." : "Close project"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
