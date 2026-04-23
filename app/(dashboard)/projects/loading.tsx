export default function ProjectsLoading() {
    return (
        <div className="space-y-5 sm:space-y-6">
            <div className="flex flex-col gap-3.5 sm:gap-4">
                <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:p-4 lg:p-5">
                    <div className="animate-pulse space-y-3">
                        <div className="h-7 w-28 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="h-11 w-full rounded-[28px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)] sm:max-w-[460px]" />
                            <div className="h-10 w-24 rounded-[16px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        </div>
                    </div>
                </div>
                <div className="h-[64px] animate-pulse rounded-[22px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)]" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={`projects-loading-card-${index}`}
                        className="rounded-2xl border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_92%,transparent)] p-4 shadow-[0_2px_10px_rgba(15,23,42,0.02)]"
                    >
                        <div className="animate-pulse space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-xl bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="h-4 w-3/4 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                                    <div className="h-3 w-1/2 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                                </div>
                            </div>
                            <div className="h-8 w-full rounded-full bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                            <div className="h-8 w-4/5 rounded-full bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="h-[78px] animate-pulse rounded-[20px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)]" />
        </div>
    )
}
