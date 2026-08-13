import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SectionCard({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="section-card"
      className={cn(
        "rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)] sm:p-5 lg:p-6",
        className
      )}
      {...props}
    />
  )
}

export function StatCard({ className, ...props }: React.ComponentProps<"article">) {
  return (
    <article
      data-slot="stat-card"
      className={cn(
        "relative h-full rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)] sm:p-5",
        className
      )}
      {...props}
    />
  )
}

export function IconButton({
  label,
  className,
  children,
  size = "icon",
  variant = "ghost",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "aria-label"> & { label: string }) {
  return (
    <Button
      type="button"
      aria-label={label}
      title={label}
      size={size}
      variant={variant}
      className={cn("min-h-11 min-w-11", className)}
      {...props}
    >
      {children}
    </Button>
  )
}
