export default function DashboardLoading() {
    return (
        <div className="flex flex-col gap-7 pb-8 sm:gap-10 sm:pb-10 lg:gap-12">
            <section className="space-y-3.5 sm:space-y-5">
                <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5 lg:p-6">
                    <div className="animate-pulse space-y-3 md:hidden">
                        <div className="h-7 w-28 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        <div className="h-11 w-full rounded-[28px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        <div className="h-10 w-full rounded-[16px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                    </div>
                    <div className="hidden animate-pulse grid-cols-[minmax(0,1fr)_minmax(360px,560px)_auto] items-center gap-4 md:grid lg:gap-6">
                        <div className="h-7 w-32 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        <div className="h-11 w-full rounded-[28px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        <div className="h-10 w-32 justify-self-end rounded-[16px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4 xl:gap-5">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div
                            key={`dashboard-kpi-loading-${index}`}
                            className="rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] p-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.035)] sm:p-5 lg:p-6"
                        >
                            <div className="animate-pulse space-y-3">
                                <div className="h-3.5 w-20 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                                <div className="h-8 w-28 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                                <div className="h-3 w-24 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-8 sm:space-y-10">
                <div className="grid gap-4 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={`dashboard-columns-loading-${index}`}
                            className="rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_92%,transparent)] p-4 shadow-[0_4px_14px_rgba(15,23,42,0.03)] sm:p-5"
                        >
                            <div className="animate-pulse space-y-3.5">
                                <div className="h-5 w-28 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                                {Array.from({ length: 3 }).map((__, rowIndex) => (
                                    <div key={`dashboard-column-row-${index}-${rowIndex}`} className="h-16 rounded-[16px] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)]" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-[26px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:p-5 lg:p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-48 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                    <div className="h-[280px] rounded-[20px] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] sm:h-[320px]" />
                </div>
            </section>
        </div>
    )
}
