"use client"

import * as React from "react"
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    buildMonthKey,
    formatMonthKeyLabel,
    getMonthKeyFromDate,
    parseMonthKey,
} from "@/lib/projects/recurring-month"

const MONTH_LABELS = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
        new Date(2026, index, 1, 12)
    )
)

type RecurringProjectMonthPickerProps = {
    value: string
    minimumMonth: string
    onChange: (value: string) => void
    disabled?: boolean
}

export function RecurringProjectMonthPicker({
    value,
    minimumMonth,
    onChange,
    disabled = false,
}: RecurringProjectMonthPickerProps) {
    const selected = parseMonthKey(value) ?? parseMonthKey(minimumMonth)
    const minimum = parseMonthKey(minimumMonth)
    const selectedYear = selected?.year
    const currentMonth = React.useMemo(() => getMonthKeyFromDate(new Date()), [])
    const [visibleYear, setVisibleYear] = React.useState(
        selectedYear ?? new Date().getFullYear()
    )

    React.useEffect(() => {
        if (selectedYear) setVisibleYear(selectedYear)
    }, [selectedYear])

    const canGoToPreviousYear = !minimum || visibleYear > minimum.year
    const currentMonthAvailable = currentMonth >= minimumMonth

    return (
        <div className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--surface-low)] p-3 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--surface-lowest)_75%,transparent)] sm:p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="ui-overline">Selected month</p>
                    <p className="mt-1 truncate text-base font-bold text-[var(--text-primary)]">
                        {formatMonthKeyLabel(value)}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1 shadow-sm">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setVisibleYear((year) => year - 1)}
                        disabled={disabled || !canGoToPreviousYear}
                        className="h-9 w-9 rounded-lg"
                        aria-label="Previous year"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-14 text-center text-sm font-bold tabular-nums text-[var(--text-primary)]">
                        {visibleYear}
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setVisibleYear((year) => year + 1)}
                        disabled={disabled}
                        className="h-9 w-9 rounded-lg"
                        aria-label="Next year"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label={`Months in ${visibleYear}`}>
                {MONTH_LABELS.map((label, index) => {
                    const monthKey = buildMonthKey(visibleYear, index + 1)
                    const isSelected = monthKey === value
                    const isCurrent = monthKey === currentMonth
                    const isUnavailable = monthKey < minimumMonth

                    return (
                        <button
                            key={monthKey}
                            type="button"
                            onClick={() => onChange(monthKey)}
                            disabled={disabled || isUnavailable}
                            autoFocus={isSelected}
                            aria-pressed={isSelected}
                            aria-label={`${formatMonthKeyLabel(monthKey)}${isUnavailable ? ", unavailable" : ""}`}
                            className={cn(
                                "relative flex min-h-13 items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-semibold outline-none transition-[border-color,background-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--ring)_40%,transparent)]",
                                !isSelected && !isUnavailable && "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] shadow-sm hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--brand-primary)_42%,var(--line-subtle))] hover:text-[var(--text-primary)]",
                                isCurrent && !isSelected && !isUnavailable && "border-[color:color-mix(in_srgb,var(--brand-primary)_34%,var(--line-subtle))] text-[var(--brand-primary)]",
                                isSelected && "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_8px_20px_color-mix(in_srgb,var(--brand-primary)_26%,transparent)]",
                                isUnavailable && "cursor-not-allowed border-transparent bg-transparent text-[var(--text-muted)] opacity-40"
                            )}
                        >
                            <span>{label}</span>
                            {isSelected ? <Check className="h-4 w-4" /> : null}
                            {isCurrent && !isSelected ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" aria-hidden="true" />
                            ) : null}
                        </button>
                    )
                })}
            </div>

            <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2 px-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Available from {formatMonthKeyLabel(minimumMonth)}
                </span>
                {currentMonthAvailable && value !== currentMonth ? (
                    <button
                        type="button"
                        onClick={() => onChange(currentMonth)}
                        disabled={disabled}
                        className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--brand-primary)] outline-none transition hover:bg-[var(--surface-lowest)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    >
                        This month
                    </button>
                ) : null}
            </div>
        </div>
    )
}
