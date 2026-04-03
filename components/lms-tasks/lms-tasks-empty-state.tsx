"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export function LmsTasksEmptyState() {
  return (
    <Card className="rounded-2xl border-[var(--line-subtle)]">
      <CardHeader>
        <CardTitle>No LMS data imported yet</CardTitle>
        <CardDescription>
          Upload task logs to start LMS Analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href="/lms-analysis/data"
          className="inline-flex rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)]"
        >
          Go to Data
        </Link>
      </CardContent>
    </Card>
  )
}
