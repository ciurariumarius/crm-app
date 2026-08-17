import Image from "next/image"
import { cn } from "@/lib/utils"

export function LmsIcon({
  className,
  strokeWidth: _strokeWidth,
}: {
  className?: string
  strokeWidth?: number
}) {
  void _strokeWidth

  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 overflow-hidden rounded-full", className)}
    >
      <Image
        src="/brands/limitless-lms.png"
        alt=""
        width={180}
        height={180}
        className="h-full w-full object-contain"
      />
    </span>
  )
}
