import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

export const buttonLinkVariants = cva(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors",
    {
        variants: {
            size: {
                sm: "h-8 rounded-md px-2.5 text-xs",
                md: "h-10 rounded-lg px-3 text-xs",
                lg: "h-11 rounded-xl px-4 text-sm",
            },
            variant: {
                subtle: "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                activeBlue: "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100/60",
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
