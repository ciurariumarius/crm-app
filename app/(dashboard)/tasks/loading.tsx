export default function TasksLoading() {
    return (
        <div className="flex flex-col gap-3.5 sm:gap-4">
            <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 shadow-[var(--shadow-apple)] sm:p-4 lg:p-5">
                <div className="animate-pulse space-y-3">
                    <div className="h-7 w-20 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="h-11 w-full rounded-[20px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)] sm:max-w-[460px]" />
                        <div className="h-10 w-24 rounded-[16px] bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                    </div>
                </div>
            </div>

            <div className="h-[64px] animate-pulse rounded-[16px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_82%,transparent)]" />

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={`tasks-loading-card-${index}`}
                        className="rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)] sm:p-5"
                    >
                        <div className="animate-pulse space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="h-4 w-2/3 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                                <div className="h-6 w-16 rounded-lg bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                            </div>
                            <div className="h-3 w-1/2 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                            <div className="h-3 w-5/6 rounded bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                            <div className="flex items-center justify-between pt-2">
                                <div className="h-7 w-24 rounded-xl bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                                <div className="h-7 w-20 rounded-xl bg-[color:color-mix(in_srgb,var(--surface-highest)_72%,var(--surface-lowest)_28%)]" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="h-[74px] animate-pulse rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)]" />

            <div className="h-[78px] animate-pulse rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)]" />
        </div>
    )
}
