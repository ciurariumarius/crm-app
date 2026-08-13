import Link from "next/link"
import { Facebook, ArrowLeft } from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { SectionCard } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export default function FacebookAdsPage() {
    return (
        <div className="ui-page-stack">
            <AppPageHeader title="Facebook Ads" subtitle="Meta campaign monitoring and account performance." />
            <SectionCard className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-secondary)]">
                    <Facebook className="h-6 w-6" />
                </div>
                <h2 className="mt-5 ui-text-section">Integration not configured</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                    Facebook Ads data is not connected yet. This workspace will remain empty until a data source is configured.
                </p>
                <Button asChild variant="outline" className="mt-6">
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                        Return to Overview
                    </Link>
                </Button>
            </SectionCard>
        </div>
    )
}
