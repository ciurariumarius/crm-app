"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { resolveEffectiveDateRange } from "@/lib/lms-tasks/analytics"
import { useLmsTasksData } from "@/components/lms-tasks/lms-tasks-provider"

export function useLmsDateRange() {
  const searchParams = useSearchParams()
  const { data } = useLmsTasksData()
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  return React.useMemo(
    () =>
      resolveEffectiveDateRange(data.tasks, {
        from: from || null,
        to: to || null,
      }),
    [data.tasks, from, to]
  )
}
