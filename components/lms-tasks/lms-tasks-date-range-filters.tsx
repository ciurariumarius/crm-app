"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { detectLmsDatePresetId, getLmsDatePresets, resolveLmsDatePreset } from "@/lib/lms-tasks/date-presets"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ChevronDown } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export function LmsTasksDateRangeFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  const period = searchParams.get("period")
  const [isOpen, setIsOpen] = React.useState(false)

  const presets = React.useMemo(() => getLmsDatePresets(), [])
  const activePresetId = detectLmsDatePresetId(from || null, to || null, period)
  const activePreset = resolveLmsDatePreset(activePresetId)

  const updateQuery = React.useCallback(
    (next: URLSearchParams) => {
      router.replace(`${pathname}?${next.toString()}`)
    },
    [pathname, router]
  )

  const applyPreset = React.useCallback(
    (presetId: string) => {
      if (presetId === "custom") return
      const preset = presets.find((p) => p.id === presetId)
      if (!preset) return

      const next = new URLSearchParams(searchParams.toString())
      if (preset.from) next.set("from", preset.from)
      else next.delete("from")
      if (preset.to) next.set("to", preset.to)
      else next.delete("to")
      next.set("period", preset.id)
      updateQuery(next)
      // Small delay before closing so user sees selection state visually snap
      setTimeout(() => setIsOpen(false), 200)
    },
    [searchParams, updateQuery, presets, setIsOpen]
  )

  const clearRange = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("from")
    next.delete("to")
    next.set("period", "all")
    updateQuery(next)
  }, [searchParams, updateQuery])

  // Extract from/to as properly offset Date objects for the calendar
  const selectedRange = React.useMemo(() => {
    return {
      from: from ? new Date(from + "T12:00:00Z") : undefined,
      to: to ? new Date(to + "T12:00:00Z") : undefined,
    }
  }, [from, to])

  const handleDaySelect = (range: { from?: Date; to?: Date } | undefined) => {
    const next = new URLSearchParams(searchParams.toString())
    if (range?.from) {
      next.set("from", format(range.from, "yyyy-MM-dd"))
    } else {
      next.delete("from")
    }
    
    if (range?.to) {
      next.set("to", format(range.to, "yyyy-MM-dd"))
    } else {
      next.delete("to")
    }

    if (!range?.from && !range?.to) {
        next.set("period", "all")
    } else {
        next.set("period", "custom")
    }
    updateQuery(next)
  }

  // Determine button title. If custom, show dates. Else show preset label.
  const buttonLabel = activePresetId !== "custom" 
    ? activePreset.label 
    : (from && to ? `${format(selectedRange.from!, "MMM d, yyyy")} - ${format(selectedRange.to!, "MMM d, yyyy")}` 
        : from ? format(selectedRange.from!, "MMM d, yyyy") 
        : "Select Date Range")

  return (
    <div className="flex md:items-end w-full md:w-auto">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className={cn(
              "h-10 min-w-[132px] w-full md:w-auto justify-between rounded-xl px-4 gap-2 text-xs font-semibold shadow-none",
              activePresetId !== "custom" && activePresetId !== "all" 
                ? "bg-cyan-50/50 text-cyan-800 border-cyan-200 hover:bg-cyan-100/50" 
                : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
            )}
          >
            {buttonLabel}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(96vw,640px)] p-0 rounded-[1.25rem] border-slate-200 shadow-xl overflow-hidden pointer-events-auto bg-white"
        >
          <div className="p-4 flex flex-col gap-4 w-full">
            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset, i) => (
                <Button
                  key={preset.id}
                  variant="outline"
                  onClick={() => applyPreset(preset.id)}
                  className={cn(
                    "h-10 px-3 w-full justify-center font-medium shadow-none text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900",
                    activePresetId === preset.id && "bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100 hover:text-cyan-800 shadow-sm",
                    // make the 7th element (last-year) span full width
                    i === 6 && "col-span-2"
                  )}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="h-px bg-slate-100 -mx-4" />

            <div className="w-full [&_[data-slot=calendar]]:![--cell-size:clamp(36px,11vw,46px)] [&_.rdp-month_grid]:!w-full [&_.rdp-weeks]:!w-full">
              <Calendar
                mode="range"
                initialFocus
                selected={selectedRange}
                onSelect={handleDaySelect}
                numberOfMonths={1}
                className="bg-transparent w-full p-0"
                classNames={{
                  root: "w-full",
                  month: "w-full",
                  months: "w-full",
                  month_grid: "w-full table-fixed",
                  weekdays: "grid w-full grid-cols-7",
                  week: "grid w-full grid-cols-7 mt-2",
                  day: "w-full",
                  nav_button: "hover:bg-slate-100",
                  day_selected: "bg-cyan-600 text-white hover:bg-cyan-600 hover:text-white",
                  day_today: "bg-slate-100 text-slate-900 font-bold",
                  day_range_start: "bg-cyan-600 text-white",
                  day_range_end: "bg-cyan-600 text-white",
                  day_range_middle: "text-slate-900 bg-cyan-50 rounded-none",
                }}
              />
            </div>
            
            <div className="flex items-center justify-between pt-1 pb-1">
              <Button 
                variant="ghost" 
                onClick={clearRange} 
                className="h-8 px-2 text-[13px] text-slate-500 hover:text-slate-900"
              >
                Clear range
              </Button>
              <span className="text-[12px] font-medium text-slate-500">Pick start and end date</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
