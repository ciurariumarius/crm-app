export default function PaymentsLoading() {
    return (
        <div className="flex flex-col gap-8 pb-10 sm:gap-10">
            <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 shadow-[var(--shadow-apple)] sm:p-5 lg:p-6">
                <div className="animate-pulse space-y-3">
                    <div className="h-7 w-28 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="h-11 w-full rounded-[20px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)] sm:max-w-[420px]" />
                        <div className="h-10 w-24 rounded-[16px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                    </div>
                </div>
            </div>

            <section className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <article
                        key={`payments-kpi-loading-${index}`}
                        className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)] sm:p-5 lg:p-6"
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
                <section className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)] sm:p-5 lg:p-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-6 w-44 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        <div className="h-[260px] rounded-[14px] bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)] sm:h-[300px]" />
                    </div>
                </section>

                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="animate-pulse space-y-2">
                            <div className="h-5 w-44 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                            <div className="h-3 w-64 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                        </div>
                    </div>

                    <div className="h-[112px] animate-pulse rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)]" />

                    <div className="space-y-2.5">
                        <div className="hidden h-12 animate-pulse rounded-[20px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)] md:block" />
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div
                                key={`payments-row-loading-${index}`}
                                className="h-[78px] animate-pulse rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)]"
                            />
                        ))}
                    </div>

                    <div className="h-[78px] animate-pulse rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)]" />
                </div>
            </div>
        </div>
    )
}
