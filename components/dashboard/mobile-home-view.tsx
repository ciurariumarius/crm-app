"use client"

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock3,
    CreditCard,
    FolderOpen,
    History,
    Plus,
    RotateCw,
    Zap,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, formatCurrency, formatProjectName, formatRelativeDate } from "@/lib/utils"
import { normalizeTaskUrgency } from "@/lib/status"
import { settlePartnerDebt } from "@/lib/actions/settlement"
import { ProjectSheetContext } from "@/components/projects/project-sheet-wrapper"
import { TaskSheetContext } from "@/components/tasks/task-sheet-wrapper"
import { GlobalSearch } from "@/components/dashboard/global-search"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"
import type { Service } from "@prisma/client"
import type {
    FormattedProject,
    PartnerWithSites,
    QuickActionProject,
    SettlementPartner,
} from "@/types"

type UserLite = {
    name?: string | null
    username?: string | null
    profilePic?: string | null
}

type TaskLite = {
    id: string
    name: string
    status?: string | null
    urgency?: string | null
    deadline?: Date | string | null
    project?: {
        name?: string | null
        createdAt?: Date | string | null
        site?: {
            domainName?: string | null
        } | null
        services?: Array<{ serviceName: string; isRecurring?: boolean | null }>
    } | null
}

type SettlementHistoryLite = {
    id: string
    projectName: string
    partnerName: string
    amount: number
    date: Date | string
}

export interface MobileHomeViewProps {
    user?: UserLite | null
    formattedRevenue: string
    unpaidBalance: number
    activeTasks: number
    totalHoursMonth: string
    activeMonthlyProjects: number
    activeOneTimeProjects: number
    upcomingTasks: TaskLite[]
    recurringProjects: FormattedProject[]
    oneTimeProjects: FormattedProject[]
    unpaidByPartner: SettlementPartner[]
    settlementHistory: SettlementHistoryLite[]
    partners: PartnerWithSites[]
    services: Service[]
    quickActionProjects: QuickActionProject[]
    dashboardQueryFailed?: boolean
}

function formatHours(hours: number | string) {
    const value = typeof hours === "number" ? hours : Number(hours || 0)
    if (!Number.isFinite(value)) return "0.0"
    return value.toFixed(1)
}

function splitProjectLabel(projectLabel: string) {
    const [title, ...rest] = projectLabel.split(" - ")
    return {
        title: title || projectLabel,
        subtitle: rest.join(" - "),
    }
}

function splitCurrencyLabel(value: string) {
    const normalized = value.replace(/\u00a0/g, " ").trim()
    const idx = normalized.lastIndexOf(" ")
    if (idx <= 0) return { amount: normalized, code: "RON" }
    return {
        amount: normalized.slice(0, idx),
        code: normalized.slice(idx + 1).toUpperCase(),
    }
}

export function MobileHomeView({
    user,
    formattedRevenue,
    unpaidBalance,
    activeTasks,
    totalHoursMonth,
    activeMonthlyProjects,
    activeOneTimeProjects,
    upcomingTasks,
    recurringProjects,
    oneTimeProjects,
    unpaidByPartner,
    settlementHistory,
    partners,
    services,
    quickActionProjects,
    dashboardQueryFailed = false,
}: MobileHomeViewProps) {
    const router = useRouter()
    const { openProject } = React.useContext(ProjectSheetContext)
    const { openTask } = React.useContext(TaskSheetContext)
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)
    const [settlingPartnerId, setSettlingPartnerId] = React.useState<string | null>(null)
    const [expandedPartners, setExpandedPartners] = React.useState<Set<string>>(new Set())
    const [isSettling, startSettlingTransition] = React.useTransition()

    const togglePartner = (partnerId: string) => {
        const next = new Set(expandedPartners)
        if (next.has(partnerId)) next.delete(partnerId)
        else next.add(partnerId)
        setExpandedPartners(next)
    }

    const name = user?.name?.split(" ")[0] || user?.username || "Admin"
    const monthName = new Date().toLocaleString("en-US", { month: "long" })
    const visibleTasks = upcomingTasks.slice(0, 6)
    const visibleMonthlyProjects = recurringProjects
    const visibleOneTimeProjects = oneTimeProjects
    const visibleUnpaidPartners = unpaidByPartner.slice(0, 3)
    const visibleHistory = settlementHistory.slice(0, 4)

    const liveProjects = activeMonthlyProjects + activeOneTimeProjects
    const revenueLabel = splitCurrencyLabel(formattedRevenue)
    const unpaidLabel = splitCurrencyLabel(formatCurrency(unpaidBalance))

    const handleSettlePartner = (partnerId: string) => {
        setSettlingPartnerId(partnerId)
        startSettlingTransition(async () => {
            const result = await settlePartnerDebt(partnerId)
            if (result.success) {
                toast.success("Partner debt marked as paid")
                router.refresh()
            } else {
                toast.error(result.error || "Failed to mark partner as paid")
            }
            setSettlingPartnerId(null)
        })
    }

    return (
        <div className="md:hidden flex flex-col gap-6">
            <section className="flex items-center justify-between gap-4 pt-1">
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <h1 className="text-[34px] font-semibold text-[var(--text-primary)] leading-none tracking-[-0.03em] truncate">
                        {name}
                    </h1>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <GlobalSearch />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] shadow-sm transition-colors hover:bg-[var(--surface-low)]"
                                aria-label="Quick actions"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                            <DropdownMenuItem
                                onSelect={() => setCreateProjectOpen(true)}
                                className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)]"
                            >
                                Add Project
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={() => setCreateTaskOpen(true)}
                                className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)]"
                            >
                                Add Task
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-[13px] font-semibold tracking-[0.03em] text-[var(--text-secondary)]">Financial overview</h2>
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-3xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-4 shadow-[var(--shadow-apple)]">
                        <p className="text-xs font-semibold tracking-[0.03em] text-[var(--text-secondary)]">{monthName} revenue</p>
                        <p className="mt-2 flex items-baseline gap-1.5">
                            <span className="font-mono text-[36px] font-bold tracking-[-0.02em] text-[var(--primary)] leading-none">{revenueLabel.amount}</span>
                            <span className="font-mono text-xs font-semibold text-[var(--primary)]">{revenueLabel.code}</span>
                        </p>
                    </div>
                    <div className="rounded-3xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-4 shadow-[var(--shadow-apple)]">
                        <p className="text-xs font-semibold tracking-[0.03em] text-[var(--text-secondary)]">Unpaid projects</p>
                        <p className="mt-2 flex items-baseline gap-1.5">
                            <span className="font-mono text-[36px] font-bold tracking-[-0.02em] text-[var(--debt)] leading-none">{unpaidLabel.amount}</span>
                            <span className="font-mono text-xs font-semibold text-[var(--debt)]">{unpaidLabel.code}</span>
                        </p>
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-[13px] font-semibold tracking-[0.03em] text-[var(--text-secondary)]">Projects overview</h2>
                <div className="rounded-3xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-4 shadow-[var(--shadow-apple)]">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="border-r border-[var(--line-subtle)] pr-3">
                            <p className="font-mono text-[34px] font-bold tracking-[-0.02em] text-[var(--primary)] leading-none">{liveProjects}</p>
                            <p className="mt-1 text-xs font-semibold tracking-[0.03em] text-[var(--text-secondary)]">Live projects</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,var(--primary-container)_16%,var(--surface-lowest))] px-2 py-1 text-xs font-semibold text-[var(--primary)]">
                                    <RotateCw className="h-2.5 w-2.5" />
                                    {activeMonthlyProjects}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,var(--primary)_10%,var(--surface-lowest))] px-2 py-1 text-xs font-semibold text-[var(--primary)]">
                                    <Zap className="h-2.5 w-2.5" />
                                    {activeOneTimeProjects}
                                </span>
                            </div>
                        </div>
                        <div className="pl-1">
                            <p className="font-mono text-[34px] font-bold tracking-[-0.02em] text-[var(--text-primary)] leading-none">{activeTasks}</p>
                            <p className="mt-1 text-xs font-semibold tracking-[0.03em] text-[var(--text-secondary)]">Active tasks</p>
                            <p className="mt-3 font-mono text-3xl font-bold leading-none text-[var(--text-primary)]">{formatHours(totalHoursMonth)}h</p>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">worked in {monthName}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <h2 className="text-[13px] font-semibold tracking-[0.03em] text-[var(--text-secondary)]">Your tasks</h2>
                </div>

                {visibleTasks.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
                        No active tasks.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {visibleTasks.map((task) => {
                            const priority = normalizeTaskUrgency(task?.urgency)
                            const priorityPillClass = priority === "High"
                                ? "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 font-semibold"
                                : priority === "Low"
                                  ? "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 font-medium"
                                  : "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-medium"
                            const projectLabel = task?.project ? formatProjectName(task.project) : "No Project"

                            return (
                                <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => openTask(task.id)}
                                    className="w-full rounded-3xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-4 text-left shadow-[var(--shadow-apple)] transition-colors hover:bg-[var(--surface-low)]/70"
                                >
                                    <h3 className="text-[15px] font-semibold text-[var(--text-primary)] leading-snug">{task.name}</h3>
                                    <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                                        {projectLabel}
                                    </p>
                                    <div className="mt-3 flex items-center justify-between gap-2">
                                        <Badge className="rounded-full border border-[color:color-mix(in_srgb,var(--primary-container)_38%,transparent)] bg-[color:color-mix(in_srgb,var(--primary-container)_16%,var(--surface-lowest))] px-2.5 py-1 text-xs font-semibold tracking-[0.03em] text-[var(--primary)]">
                                            {task?.status || "Active"}
                                        </Badge>
                                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs", priorityPillClass)}>
                                            <span className={cn("h-1.5 w-1.5 rounded-full", priority === "High" ? "bg-rose-500" : priority === "Low" ? "bg-zinc-400" : "bg-amber-500")} />
                                            <span>{priority}</span>
                                        </span>
                                    </div>
                                </button>
                            )
                        })}

                        {upcomingTasks.length > 6 ? (
                            <Link
                                href="/tasks"
                                className="inline-flex w-full items-center justify-center rounded-full border border-dashed border-[var(--line-subtle)] px-4 py-2 text-xs font-semibold tracking-[0.03em] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-lowest)]"
                            >
                                View All Tasks
                            </Link>
                        ) : null}
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-[var(--primary)]" />
                    <h2 className="text-[13px] font-semibold tracking-[0.03em] text-[var(--text-secondary)]">Projects</h2>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-xs font-semibold tracking-[0.03em] text-[var(--primary)]">Monthly subscriptions</p>
                        <div className="space-y-2">
                            {visibleMonthlyProjects.map((project) => {
                                return (
                                    <button
                                        key={project.id}
                                        type="button"
                                        onClick={() => openProject(project.id)}
                                        className="w-full rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-3 text-left shadow-[var(--shadow-apple)]"
                                    >
                                        <p className="text-[15px] font-bold leading-tight text-[var(--text-primary)]">{project.siteName || "Untitled project"}</p>
                                        <div className="mt-2 flex items-center justify-between gap-3">
                                            <div className="inline-flex items-center gap-3 text-xs font-semibold text-[var(--text-secondary)]">
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-low)] px-2 py-0.5 text-[var(--primary)]">
                                                    {format(new Date(project.createdAt || new Date()), "MMMM")}
                                                </span>
                                                <p className="font-mono font-bold text-[var(--text-primary)]">
                                                    {formatCurrency(Number(project.currentFee || 0))}
                                                </p>
                                            </div>
                                            <Badge className={cn(
                                                "rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.03em]",
                                                project.paymentStatus === "Paid"
                                                    ? "border border-emerald-200 bg-emerald-50 text-emerald-600"
                                                    : "border border-rose-200 bg-rose-50 text-rose-600"
                                            )}>
                                                {project.paymentStatus}
                                            </Badge>
                                        </div>
                                    </button>
                                )
                            })}
                            {visibleMonthlyProjects.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                                    No monthly projects.
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold tracking-[0.03em] text-[var(--primary)]">Fixed-fee projects</p>
                        <div className="space-y-2">
                            {visibleOneTimeProjects.map((project) => {
                                const parsed = splitProjectLabel(project.siteName || "Untitled project")
                                const minutes = Math.round((Number(project.hoursLogged || 0) % 1) * 60)
                                return (
                                    <button
                                        key={project.id}
                                        type="button"
                                        onClick={() => openProject(project.id)}
                                        className="w-full rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-3 text-left shadow-[var(--shadow-apple)]"
                                    >
                                        <p className="text-[15px] font-semibold leading-tight text-[var(--text-primary)]">{parsed.title}</p>
                                        <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{parsed.subtitle || "No service"}</p>
                                        <div className="mt-2 flex items-center justify-between gap-3">
                                            <div className="inline-flex items-center gap-3 text-xs font-medium text-[var(--text-secondary)]">
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock3 className="h-3 w-3" />
                                                    {Math.floor(Number(project.hoursLogged || 0))}h {minutes}m
                                                </span>
                                                <span>{project.completedTasks}/{project.totalTasks}</span>
                                            </div>
                                            <Badge className={cn(
                                                "rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.03em]",
                                                project.paymentStatus === "Paid"
                                                    ? "border border-emerald-200 bg-emerald-50 text-emerald-600"
                                                    : "border border-rose-200 bg-rose-50 text-rose-600"
                                            )}>
                                                {project.paymentStatus}
                                            </Badge>
                                        </div>
                                    </button>
                                )
                            })}
                            {visibleOneTimeProjects.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                                    No fixed-fee projects.
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <Link
                        href="/projects"
                        className="inline-flex w-full items-center justify-center rounded-full border border-dashed border-[var(--line-subtle)] px-4 py-2 text-xs font-semibold tracking-[0.03em] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-lowest)]"
                    >
                        View All Active Projects
                    </Link>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-[var(--warning)]" />
                    <h2 className="text-[13px] font-semibold tracking-[0.03em] text-[var(--text-secondary)]">Payments</h2>
                </div>

                <div className="rounded-3xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]">
                    <div className="border-b border-[var(--line-subtle)] px-4 py-3">
                        <p className="text-xs font-semibold tracking-[0.03em] text-[var(--text-secondary)]">Due payment</p>
                    </div>
                    {visibleUnpaidPartners.length === 0 ? (
                        <div className="px-4 py-5 text-sm text-[var(--text-secondary)]">No unpaid balances.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {visibleUnpaidPartners.map((partner) => {
                                const currentSettling = isSettling && settlingPartnerId === partner.id
                                const isExpanded = expandedPartners.has(partner.id)
                                return (
                                    <div key={partner.id} className="flex flex-col divide-y divide-slate-50">
                                        <div
                                            onClick={() => togglePartner(partner.id)}
                                            className={cn(
                                                "flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors",
                                                isExpanded && "bg-[var(--surface-low)]/50"
                                            )}
                                        >
                                            <div className="flex-1 min-w-0 flex items-center gap-3">
                                                {isExpanded ? (
                                                    <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                                                )}
                                                <div>
                                                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">{partner.name}</p>
                                                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                                        Owed sum:
                                                        <span className="ml-1 font-mono font-bold text-[var(--debt)]">
                                                            {formatCurrency(partner.totalUnpaid)}
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                disabled={currentSettling}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleSettlePartner(partner.id)
                                                }}
                                                className="h-8 rounded-full px-3 text-xs font-semibold tracking-[0.03em] text-[var(--text-secondary)] hover:bg-emerald-50 hover:text-emerald-700"
                                            >
                                                {currentSettling ? "Saving..." : "Mark Paid"}
                                            </Button>
                                        </div>

                                        {/* Unpaid Projects List */}
                                        {isExpanded && (
                                            <div className="flex flex-col gap-2 px-4 py-3 bg-[var(--surface-low)]/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                                {partner.unpaidProjects.map(project => (
                                                    <div key={project.id} className="flex items-center justify-between py-1 border-b border-[var(--line-subtle)] last:border-0 border-dashed">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <div className="h-1 w-1 rounded-full bg-rose-400 shrink-0" />
                                                            <span className="text-xs font-medium text-[var(--text-secondary)] truncate">{project.name}</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums ml-2">{formatCurrency(project.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="rounded-3xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]">
                    <div className="flex items-center justify-between border-b border-[var(--line-subtle)] px-4 py-3">
                        <div className="inline-flex items-center gap-2">
                            <History className="h-4 w-4 text-[var(--text-secondary)]" />
                            <p className="text-xs font-semibold tracking-[0.03em] text-[var(--text-secondary)]">Payment history</p>
                        </div>
                        <Link href="/payments" className="text-xs font-semibold tracking-[0.03em] text-[var(--primary)]">
                            View all
                        </Link>
                    </div>
                    {visibleHistory.length === 0 ? (
                        <div className="px-4 py-5 text-sm text-[var(--text-secondary)]">No payment history yet.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {visibleHistory.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => openProject(item.id)}
                                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-low)]/70"
                                >
                                    <div className="inline-flex min-w-0 items-start gap-2">
                                        <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                            <CheckCircle2 className="h-3 w-3" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{item.projectName}</p>
                                            <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                                                {item.partnerName} · {formatRelativeDate(item.date)}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="font-mono text-xl font-bold text-emerald-600 leading-none">{splitCurrencyLabel(formatCurrency(item.amount)).amount}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {dashboardQueryFailed ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Dashboard data failed to load fully. Pull to refresh after migrations.
                </div>
            ) : null}

            <GlobalCreateProjectDialog
                open={createProjectOpen}
                onOpenChange={setCreateProjectOpen}
                partners={partners}
                services={services}
            />
            <GlobalCreateTaskDialog
                open={createTaskOpen}
                onOpenChange={setCreateTaskOpen}
                projects={quickActionProjects}
            />
        </div>
    )
}
