import type { ReactNode } from "react"
import Link from "next/link"
import { Upload } from "lucide-react"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { Button } from "@/components/ui/button"
import { LmsTasksProvider } from "@/components/lms-tasks/lms-tasks-provider"

export default function LmsAnalysisLayout({ children }: { children: ReactNode }) {
  return (
    <LmsTasksProvider>
      <div className="space-y-6">
        <DashboardPageHeader
          title="LMS Analysis"
          showMobile
          actions={
            <Button asChild variant="outline" size="sm" className="h-9 gap-2">
              <Link href="/lms-analysis/data">
                <Upload className="h-4 w-4 text-[var(--brand-primary)]" />
                <span>Upload data</span>
              </Link>
            </Button>
          }
          mobileActions={
            <Button asChild variant="outline" size="sm" className="h-9 gap-2">
              <Link href="/lms-analysis/data">
                <Upload className="h-4 w-4" />
                <span>Upload</span>
              </Link>
            </Button>
          }
        />
        {children}
      </div>
    </LmsTasksProvider>
  )
}
