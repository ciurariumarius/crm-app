export default function PaymentsLoading() {
    return (
        <div className="flex flex-col gap-8 pb-10 sm:gap-10">
            <div className="rounded-[28px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5 lg:p-6">
                <div className="animate-pulse space-y-3">
                    <div className="h-7 w-28 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="h-11 w-full rounded-[28px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)] sm:max-w-[420px]" />
                        <div className="h-10 w-24 rounded-[16px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                    </div>
                </div>
            </div>

            <section className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <article
                        key={`payments-kpi-loading-${index}`}
                        className="rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] p-4 shadow-[0_4px_14px_rgba(15,23,42,0.035)] sm:p-5 lg:p-6"
                    >
                        <div className="animate-pulse space-y-3">
                            <div className="h-3.5 w-20 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                            <div className="h-8 w-32 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                            <div className="h-3 w-4/5 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        </div>
                    </article>
                ))}
            </section>

            <div className="flex flex-col gap-8 sm:gap-10">
                <section className="rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:p-5 lg:p-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-6 w-44 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        <div className="h-[260px] rounded-[18px] bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)] sm:h-[300px]" />
                    </div>
                </section>

                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="animate-pulse space-y-2">
                            <div className="h-5 w-44 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                            <div className="h-3 w-64 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        </div>
                    </div>

                    <div className="h-[112px] animate-pulse rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)]" />

                    <div className="space-y-2.5">
                        <div className="hidden h-12 animate-pulse rounded-[20px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)] md:block" />
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div
                                key={`payments-row-loading-${index}`}
                                className="h-[78px] animate-pulse rounded-[20px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_92%,transparent)]"
                            />
                        ))}
                    </div>

                    <div className="h-[78px] animate-pulse rounded-[20px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)]" />
                </div>
            </div>
        </div>
    )
}
