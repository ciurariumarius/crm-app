"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-[11px] font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden tracking-[0.03em]",
  {
    variants: {
      variant: {
        default: "border-[color:color-mix(in_srgb,var(--state-active)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-active)_16%,var(--surface-lowest))] text-[var(--state-active)]",
        secondary:
          "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]",
        destructive:
          "border-[color:color-mix(in_srgb,var(--state-urgent)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--state-urgent)_14%,var(--surface-lowest))] text-[var(--state-urgent)]",
        outline:
          "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
