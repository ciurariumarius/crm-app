import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_28%,transparent)]",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,var(--brand-primary-strong),var(--brand-cyan))] text-primary-foreground shadow-[var(--shadow-apple)] hover:brightness-[1.02]",
        destructive:
          "bg-destructive text-white shadow-[var(--shadow-apple)] hover:brightness-[1.02] focus-visible:ring-[color:color-mix(in_srgb,var(--destructive)_28%,transparent)]",
        outline:
          "border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,var(--surface-low)_4%)] text-[var(--text-secondary)] shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_74%,var(--text-muted)_26%)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)]",
        secondary:
          "border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_88%,var(--surface-lowest)_12%)] text-[var(--text-secondary)] shadow-[0_2px_8px_rgba(15,23,42,0.02)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[color:color-mix(in_srgb,var(--surface-low)_88%,var(--surface-lowest)_12%)] hover:text-[var(--text-primary)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 gap-1 px-2 text-[11px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
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
