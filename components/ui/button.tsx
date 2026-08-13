import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-[13px] font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_srgb,var(--ring)_28%,transparent)]",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-[var(--brand-primary)] text-primary-foreground shadow-[var(--shadow-apple)] hover:bg-[var(--brand-primary-strong)]",
        destructive:
          "bg-destructive text-white shadow-[var(--shadow-apple)] hover:brightness-[1.02] focus-visible:ring-[color:color-mix(in_srgb,var(--destructive)_28%,transparent)]",
        outline:
          "border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] shadow-[var(--shadow-apple)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_65%,var(--text-muted))] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]",
        secondary:
          "border border-transparent bg-[var(--surface-low)] text-[var(--text-secondary)] hover:bg-[var(--surface-highest)] hover:text-[var(--text-primary)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3.5",
        xs: "h-7 gap-1 px-2 text-[11px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
