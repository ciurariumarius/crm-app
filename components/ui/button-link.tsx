import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

export const buttonLinkVariants = cva(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors",
    {
        variants: {
            size: {
                sm: "h-8 rounded-[10px] px-2.5 text-xs",
                md: "h-10 rounded-[10px] px-3 text-xs",
                lg: "h-11 rounded-[10px] px-4 text-sm",
            },
            variant: {
                subtle: "border border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]",
                activeBlue: "border border-[color:color-mix(in_srgb,var(--primary-container)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--primary-container)_18%,var(--surface-lowest))] text-[var(--primary)] hover:bg-[color:color-mix(in_srgb,var(--primary-container)_24%,var(--surface-lowest))]",
                activeRose: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100/60",
            },
            emphasis: {
                normal: "font-medium",
                strong: "font-semibold",
            },
        },
        defaultVariants: {
            size: "sm",
            variant: "subtle",
            emphasis: "normal",
        },
    }
)

type ButtonLinkVariantProps = VariantProps<typeof buttonLinkVariants>

export function buttonLinkClassName({
    size,
    variant,
    emphasis,
    className,
}: ButtonLinkVariantProps & { className?: string }) {
    return cn(buttonLinkVariants({ size, variant, emphasis }), className)
}
