"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { Building2, CalendarDays, Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"
import { ProjectSheetContext } from "@/components/projects/project-sheet-wrapper"
import { useProjectsSearchContext } from "./projects-search-context"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { normalizeProjectStatus } from "@/lib/status"
import { updateProject } from "@/lib/actions/projects"
import { toast } from "sonner"
import { PartnerWithSites } from "@/types"
import { Service } from "@prisma/client"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { ProjectBoardHeaderRow } from "@/components/projects/project-board-header-row"
import { ProjectBoardSummaryCards } from "@/components/projects/project-board-summary-cards"
import { StatusChip, statusToneFromLabel } from "@/components/ui/status-chip"
import { CloseProjectDialog } from "@/components/projects/close-project-dialog"
import type { SearchPaginationState } from "@/types/search-pagination"

const currencyFormatter = new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
})
const PROJECT_ROW_CHIP_CLASS = "h-6 min-w-[84px] px-2.5 text-xs leading-none tracking-[0.06em] whitespace-nowrap"

function formatDuration(totalSeconds: number) {
    if (totalSeconds <= 0) return "0h 0m"
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return `${hours}h ${minutes}m`
}

const LIST_GRID_COLUMNS = "grid-cols-[minmax(280px,2.35fr)_84px_92px_88px_110px_70px_84px_124px_112px] xl:grid-cols-[minmax(320px,2.7fr)_88px_96px_92px_116px_72px_88px_136px_120px]"

function toTimestamp(value: Date | string | null | undefined) {
    if (!value) return null
    const date = new Date(value)
    const timestamp = date.getTime()
    return Number.isNaN(timestamp) ? null : timestamp
}

function formatDateTimeParts(value: Date | string | null | undefined) {
    if (!value) return { dateLabel: "—", dateTimeLabel: "—" }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return { dateLabel: "—", dateTimeLabel: "—" }
    return {
        dateLabel: format(date, "dd/MM/yy"),
        dateTimeLabel: format(date, "dd/MM/yy, HH:mm"),
    }
}

function toDateInputValue(value: Date | string | null | undefined) {
    if (!value) return undefined
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return undefined
    const year = parsed.getFullYear()
    const month = `${parsed.getMonth() + 1}`.padStart(2, "0")
    const day = `${parsed.getDate()}`.padStart(2, "0")
    return `${year}-${month}-${day}`
}

function normalizeDomain(domain: string | null | undefined) {
    return (domain || "").trim().replace(/^https?:\/\//, "").split("/")[0]
}

function getFaviconCandidates(domain: string | null | undefined, storedFaviconUrl?: string | null) {
    const normalized = normalizeDomain(domain)
    if (!normalized) return storedFaviconUrl ? [storedFaviconUrl] : []
    return [
        ...(storedFaviconUrl ? [storedFaviconUrl] : []),
        `https://${normalized}/favicon.ico`,
    ]
}

function getDomainInitials(domain: string | null | undefined) {
    const normalized = normalizeDomain(domain)
    if (!normalized) return "??"
    const token = normalized.split(".")[0] || normalized
    return token.slice(0, 2).toUpperCase()
}


function DomainFaviconTile({
    domain,
    faviconUrl,
}: {
    domain: string | null | undefined
    faviconUrl?: string | null
}) {
    const [failed, setFailed] = React.useState(false)
    const [candidateIndex, setCandidateIndex] = React.useState(0)
    const candidates = React.useMemo(() => getFaviconCandidates(domain, faviconUrl), [domain, faviconUrl])
    const activeFaviconUrl = candidates[candidateIndex] || null
    const fallback = getDomainInitials(domain)

    React.useEffect(() => {
        setFailed(false)
        setCandidateIndex(0)
    }, [domain])

    return (
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)]">
            {!failed && activeFaviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={activeFaviconUrl}
                    alt=""
                    className="h-7 w-7 rounded-md object-contain"
                    loading="lazy"
                    onLoad={(event) => {
                        const { naturalWidth, naturalHeight } = event.currentTarget
                        // Avoid blurry placeholders from low-res/default favicons.
                        if (naturalWidth < 24 || naturalHeight < 24) {
                            if (candidateIndex < candidates.length - 1) {
                                setCandidateIndex((prev) => prev + 1)
                                return
                            }
                            setFailed(true)
                        }
                    }}
                    onError={() => {
                        if (candidateIndex < candidates.length - 1) {
                            setCandidateIndex((prev) => prev + 1)
                            return
                        }
                        setFailed(true)
                    }}
                />
            ) : (
                <span className="text-xs font-extrabold tracking-wide text-[var(--text-secondary)]">{fallback}</span>
            )}
        </span>
    )
}

function DateTimeCell({ value }: { value: Date | string | null | undefined }) {
    const { dateLabel, dateTimeLabel } = formatDateTimeParts(value)
    return (
        <div className="flex items-center justify-start gap-1.5" title={dateTimeLabel}>
            <CalendarDays className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">{dateLabel}</span>
        </div>
    )
}

function getProjectCardSubtitle(project: BoardProject) {
    const serviceLabel = project.serviceLabel.trim()
    const fallback = project.name?.trim() || "No service"
    if (!project.isRecurring) return serviceLabel || fallback

    const createdAt = new Date(project.createdAt)
    if (Number.isNaN(createdAt.getTime())) return serviceLabel || fallback
    return `${serviceLabel || fallback} - ${format(createdAt, "MMMM yyyy")}`
}

function EmptyProjectsState({
    title,
    description,
}: {
    title: string
    description: string
}) {
    return (
        <div className="rounded-[20px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_80%,transparent)] px-5 py-9 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]">
                <Building2 className="h-5 w-5 text-[var(--text-muted)]" />
            </div>
            <p className="mt-4 text-sm font-semibold tracking-tight text-[var(--text-primary)]">{title}</p>
            <p className="mx-auto mt-1 max-w-md text-sm font-medium leading-6 text-[var(--text-secondary)]">
                {description}
            </p>
        </div>
    )
}

function ProjectsGridSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
                <div
                    key={`project-grid-skeleton-${index}`}
                    className="min-h-[176px] rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)] sm:aspect-[4/3] sm:min-h-[190px] sm:p-5 xl:min-h-[205px]"
                >
                    <div className="animate-pulse space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-xl bg-[var(--surface-low)]" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="h-4 w-3/4 rounded bg-[var(--surface-low)]" />
                                <div className="h-3 w-1/2 rounded bg-[var(--surface-low)]" />
                            </div>
                            <div className="h-6 w-20 rounded-full bg-[var(--surface-low)]" />
                        </div>
                        <div className="h-8 w-full rounded-full bg-[var(--surface-low)]" />
                        <div className="h-8 w-4/5 rounded-full bg-[var(--surface-low)]" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function ProjectsListSkeleton() {
    return (
        <div className="space-y-6 overflow-x-auto pb-0 hidescrollbar">
            <div className="space-y-6 md:min-w-[1240px] xl:min-w-[1320px]">
                {Array.from({ length: 2 }).map((_, sectionIndex) => (
                    <section
                        key={`project-list-skeleton-section-${sectionIndex}`}
                        className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-[var(--shadow-apple)] sm:p-4"
                    >
                        <div className="mb-3 flex items-center gap-3">
                            <span className="h-5 w-1 rounded-full bg-[var(--surface-low)]" />
                            <div className="h-5 w-40 animate-pulse rounded bg-[var(--surface-low)]" />
                        </div>

                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, rowIndex) => (
                                <div
                                    key={`project-list-skeleton-row-${sectionIndex}-${rowIndex}`}
                                    className="h-[72px] animate-pulse rounded-[14px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)]"
                                />
                            ))}
                        </div>
                    </section>
                ))}

                <div className="h-[74px] animate-pulse rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)]" />
            </div>
        </div>
    )
}

type BoardProject = {
    id: string
    name?: string | null
    status: string
    paymentStatus: string
    amount: number
    recurringBaseFee?: number | null
    secondsLogged: number
    completedTasks: number
    createdAt: string | Date
    updatedAt: string | Date
    closedAt?: string | Date | null
    isHeavyRevenueMonth?: boolean
    isRecurring: boolean
    serviceLabel: string
    site: {
        domainName: string
        faviconUrl?: string | null
        partner: {
            name: string
        }
    }
    _count?: {
        tasks?: number
    }
    tasks?: unknown[]
}

type TotalsSummary = {
    count: number
    totalAmount: number
    totalSeconds: number
}

type BoardSortBy = "createdAt" | "updatedAt" | "amount" | "name" | "time"
type BoardSortDirection = "asc" | "desc"
type SearchApiFilters = {
    projectId?: string
    status: string
    payment: string
    recurring: string
    sort: string
    partnerId?: string
    period?: string
    from?: string
    to?: string
    page: number
    perPage: number
}

export function ProjectsBoardRows({
    projects,
    layout,
    partners = [],
    services = [],
    hourlyRate = 0,
    initialSortBy = "updatedAt",
    initialSortDirection = "desc",
    searchApiFilters,
}: {
    projects: BoardProject[]
    layout: "grid" | "list"
    partners?: PartnerWithSites[]
    services?: Service[]
    hourlyRate?: number
    initialSortBy?: BoardSortBy
    initialSortDirection?: BoardSortDirection
    searchApiFilters?: SearchApiFilters
}) {
    const { openProject } = React.useContext(ProjectSheetContext)
    const searchParams = useSearchParams()
    const searchParamsString = searchParams.toString()
    const searchContext = useProjectsSearchContext()
    const [sortBy, setSortBy] = React.useState<BoardSortBy>(initialSortBy)
    const [sortDirection, setSortDirection] = React.useState<BoardSortDirection>(initialSortDirection)
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [inlineEdits, setInlineEdits] = React.useState<Record<string, { status?: string; paymentStatus?: string; amount?: number; recurringBaseFee?: number | null }>>({})
    const [amountEditorProjectId, setAmountEditorProjectId] = React.useState<string | null>(null)
    const [amountDraft, setAmountDraft] = React.useState("")
    const [amountScope, setAmountScope] = React.useState<"CURRENT_MONTH" | "CURRENT_AND_FUTURE" | "FUTURE_MONTHS">("CURRENT_MONTH")
    const [closeDialogProject, setCloseDialogProject] = React.useState<BoardProject | null>(null)
    const [isSubmittingCloseDialog, setIsSubmittingCloseDialog] = React.useState(false)
    const [remoteProjects, setRemoteProjects] = React.useState<BoardProject[] | null>(null)
    const searchCacheRef = React.useRef<
        Map<string, { projects: BoardProject[]; total: number; pagination: SearchPaginationState }>
    >(new Map())

    React.useEffect(() => {
        setSortBy(initialSortBy)
        setSortDirection(initialSortDirection)
    }, [initialSortBy, initialSortDirection])

    const setSort = (key: BoardSortBy) => {
        if (sortBy === key) {
            setSortDirection((current) => (current === "desc" ? "asc" : "desc"))
            return
        }

        setSortBy(key)
        setSortDirection(key === "name" ? "asc" : "desc")
    }

    const sortProjects = React.useCallback(
        (items: BoardProject[]) =>
            [...items].sort((a, b) => {
                let leftValue: number | string | null
                let rightValue: number | string | null

                if (sortBy === "name") {
                    leftValue = (a.site?.domainName || a.name || "").toLowerCase()
                    rightValue = (b.site?.domainName || b.name || "").toLowerCase()
                } else if (sortBy === "amount") {
                    leftValue = Number(a.amount || 0)
                    rightValue = Number(b.amount || 0)
                } else if (sortBy === "time") {
                    leftValue = Number(a.secondsLogged || 0)
                    rightValue = Number(b.secondsLogged || 0)
                } else if (sortBy === "updatedAt") {
                    leftValue = toTimestamp(a.updatedAt)
                    rightValue = toTimestamp(b.updatedAt)
                } else {
                    leftValue = toTimestamp(a.createdAt)
                    rightValue = toTimestamp(b.createdAt)
                }

                if (leftValue === null && rightValue === null) return 0
                if (leftValue === null) return 1
                if (rightValue === null) return -1

                if (leftValue < rightValue) return sortDirection === "desc" ? 1 : -1
                if (leftValue > rightValue) return sortDirection === "desc" ? -1 : 1
                return 0
            }),
        [sortBy, sortDirection]
    )

    const normalizedSearch = (searchContext?.searchTerm || "").trim().toLowerCase()
    const debouncedSearch = useDebounce(normalizedSearch, 250)
    const showSearchSkeleton = Boolean(searchContext?.isSearching && debouncedSearch)

    React.useEffect(() => {
        if (!searchContext) return
        if (!debouncedSearch) {
            setRemoteProjects(null)
            searchContext.setSearchResultCount(null)
            searchContext.setSearchPagination(null)
            searchContext.setIsSearching(false)
            return
        }

        const params = new URLSearchParams()
        const locationParams = new URLSearchParams(searchParamsString)
        const locationPage = Number(locationParams?.get("page"))
        const effectivePage = Number.isFinite(locationPage) && locationPage > 0
            ? Math.floor(locationPage)
            : (searchApiFilters?.page || 1)
        const locationPerPage = Number(locationParams?.get("perPage"))
        const effectivePerPage = Number.isFinite(locationPerPage) && locationPerPage > 0
            ? Math.floor(locationPerPage)
            : (searchApiFilters?.perPage || 100)
        params.set("q", debouncedSearch)
        params.set("limit", "1000")
        params.set("page", String(effectivePage))
        params.set("perPage", String(effectivePerPage))
        params.set(
            "status",
            searchContext.statusRefined ? (searchApiFilters?.status || "Active") : "All"
        )
        if (searchApiFilters?.payment) params.set("payment", searchApiFilters.payment)
        if (searchApiFilters?.recurring) params.set("recurring", searchApiFilters.recurring)
        if (searchApiFilters?.sort) params.set("sort", searchApiFilters.sort)
        if (searchApiFilters?.projectId) params.set("projectId", searchApiFilters.projectId)
        if (searchApiFilters?.partnerId) params.set("partnerId", searchApiFilters.partnerId)
        if (searchApiFilters?.period) params.set("period", searchApiFilters.period)
        if (searchApiFilters?.from) params.set("from", searchApiFilters.from)
        if (searchApiFilters?.to) params.set("to", searchApiFilters.to)

        const cacheKey = params.toString()
        const cached = searchCacheRef.current.get(cacheKey)
        if (cached) {
            setRemoteProjects(cached.projects)
            searchContext.setSearchResultCount(cached.total)
            searchContext.setSearchPagination(cached.pagination)
            searchContext.setIsSearching(false)
            return
        }

        const controller = new AbortController()
        let cancelled = false
        searchContext.setIsSearching(true)

        void fetch(`/api/search/projects?${cacheKey}`, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
        })
            .then(async (response) => {
                if (!response.ok) return null
                return response.json()
            })
            .then((payload) => {
                if (cancelled || !payload?.success) return
                const nextProjects = Array.isArray(payload.projects) ? (payload.projects as BoardProject[]) : []
                const total = Number(payload.total || 0)
                const pagination = payload?.pagination as SearchPaginationState | undefined
                const safePagination: SearchPaginationState = pagination ?? {
                    total,
                    page: 1,
                    perPage: effectivePerPage,
                    totalPages: 1,
                    pageStart: total > 0 ? 1 : 0,
                    pageEnd: total,
                    shouldPaginate: false,
                    prevPage: null,
                    nextPage: null,
                }
                searchCacheRef.current.set(cacheKey, { projects: nextProjects, total, pagination: safePagination })
                setRemoteProjects(nextProjects)
                searchContext.setSearchResultCount(total || nextProjects.length)
                searchContext.setSearchPagination(safePagination)
            })
            .catch((error) => {
                if (controller.signal.aborted) return
                console.error("Project search failed", error)
            })
            .finally(() => {
                if (cancelled) return
                searchContext.setIsSearching(false)
            })

        return () => {
            cancelled = true
            controller.abort()
        }
    }, [
        debouncedSearch,
        searchApiFilters?.from,
        searchApiFilters?.page,
        searchApiFilters?.projectId,
        searchApiFilters?.partnerId,
        searchApiFilters?.perPage,
        searchApiFilters?.payment,
        searchApiFilters?.period,
        searchApiFilters?.recurring,
        searchApiFilters?.sort,
        searchApiFilters?.status,
        searchApiFilters?.to,
        searchParamsString,
        searchContext,
    ])

    const searchSourceProjects = remoteProjects ?? projects
    const filteredProjects = React.useMemo(() => {
        if (!normalizedSearch) return searchSourceProjects
        if (remoteProjects) return remoteProjects
        return searchSourceProjects.filter((project) => {
            const searchableText = [
                project.name,
                project.site?.domainName,
                project.site?.partner?.name,
                project.serviceLabel,
                project.status,
                project.paymentStatus,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
            return searchableText.includes(normalizedSearch)
        })
    }, [normalizedSearch, remoteProjects, searchSourceProjects])

    const monthlyProjects = sortProjects(filteredProjects.filter((project) => project.isRecurring))
    const oneTimeProjects = sortProjects(filteredProjects.filter((project) => !project.isRecurring))
    const totals = React.useMemo(() => {
        return filteredProjects.reduce<TotalsSummary>(
            (acc, project) => {
                acc.count += 1
                acc.totalAmount += Number(inlineEdits[project.id]?.amount ?? project.amount ?? 0)
                acc.totalSeconds += Number(project.secondsLogged || 0)
                return acc
            },
            { count: 0, totalAmount: 0, totalSeconds: 0 }
        )
    }, [filteredProjects, inlineEdits])

    const oneTimeCount = oneTimeProjects.length
    const monthlyCount = monthlyProjects.length

    const openDetails = (project: BoardProject) => {
        openProject(project.id)
    }

    const getDisplayStatus = (project: BoardProject) =>
        normalizeProjectStatus(inlineEdits[project.id]?.status ?? project.status)

    const getDisplayPayment = (project: BoardProject) =>
        inlineEdits[project.id]?.paymentStatus ?? project.paymentStatus

    const getDisplayAmount = (project: BoardProject) =>
        Number(inlineEdits[project.id]?.amount ?? project.amount ?? 0)

    const getDisplayRecurringBaseFee = (project: BoardProject) =>
        Number(inlineEdits[project.id]?.recurringBaseFee ?? project.recurringBaseFee ?? getDisplayAmount(project))

    const getAllocatedSeconds = (project: BoardProject) => {
        const rate = Number(hourlyRate || 0)
        if (rate <= 0) return null
        const amount = getDisplayAmount(project)
        if (amount <= 0) return null
        return (amount / rate) * 3600
    }

    const isTimeOverAllocated = (project: BoardProject) => {
        const allocatedSeconds = getAllocatedSeconds(project)
        if (!allocatedSeconds) return false
        return Number(project.secondsLogged || 0) > allocatedSeconds
    }

    const getProjectToneClass = (status: string) => {
        if (status === "Paused") return "project-state-paused"
        if (status === "Completed") return "project-state-completed"
        if (status === "Closed") return "project-state-closed"
        return "project-state-active"
    }

    const getProjectTitleClass = (status: string) => {
        if (status === "Completed") return "text-[var(--text-primary)]"
        if (status === "Closed") return "text-[var(--text-secondary)]"
        return "text-[var(--text-primary)]"
    }

    const getProjectMetaClass = (status: string) => {
        if (status === "Closed") return "text-[var(--text-muted)]"
        if (status === "Completed") return "text-[var(--text-secondary)]"
        return "text-[var(--text-secondary)]"
    }

    const setProjectStatus = async (
        project: BoardProject,
        nextStatus: "Active" | "Paused" | "Completed" | "Closed",
        closePayload?: { closedOn: string; isHeavyRevenueMonth: boolean }
    ) => {
        if (nextStatus === "Closed" && !closePayload) {
            setCloseDialogProject(project)
            return false
        }

        const previousStatus = inlineEdits[project.id]?.status ?? project.status
        setInlineEdits((prev) => ({
            ...prev,
            [project.id]: { ...prev[project.id], status: nextStatus },
        }))

        const result = await updateProject(project.id, {
            status: nextStatus,
            ...(closePayload
                ? {
                    closedAt: closePayload.closedOn,
                    isHeavyRevenueMonth: closePayload.isHeavyRevenueMonth,
                }
                : {}),
        })
        if (!result.success) {
            setInlineEdits((prev) => ({
                ...prev,
                [project.id]: { ...prev[project.id], status: previousStatus },
            }))
            toast.error(result.error || "Failed to update status")
            return false
        }

        return true
    }

    const handleConfirmCloseProject = async ({ closedOn, isHeavyRevenueMonth }: { closedOn: string; isHeavyRevenueMonth: boolean }) => {
        if (!closeDialogProject) return
        setIsSubmittingCloseDialog(true)
        try {
            const success = await setProjectStatus(closeDialogProject, "Closed", {
                closedOn,
                isHeavyRevenueMonth,
            })
            if (success) {
                setCloseDialogProject(null)
            }
        } finally {
            setIsSubmittingCloseDialog(false)
        }
    }

    const setProjectPayment = async (project: BoardProject, nextPayment: "Paid" | "Unpaid") => {
        setInlineEdits((prev) => ({
            ...prev,
            [project.id]: { ...prev[project.id], paymentStatus: nextPayment },
        }))

        const result = await updateProject(project.id, { paymentStatus: nextPayment })
        if (!result.success) {
            setInlineEdits((prev) => ({
                ...prev,
                [project.id]: { ...prev[project.id], paymentStatus: project.paymentStatus },
            }))
            toast.error(result.error || "Failed to update payment status")
        }
    }

    const openAmountEditor = (project: BoardProject) => {
        setAmountEditorProjectId(project.id)
        setAmountDraft(String(getDisplayAmount(project)))
        setAmountScope("CURRENT_MONTH")
    }

    const selectAmountScope = (
        project: BoardProject,
        nextScope: "CURRENT_MONTH" | "CURRENT_AND_FUTURE" | "FUTURE_MONTHS"
    ) => {
        setAmountScope(nextScope)
        setAmountDraft(String(nextScope === "FUTURE_MONTHS"
            ? getDisplayRecurringBaseFee(project)
            : getDisplayAmount(project)))
    }

    const saveProjectAmount = async (project: BoardProject) => {
        const normalized = amountDraft.trim().replace(",", ".")
        const parsed = Number(normalized)

        if (!normalized.length || Number.isNaN(parsed) || parsed < 0) {
            toast.error("Enter a valid amount")
            return
        }

        const previousAmount = getDisplayAmount(project)
        const previousRecurringBaseFee = getDisplayRecurringBaseFee(project)
        setInlineEdits((prev) => ({
            ...prev,
            [project.id]: {
                ...prev[project.id],
                ...(amountScope !== "FUTURE_MONTHS" ? { amount: parsed } : {}),
                ...(project.isRecurring && amountScope !== "CURRENT_MONTH" ? { recurringBaseFee: parsed } : {}),
            },
        }))
        setAmountEditorProjectId(null)

        const result = await updateProject(project.id, {
            currentFee: parsed,
            ...(project.isRecurring ? { feeScope: amountScope } : {}),
        })
        if (!result.success) {
            setInlineEdits((prev) => ({
                ...prev,
                [project.id]: {
                    ...prev[project.id],
                    amount: previousAmount,
                    recurringBaseFee: previousRecurringBaseFee,
                },
            }))
            toast.error(result.error || "Failed to update amount")
        }
    }

    const renderAmountEditor = (project: BoardProject) => (
        <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Amount (RON)</p>
            <input
                value={amountDraft}
                onChange={(event) => setAmountDraft(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault()
                        void saveProjectAmount(project)
                    }
                    if (event.key === "Escape") {
                        setAmountEditorProjectId(null)
                    }
                }}
                className="h-9 w-full rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2 text-sm outline-none focus:border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--ring)_28%,transparent)]"
                autoFocus
            />
            {project.isRecurring ? (
                <fieldset className="space-y-2 border-t border-[var(--line-subtle)] pt-3">
                    <legend className="sr-only">Aplică suma pentru</legend>
                    <label className="flex cursor-pointer items-start gap-2 text-xs font-medium text-[var(--text-secondary)]">
                        <input
                            type="radio"
                            name={`board-fee-scope-${project.id}`}
                            checked={amountScope === "CURRENT_MONTH"}
                            onChange={() => selectAmountScope(project, "CURRENT_MONTH")}
                            className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]"
                        />
                        <span>Doar luna aceasta</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-xs font-medium text-[var(--text-secondary)]">
                        <input
                            type="radio"
                            name={`board-fee-scope-${project.id}`}
                            checked={amountScope === "CURRENT_AND_FUTURE"}
                            onChange={() => selectAmountScope(project, "CURRENT_AND_FUTURE")}
                            className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]"
                        />
                        <span>Luna aceasta + viitoare</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-xs font-medium text-[var(--text-secondary)]">
                        <input
                            type="radio"
                            name={`board-fee-scope-${project.id}`}
                            checked={amountScope === "FUTURE_MONTHS"}
                            onChange={() => selectAmountScope(project, "FUTURE_MONTHS")}
                            className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]"
                        />
                        <span>Lunile viitoare</span>
                    </label>
                </fieldset>
            ) : null}
            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)]"
                    onClick={() => setAmountEditorProjectId(null)}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className="rounded-md bg-[var(--brand-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-primary)]"
                    onClick={() => void saveProjectAmount(project)}
                >
                    Save
                </button>
            </div>
        </div>
    )

    const closeProjectDialog = (
        <CloseProjectDialog
            open={Boolean(closeDialogProject)}
            onOpenChange={(open) => {
                if (!open) setCloseDialogProject(null)
            }}
            onConfirm={handleConfirmCloseProject}
            projectName={closeDialogProject?.site?.domainName || closeDialogProject?.name || undefined}
            isSubmitting={isSubmittingCloseDialog}
            initialClosedOn={toDateInputValue(closeDialogProject?.closedAt)}
            initialIsHeavyRevenueMonth={Boolean(closeDialogProject?.isHeavyRevenueMonth)}
        />
    )

    if (showSearchSkeleton) {
        return layout === "grid" ? <ProjectsGridSkeleton /> : <ProjectsListSkeleton />
    }

    if (layout === "grid") {
        const renderCardGroup = (title: string, entries: BoardProject[], recurring: boolean) => {
            if (entries.length === 0) return null
            return (
                <section className="space-y-3.5" aria-label={title}>
                    <div className="flex items-center gap-2 px-1">
                        <span className={cn("h-2.5 w-2.5 rounded-full", recurring ? "bg-[var(--brand-primary)]" : "bg-[var(--state-success)]")} />
                        <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
                        <span className="text-xs font-semibold text-[var(--text-muted)]">{entries.length}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:gap-6">
                        {entries.map((project) => {
                            const projectStatus = getDisplayStatus(project)
                            const projectPayment = getDisplayPayment(project)
                            const cardSubtitle = getProjectCardSubtitle(project)

                            return (
                                <button
                                    key={project.id}
                                    type="button"
                                    onClick={() => openDetails(project)}
                                    className={cn(
                                        "group flex min-h-[176px] min-w-0 flex-col rounded-[20px] border border-[color:color-mix(in_srgb,var(--line-subtle)_90%,transparent)] bg-[var(--surface-lowest)] p-4 text-left shadow-[var(--shadow-apple)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--brand-primary)_22%,var(--line-subtle))] focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 sm:aspect-[4/3] sm:min-h-[190px] sm:p-5 xl:min-h-[205px]",
                                        getProjectToneClass(projectStatus)
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <DomainFaviconTile domain={project.site.domainName} faviconUrl={project.site.faviconUrl} />
                                        <div className="flex flex-wrap justify-end gap-1.5">
                                            <StatusChip tone={statusToneFromLabel(projectStatus)} size="xs">{projectStatus}</StatusChip>
                                            <StatusChip tone={projectPayment === "Paid" ? "paid" : "unpaid"} size="xs">{projectPayment}</StatusChip>
                                        </div>
                                    </div>

                                    <div className="mt-4 min-w-0">
                                        <h3 className={cn("line-clamp-2 text-[19px] font-bold leading-[1.18] tracking-[-0.02em] transition-colors group-hover:text-[var(--brand-primary)] sm:text-xl", getProjectTitleClass(projectStatus))}>
                                            {project.site.domainName || project.name || "Untitled project"}
                                        </h3>
                                        <p className={cn("mt-3 line-clamp-2 text-[15px] font-bold", getProjectMetaClass(projectStatus))}>{cardSubtitle}</p>
                                    </div>

                                    <div className="mt-auto flex items-end justify-between gap-3 border-t border-[var(--line-subtle)] pt-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">Amount</p>
                                            <p className="mt-1 font-mono text-sm font-bold text-[var(--text-primary)]">{currencyFormatter.format(getDisplayAmount(project))} RON</p>
                                        </div>
                                        <span className="text-xs font-semibold text-[var(--text-muted)]">{project.isRecurring ? "Recurring" : "One-time"}</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </section>
            )
        }

        return (
            <>
                {filteredProjects.length === 0 ? <EmptyProjectsState title="No projects found" description="Try a different search or reset the active filters." /> : null}
                <div className="space-y-8">
                    {renderCardGroup("Recurring projects", monthlyProjects, true)}
                    {renderCardGroup("One-time projects", oneTimeProjects, false)}
                </div>
                {closeProjectDialog}
            </>
        )
    }

    return (
        <>
            <div className="space-y-6 overflow-x-auto pb-0 hidescrollbar">
                <div className="space-y-6 md:min-w-[1240px] xl:min-w-[1320px]">
                <section className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-[var(--shadow-apple)] sm:p-4">
                    <div className="mb-3 flex items-center gap-3">
                        <span className="h-5 w-1 rounded-full bg-[var(--state-success)]" />
                        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">One-time Projects</h2>
                    </div>

                    <ProjectBoardHeaderRow
                        gridColumnsClassName={LIST_GRID_COLUMNS}
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={setSort}
                    />

                    <div className="space-y-2">
                        {oneTimeProjects.length === 0 && (
                            <EmptyProjectsState
                                title={normalizedSearch ? "No one-time projects found" : "No one-time projects in this view"}
                                description={
                                    normalizedSearch
                                        ? "Try a different search term or broaden your filters to bring one-time projects back into view."
                                        : "Adjust your filters or add a new one-time project to start tracking it here."
                                }
                            />
                        )}
                        {oneTimeProjects.map((project) => {
                            const projectStatus = getDisplayStatus(project)
                            const projectPayment = getDisplayPayment(project)
                            const overAllocated = isTimeOverAllocated(project)
                            const totalTasks = project._count?.tasks ?? project.tasks?.length ?? 0
                            const progress = totalTasks > 0 ? (project.completedTasks / totalTasks) * 100 : 0

                            return (
                                <React.Fragment key={project.id}>
                                    <button
                                        type="button"
                                        onClick={() => openDetails(project)}
                                        className="w-full rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-3 text-left shadow-[var(--shadow-apple)] md:hidden"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 pr-2">
                                                <div className="flex items-center gap-2.5">
                                                    <DomainFaviconTile domain={project.site.domainName} faviconUrl={project.site.faviconUrl} />
                                                    <div className="min-w-0">
                                                        <p className={cn("break-words font-bold leading-tight tracking-tight", getProjectTitleClass(projectStatus))}>
                                                            <span>{project.site.domainName}</span>
                                                        </p>
                                                        <div className={cn("mt-1 flex flex-wrap items-center gap-1.5 text-sm", getProjectMetaClass(projectStatus))}>
                                                            <span className="break-words">{project.serviceLabel}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <StatusChip tone={projectPayment === "Paid" ? "paid" : "unpaid"} size="sm">
                                                {projectPayment}
                                            </StatusChip>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="font-mono text-base font-bold text-[var(--text-primary)]">
                                                {currencyFormatter.format(project.amount)} <span className="text-xs text-[var(--text-muted)]">RON</span>
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <StatusChip tone={statusToneFromLabel(projectStatus)} size="sm">
                                                    {projectStatus}
                                                </StatusChip>
                                                <StatusChip tone={project.isRecurring ? "recurring" : "oneTime"} size="sm">
                                                    {project.isRecurring ? "Recurring" : "One-Time"}
                                                </StatusChip>
                                            </div>
                                        </div>
                                    </button>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openDetails(project)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault()
                                                openDetails(project)
                                            }
                                        }}
                                        className={cn("hidden w-full items-center gap-x-4 rounded-[14px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-6 py-3 text-left shadow-[var(--shadow-apple)] md:grid md:min-w-[1240px] xl:min-w-[1320px]", LIST_GRID_COLUMNS)}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2.5">
                                                <DomainFaviconTile domain={project.site.domainName} faviconUrl={project.site.faviconUrl} />
                                                <div className="min-w-0">
                                                    <p className={cn("font-bold tracking-tight whitespace-nowrap overflow-x-auto hidescrollbar", getProjectTitleClass(projectStatus))}>
                                                        <span>{project.site.domainName}</span>
                                                    </p>
                                                    <div className={cn("flex items-center gap-2 text-sm min-w-0", getProjectMetaClass(projectStatus))}>
                                                        <span className="whitespace-nowrap overflow-x-auto hidescrollbar">{project.serviceLabel}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => event.stopPropagation()}
                                                        onPointerDown={(event) => event.stopPropagation()}
                                                        onKeyDown={(event) => event.stopPropagation()}
                                                        className="focus:outline-none"
                                                    >
                                                        <StatusChip tone={statusToneFromLabel(projectStatus)} size="xs" className={PROJECT_ROW_CHIP_CLASS}>
                                                            {projectStatus}
                                                        </StatusChip>
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center" className="w-36 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                                    {(["Active", "Paused", "Completed", "Closed"] as const).map((option) => (
                                                        <DropdownMenuItem
                                                            key={option}
                                                            onSelect={(event) => {
                                                                event.stopPropagation()
                                                                void setProjectStatus(project, option)
                                                            }}
                                                            className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                                                        >
                                                            <span className={cn(
                                                                "mr-2 h-2 w-2 rounded-full",
                                                                option === "Active" && "bg-[var(--brand-primary)]",
                                                                option === "Paused" && "bg-[var(--state-warning)]",
                                                                option === "Completed" && "bg-[var(--state-success)]",
                                                                option === "Closed" && "bg-[var(--text-muted)]"
                                                            )} />
                                                            {option}
                                                            {projectStatus === option && <Check className="ml-auto h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => event.stopPropagation()}
                                                        onPointerDown={(event) => event.stopPropagation()}
                                                        onKeyDown={(event) => event.stopPropagation()}
                                                        className="focus:outline-none"
                                                    >
                                                        <StatusChip tone={projectPayment === "Paid" ? "paid" : "unpaid"} size="xs" className={PROJECT_ROW_CHIP_CLASS}>
                                                            {projectPayment}
                                                        </StatusChip>
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center" className="w-36 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                                    {(["Paid", "Unpaid"] as const).map((option) => (
                                                        <DropdownMenuItem
                                                            key={option}
                                                            onSelect={(event) => {
                                                                event.stopPropagation()
                                                                void setProjectPayment(project, option)
                                                            }}
                                                            className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                                                        >
                                                            <span className={cn(
                                                                "mr-2 h-2 w-2 rounded-full",
                                                                option === "Paid" ? "bg-[var(--state-success)]" : "bg-[var(--state-urgent)]"
                                                            )} />
                                                            {option}
                                                            {projectPayment === option && <Check className="ml-auto h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex justify-center">
                                            <StatusChip tone={project.isRecurring ? "recurring" : "oneTime"} size="xs" className={PROJECT_ROW_CHIP_CLASS}>
                                                {project.isRecurring ? "Recurring" : "One-Time"}
                                            </StatusChip>
                                        </div>
                                        <div className="flex justify-end">
                                            <Popover
                                                open={amountEditorProjectId === project.id}
                                                onOpenChange={(open) => {
                                                    if (open) openAmountEditor(project)
                                                    else setAmountEditorProjectId(null)
                                                }}
                                            >
                                                <PopoverTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            openAmountEditor(project)
                                                        }}
                                                        className="font-bold text-[var(--text-primary)] text-right transition-colors hover:text-[var(--primary)]"
                                                        title="Edit amount"
                                                    >
                                                        {currencyFormatter.format(getDisplayAmount(project))} <span className="text-[var(--text-muted)] text-xs">RON</span>
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    align="end"
                                                    className={cn("rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-xl", project.isRecurring ? "w-64" : "w-44")}
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    {renderAmountEditor(project)}
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="flex items-center justify-center">
                                            <div className="relative h-8 w-8">
                                                <svg className="h-full w-full" viewBox="0 0 36 36">
                                                    <circle className="stroke-[var(--line-subtle)]" strokeWidth="3" fill="transparent" r="16" cx="18" cy="18" />
                                                    <circle
                                                        className="stroke-emerald-600 transition-all duration-500"
                                                        strokeWidth="3"
                                                        strokeDasharray={`${progress}, 100`}
                                                        strokeLinecap="round"
                                                        fill="transparent"
                                                        r="16"
                                                        cx="18"
                                                        cy="18"
                                                        transform="rotate(-90 18 18)"
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-xs font-bold text-[var(--text-secondary)]">{project.completedTasks}/{totalTasks}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <span
                                                className={cn(
                                                    "px-2 py-1 rounded-lg text-xs font-bold text-center uppercase tracking-tight min-w-[50px] border",
                                                    overAllocated
                                                        ? "text-[var(--state-urgent)] bg-[var(--state-danger-surface)] border-[color:color-mix(in_srgb,var(--state-urgent)_28%,var(--line-subtle))] ring-1 ring-[color:color-mix(in_srgb,var(--state-urgent)_28%,transparent)] shadow-sm font-black"
                                                        : "text-[var(--text-secondary)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] border-[var(--line-subtle)]"
                                                )}
                                            >
                                                {formatDuration(project.secondsLogged)}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium text-[var(--text-secondary)] truncate block">{project.site.partner.name}</span>
                                        <div className="flex w-full justify-end justify-self-end">
                                            <DateTimeCell value={project.createdAt} />
                                        </div>
                                    </div>
                                </React.Fragment>
                            )
                        })}


                    </div>
                </section>

                <section className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-[var(--shadow-apple)] sm:p-4">
                    <div className="mb-3 flex items-center gap-3">
                        <span className="h-5 w-1 rounded-full bg-[var(--state-review)]" />
                        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Monthly Projects</h2>
                    </div>

                    <ProjectBoardHeaderRow
                        gridColumnsClassName={LIST_GRID_COLUMNS}
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSort={setSort}
                    />

                    <div className="space-y-2">
                        {monthlyProjects.length === 0 && (
                            <EmptyProjectsState
                                title={normalizedSearch ? "No monthly projects found" : "No monthly projects in this view"}
                                description={
                                    normalizedSearch
                                        ? "Try a broader search or remove some filters to surface recurring work again."
                                        : "Adjust your filters or add a recurring project to keep this section populated."
                                }
                            />
                        )}
                        {monthlyProjects.map((project) => {
                            const projectStatus = getDisplayStatus(project)
                            const projectPayment = getDisplayPayment(project)
                            const overAllocated = isTimeOverAllocated(project)
                            const totalTasks = project._count?.tasks ?? project.tasks?.length ?? 0
                            const progress = totalTasks > 0 ? (project.completedTasks / totalTasks) * 100 : 0

                            return (
                                <React.Fragment key={project.id}>
                                    <button
                                        type="button"
                                        onClick={() => openDetails(project)}
                                        className="w-full rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-3 text-left shadow-[var(--shadow-apple)] md:hidden"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 pr-2">
                                                <div className="flex items-center gap-2.5">
                                                    <DomainFaviconTile domain={project.site.domainName} faviconUrl={project.site.faviconUrl} />
                                                    <div className="min-w-0">
                                                        <p className={cn("break-words font-bold leading-tight tracking-tight", getProjectTitleClass(projectStatus))}>
                                                            <span>{project.site.domainName}</span>
                                                        </p>
                                                        <div className={cn("mt-1 flex flex-wrap items-center gap-1.5 text-sm", getProjectMetaClass(projectStatus))}>
                                                            <span className="break-words">{project.serviceLabel}</span>
                                                            <span className="inline-flex items-center rounded-md border border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] bg-[var(--sidebar-accent)] px-2 py-0.5 text-xs font-bold uppercase tracking-tight text-[var(--primary)]">
                                                                {format(new Date(project.createdAt), "MMMM yyyy")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <StatusChip tone={projectPayment === "Paid" ? "paid" : "unpaid"} size="sm">
                                                {projectPayment}
                                            </StatusChip>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="font-mono text-base font-bold text-[var(--text-primary)]">
                                                {currencyFormatter.format(project.amount)} <span className="text-xs text-[var(--text-muted)]">RON</span>
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <StatusChip tone={statusToneFromLabel(projectStatus)} size="sm">
                                                    {projectStatus}
                                                </StatusChip>
                                                <StatusChip tone={project.isRecurring ? "recurring" : "oneTime"} size="sm">
                                                    {project.isRecurring ? "Recurring" : "One-Time"}
                                                </StatusChip>
                                            </div>
                                        </div>
                                    </button>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openDetails(project)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault()
                                                openDetails(project)
                                            }
                                        }}
                                        className={cn("hidden w-full items-center gap-x-4 rounded-[14px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-6 py-3 text-left shadow-[var(--shadow-apple)] md:grid md:min-w-[1240px] xl:min-w-[1320px]", LIST_GRID_COLUMNS)}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2.5">
                                                <DomainFaviconTile domain={project.site.domainName} faviconUrl={project.site.faviconUrl} />
                                                <div className="min-w-0">
                                                    <p className={cn("font-bold tracking-tight whitespace-nowrap overflow-x-auto hidescrollbar", getProjectTitleClass(projectStatus))}>
                                                        <span>{project.site.domainName}</span>
                                                    </p>
                                                    <div className={cn("flex items-center gap-2 text-sm min-w-0", getProjectMetaClass(projectStatus))}>
                                                        <span className="whitespace-nowrap overflow-x-auto hidescrollbar">{project.serviceLabel}</span>
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--sidebar-accent)] text-[var(--primary)] border border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] shrink-0 uppercase tracking-tighter">
                                                            {format(new Date(project.createdAt), "MMMM yyyy")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => event.stopPropagation()}
                                                        onPointerDown={(event) => event.stopPropagation()}
                                                        onKeyDown={(event) => event.stopPropagation()}
                                                        className="focus:outline-none"
                                                    >
                                                        <StatusChip tone={statusToneFromLabel(projectStatus)} size="xs" className={PROJECT_ROW_CHIP_CLASS}>
                                                            {projectStatus}
                                                        </StatusChip>
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center" className="w-36 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                                    {(["Active", "Paused", "Completed", "Closed"] as const).map((option) => (
                                                        <DropdownMenuItem
                                                            key={option}
                                                            onSelect={(event) => {
                                                                event.stopPropagation()
                                                                void setProjectStatus(project, option)
                                                            }}
                                                            className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                                                        >
                                                            <span className={cn(
                                                                "mr-2 h-2 w-2 rounded-full",
                                                                option === "Active" && "bg-[var(--brand-primary)]",
                                                                option === "Paused" && "bg-[var(--state-warning)]",
                                                                option === "Completed" && "bg-[var(--state-success)]",
                                                                option === "Closed" && "bg-[var(--text-muted)]"
                                                            )} />
                                                            {option}
                                                            {projectStatus === option && <Check className="ml-auto h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex justify-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => event.stopPropagation()}
                                                        onPointerDown={(event) => event.stopPropagation()}
                                                        onKeyDown={(event) => event.stopPropagation()}
                                                        className="focus:outline-none"
                                                    >
                                                        <StatusChip tone={projectPayment === "Paid" ? "paid" : "unpaid"} size="xs" className={PROJECT_ROW_CHIP_CLASS}>
                                                            {projectPayment}
                                                        </StatusChip>
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center" className="w-36 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
                                                    {(["Paid", "Unpaid"] as const).map((option) => (
                                                        <DropdownMenuItem
                                                            key={option}
                                                            onSelect={(event) => {
                                                                event.stopPropagation()
                                                                void setProjectPayment(project, option)
                                                            }}
                                                            className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                                                        >
                                                            <span className={cn(
                                                                "mr-2 h-2 w-2 rounded-full",
                                                                option === "Paid" ? "bg-[var(--state-success)]" : "bg-[var(--state-urgent)]"
                                                            )} />
                                                            {option}
                                                            {projectPayment === option && <Check className="ml-auto h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex justify-center">
                                            <StatusChip tone={project.isRecurring ? "recurring" : "oneTime"} size="xs" className={PROJECT_ROW_CHIP_CLASS}>
                                                {project.isRecurring ? "Recurring" : "One-Time"}
                                            </StatusChip>
                                        </div>
                                        <div className="flex justify-end">
                                            <Popover
                                                open={amountEditorProjectId === project.id}
                                                onOpenChange={(open) => {
                                                    if (open) openAmountEditor(project)
                                                    else setAmountEditorProjectId(null)
                                                }}
                                            >
                                                <PopoverTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            openAmountEditor(project)
                                                        }}
                                                        className="font-bold text-[var(--text-primary)] text-right transition-colors hover:text-[var(--primary)]"
                                                        title="Edit amount"
                                                    >
                                                        {currencyFormatter.format(getDisplayAmount(project))} <span className="text-[var(--text-muted)] text-xs">RON</span>
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    align="end"
                                                    className={cn("rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 shadow-xl", project.isRecurring ? "w-64" : "w-44")}
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    {renderAmountEditor(project)}
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="flex items-center justify-center">
                                            <div className="relative h-8 w-8">
                                                <svg className="h-full w-full" viewBox="0 0 36 36">
                                                    <circle className="stroke-[var(--line-subtle)]" strokeWidth="3" fill="transparent" r="16" cx="18" cy="18" />
                                                    <circle
                                                        className="stroke-blue-600 transition-all duration-500"
                                                        strokeWidth="3"
                                                        strokeDasharray={`${progress}, 100`}
                                                        strokeLinecap="round"
                                                        fill="transparent"
                                                        r="16"
                                                        cx="18"
                                                        cy="18"
                                                        transform="rotate(-90 18 18)"
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-xs font-bold text-[var(--text-secondary)]">{project.completedTasks}/{totalTasks}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-center">
                                            <span
                                                className={cn(
                                                    "px-2 py-1 rounded-lg text-xs font-bold text-center uppercase tracking-tight min-w-[50px] border",
                                                    overAllocated
                                                        ? "text-[var(--state-urgent)] bg-[var(--state-danger-surface)] border-[color:color-mix(in_srgb,var(--state-urgent)_28%,var(--line-subtle))] ring-1 ring-[color:color-mix(in_srgb,var(--state-urgent)_28%,transparent)] shadow-sm font-black"
                                                        : "text-[var(--text-secondary)] bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] border-[var(--line-subtle)]"
                                                )}
                                            >
                                                {formatDuration(project.secondsLogged)}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium text-[var(--text-secondary)] truncate block">{project.site.partner.name}</span>
                                        <div className="flex w-full justify-end justify-self-end">
                                            <DateTimeCell value={project.createdAt} />
                                        </div>
                                    </div>
                                </React.Fragment>
                            )
                        })}


                    </div>
                </section>

                {/* Global Shadow Row - Before Overview */}
                {layout === "list" && (
                    <div className="overflow-x-auto pt-1 text-[var(--text-primary)] hidescrollbar">
                        <div className="md:min-w-[1240px] xl:min-w-[1320px]">
                            <button
                                type="button"
                                onClick={() => setCreateProjectOpen(true)}
                                className={cn(
                                    "grid w-full items-center gap-x-2 rounded-[14px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-low)_72%,transparent)] px-5 py-3.5 text-left transition-all hover:border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] hover:bg-[var(--sidebar-accent)] group/shadow",
                                    LIST_GRID_COLUMNS
                                )}
                            >
                                <div className="min-w-0 flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-lowest)] border border-[var(--line-subtle)] shadow-sm group-hover/shadow:border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] transition-all">
                                        <Plus className="h-4 w-4 text-[var(--text-muted)] group-hover/shadow:text-[var(--primary)] group-hover/shadow:scale-110 transition-all" />
                                    </div>
                                    <span className="text-sm font-semibold text-[var(--text-secondary)] group-hover/shadow:text-[var(--primary)] transition-colors">
                                        Add new project...
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                <ProjectBoardSummaryCards
                    totalCount={totals.count}
                    oneTimeCount={oneTimeCount}
                    monthlyCount={monthlyCount}
                    totalAmountLabel={currencyFormatter.format(totals.totalAmount)}
                    totalDurationLabel={formatDuration(totals.totalSeconds)}
                />

                    <GlobalCreateProjectDialog
                        open={createProjectOpen}
                        onOpenChange={setCreateProjectOpen}
                        partners={partners}
                        services={services}
                    />
                </div>
            </div>
            {closeProjectDialog}
        </>
    )
}
