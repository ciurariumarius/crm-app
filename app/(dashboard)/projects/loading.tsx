export default function ProjectsLoading() {
    return (
        <div className="space-y-5 sm:space-y-6">
            <div className="flex flex-col gap-3.5 sm:gap-4">
                <div className="rounded-[24px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.9))] p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:p-4 lg:p-5">
                    <div className="animate-pulse space-y-3">
                        <div className="h-7 w-28 rounded bg-slate-200" />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="h-11 w-full rounded-[28px] bg-slate-200 sm:max-w-[460px]" />
                            <div className="h-10 w-24 rounded-[16px] bg-slate-200" />
                        </div>
                    </div>
                </div>
                <div className="h-[64px] animate-pulse rounded-[22px] border border-slate-200/80 bg-slate-100/70" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={`projects-loading-card-${index}`}
                        className="rounded-2xl border border-slate-200/80 bg-white/92 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.02)]"
                    >
                        <div className="animate-pulse space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-xl bg-slate-200" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                                    <div className="h-3 w-1/2 rounded bg-slate-200" />
                                </div>
                            </div>
                            <div className="h-8 w-full rounded-full bg-slate-200" />
                            <div className="h-8 w-4/5 rounded-full bg-slate-200" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="h-[78px] animate-pulse rounded-[20px] border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.94))]" />
        </div>
    )
}
