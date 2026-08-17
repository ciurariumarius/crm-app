const pulseClassName = "animate-pulse rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]"

export default function DashboardLoading() {
    return (
        <div className="flex flex-col gap-6 pb-8 sm:gap-8 sm:pb-10">
            <section className="rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)] md:px-5 md:py-4 xl:px-6">
                <div className="animate-pulse space-y-3 md:hidden">
                    <div className={`${pulseClassName} h-7 w-28`} />
                    <div className={`${pulseClassName} h-11 w-full rounded-[20px]`} />
                </div>
                <div className="hidden animate-pulse grid-cols-[minmax(180px,1fr)_minmax(280px,640px)_minmax(160px,1fr)] items-center gap-4 md:grid">
                    <div className={`${pulseClassName} h-7 w-32`} />
                    <div className={`${pulseClassName} h-11 w-full rounded-[20px]`} />
                    <div />
                </div>
            </section>

            <section className="grid grid-cols-2 gap-2 rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-2.5 shadow-[var(--shadow-apple)] sm:p-3 md:grid-cols-4 md:gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`dashboard-action-loading-${index}`} className={`${pulseClassName} h-12 rounded-[12px]`} />
                ))}
            </section>

            <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-5">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={`dashboard-kpi-loading-${index}`}
                        className="min-h-[144px] rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)] sm:p-5"
                    >
                        <div className="animate-pulse space-y-4">
                            <div className={`${pulseClassName} h-3.5 w-24`} />
                            <div className={`${pulseClassName} h-8 w-28`} />
                            {index >= 2 ? <div className={`${pulseClassName} h-2 w-full rounded-full`} /> : null}
                            <div className={`${pulseClassName} h-3 w-28`} />
                        </div>
                    </div>
                ))}
            </section>

            <section className="overflow-hidden rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]">
                <div className="flex items-center justify-between border-b border-[var(--line-subtle)] px-5 py-4">
                    <div className="animate-pulse space-y-2">
                        <div className={`${pulseClassName} h-5 w-28`} />
                        <div className={`${pulseClassName} h-3 w-24`} />
                    </div>
                    <div className={`${pulseClassName} h-9 w-20`} />
                </div>
                <div className="divide-y divide-[var(--line-subtle)]">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={`dashboard-task-loading-${index}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
                            <div className={`${pulseClassName} h-5 w-5 rounded-full`} />
                            <div className="animate-pulse space-y-2">
                                <div className={`${pulseClassName} h-4 w-48 max-w-[55vw]`} />
                                <div className={`${pulseClassName} h-3 w-24`} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
