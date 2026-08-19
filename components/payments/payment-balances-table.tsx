"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDownUp, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Pencil, RotateCcw, SlidersHorizontal, Trash2, X } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ListEmptyState } from "@/components/ui/list-state"
import { setProjectPaymentMethod, setProjectPaymentState, updateProject } from "@/lib/actions/projects"
import { mergePaymentMethods, normalizePaymentMethod } from "@/lib/payments/methods"
import { cn, formatCurrency } from "@/lib/utils"

export type PaymentBalanceRow = {
    id: string
    label: string
    domainName: string
    partnerId: string
    partnerName: string
    serviceLabel: string
    isRecurring: boolean
    currentFee: number
    paidAt: string | null
    paymentMethod: string | null
}

type PaymentLogFilters = {
    projectId: string
    partnerId: string
    type: string
    method?: string
    sort: string
    paidFrom: string
    paidTo: string
}

type PaymentBalancesTableProps = {
    rows: PaymentBalanceRow[]
    projects: { id: string; name: string }[]
    partners: { id: string; name: string }[]
    paymentMethods: string[]
    filters: PaymentLogFilters
    pagination: { page: number; totalPages: number; total: number; prevPage: number | null; nextPage: number | null }
}

export function PaymentBalancesTable({ rows, projects, partners, paymentMethods, filters, pagination }: PaymentBalancesTableProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false)
    const [pendingId, setPendingId] = React.useState<string | null>(null)
    const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(new Set())
    const [methodOverrides, setMethodOverrides] = React.useState<Record<string, string>>({})
    const [editAmountRow, setEditAmountRow] = React.useState<PaymentBalanceRow | null>(null)
    const [editAmountValue, setEditAmountValue] = React.useState("")
    const [savingAmount, setSavingAmount] = React.useState(false)
    const [deletePaymentRow, setDeletePaymentRow] = React.useState<PaymentBalanceRow | null>(null)

    React.useEffect(() => {
        setHiddenIds(new Set())
        setMethodOverrides({})
    }, [rows])

    const buildHref = React.useCallback((overrides: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("payment")
        for (const [key, value] of Object.entries(overrides)) {
            const isDefault =
                (key === "projectId" && value === "all") ||
                (key === "partnerId" && value === "all") ||
                (key === "type" && value === "All") ||
                (key === "method" && (value === "all" || value === "All")) ||
                (key === "balanceSort" && value === "paid_recent") ||
                ((key === "paidFrom" || key === "paidTo") && !value)
            if (value === null || isDefault) params.delete(key)
            else params.set(key, value)
        }
        params.delete("page")
        const query = params.toString()
        return query ? `${pathname}?${query}` : pathname
    }, [pathname, searchParams])

    const selectedProject = projects.find((project) => project.id === filters.projectId)
    const selectedPartner = partners.find((partner) => partner.id === filters.partnerId)
    const chips: Array<{ key: string; label: string; href: string }> = []
    if (selectedProject) chips.push({ key: "project", label: selectedProject.name, href: buildHref({ projectId: "all" }) })
    if (selectedPartner) chips.push({ key: "partner", label: selectedPartner.name, href: buildHref({ partnerId: "all" }) })
    if (filters.type !== "All") chips.push({ key: "type", label: filters.type === "Recurring" ? "Recurring" : "One-time", href: buildHref({ type: "All" }) })
    if (filters.method && filters.method !== "all" && filters.method !== "All") chips.push({ key: "method", label: filters.method, href: buildHref({ method: "all" }) })
    if (filters.paidFrom || filters.paidTo) chips.push({ key: "paid", label: "Paid date", href: buildHref({ paidFrom: null, paidTo: null }) })

    const togglePaidState = async (row: PaymentBalanceRow, restore = false) => {
        setPendingId(row.id)
        const result = await setProjectPaymentState({
            projectId: row.id,
            expectedStatus: restore ? "Unpaid" : "Paid",
            nextStatus: restore ? "Paid" : "Unpaid",
            ...(restore && row.paymentMethod ? { paymentMethod: row.paymentMethod } : {}),
        })
        setPendingId(null)
        if (!result.success) {
            toast.error(result.error || "Failed to update payment")
            return
        }
        setHiddenIds((current) => {
            const next = new Set(current)
            if (restore) next.delete(row.id)
            else next.add(row.id)
            return next
        })
        if (restore) toast.success("Payment restored")
        else toast.success("Payment removed / reverted to unpaid", { duration: 8000, action: { label: "Undo", onClick: () => void togglePaidState(row, true) } })
        router.refresh()
    }

    const updateMethod = async (row: PaymentBalanceRow, method: string) => {
        const normalized = normalizePaymentMethod(method)
        if (!normalized) return false
        const previous = methodOverrides[row.id] || row.paymentMethod || ""
        setPendingId(row.id)
        setMethodOverrides((current) => ({ ...current, [row.id]: normalized }))
        const result = await setProjectPaymentMethod({ projectId: row.id, paymentMethod: normalized })
        setPendingId(null)
        if (!result.success) {
            setMethodOverrides((current) => ({ ...current, [row.id]: previous }))
            toast.error(result.error || "Failed to update payment method")
            return false
        }
        toast.success("Payment method updated")
        router.refresh()
        return true
    }

    const saveEditedAmount = async () => {
        if (!editAmountRow) return
        const parsed = Number(editAmountValue)
        if (Number.isNaN(parsed) || parsed < 0) {
            toast.error("Enter a valid non-negative amount")
            return
        }
        setSavingAmount(true)
        const result = await updateProject(editAmountRow.id, { currentFee: parsed })
        setSavingAmount(false)
        if (!result.success) {
            toast.error(result.error || "Failed to update amount")
            return
        }
        toast.success("Payment amount updated")
        setEditAmountRow(null)
        router.refresh()
    }

    const controls = <PaymentLogFilterFields filters={filters} projects={projects} partners={partners} paymentMethods={paymentMethods} buildHref={buildHref} onNavigate={(href) => { router.push(href); setMobileFiltersOpen(false) }} />
    const clearHref = buildHref({ projectId: "all", partnerId: "all", type: "All", method: "all", paidFrom: null, paidTo: null, balanceSort: "paid_recent" })
    const visibleRows = rows.filter((row) => !hiddenIds.has(row.id))
    const availableMethods = mergePaymentMethods([...paymentMethods, ...rows.map((row) => row.paymentMethod)])

    return (
        <section className="space-y-3" aria-labelledby="payment-log-title">
            <div className="flex items-center justify-between gap-3 px-1">
                <div><h2 id="payment-log-title" className="ui-text-title-sm text-[var(--text-primary)]">Payments received</h2><p className="ui-text-caption mt-1">One record per paid project, newest payment first.</p></div>
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                    <SheetTrigger asChild><Button type="button" variant="outline" size="sm" className="md:hidden"><SlidersHorizontal className="h-4 w-4" />Filters{chips.length ? <span className="rounded-full bg-[var(--brand-primary)] px-1.5 text-xs text-white">{chips.length}</span> : null}</Button></SheetTrigger>
                    <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[24px] p-0"><SheetHeader className="p-5 pb-2"><SheetTitle>Payment filters</SheetTitle><SheetDescription>Filter paid projects.</SheetDescription></SheetHeader><div className="p-5 pt-3">{controls}</div></SheetContent>
                </Sheet>
            </div>

            {chips.length ? <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 hidescrollbar">{chips.map((chip) => <Link key={chip.key} href={chip.href} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]">{chip.label}<X className="h-3 w-3" /></Link>)}<Link href={clearHref} className="shrink-0 px-2 text-xs font-semibold text-[var(--text-secondary)]">Clear all</Link></div> : null}

            <div className="hidden overflow-x-auto rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)] md:block">
                <table className="w-full min-w-[1020px] table-fixed">
                    <thead className="border-b border-[var(--line-subtle)] bg-[var(--surface-low)]/70 text-left"><tr>
                        <HeaderFilter label="Project / Partner"><ProjectPartnerFilters filters={filters} projects={projects} partners={partners} buildHref={buildHref} /></HeaderFilter>
                        <HeaderFilter label="Type / Service"><SingleFilter value={filters.type} param="type" options={[{ label: "All types", value: "All" }, { label: "Recurring", value: "Recurring" }, { label: "One-time", value: "OneTime" }]} buildHref={buildHref} /></HeaderFilter>
                        <th className="w-[150px] px-4 py-3 text-right"><Link href={buildHref({ balanceSort: filters.sort === "amount_desc" ? "amount_asc" : "amount_desc" })} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)]">Amount<ArrowDownUp className="h-3.5 w-3.5" /></Link></th>
                        <HeaderFilter label="Method" className="w-[160px]"><SingleFilter value={filters.method || "all"} param="method" options={[{ label: "All methods", value: "all" }, ...availableMethods.map((m) => ({ label: m, value: m }))]} buildHref={buildHref} /></HeaderFilter>
                        <HeaderFilter label="Paid on" className="w-[160px]"><PaidDateFilter filters={filters} buildHref={buildHref} /></HeaderFilter>
                        <th className="w-[76px] px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)]">Actions</th>
                    </tr></thead>
                    <tbody>{visibleRows.map((row) => {
                        const loading = pendingId === row.id
                        const method = methodOverrides[row.id] || row.paymentMethod
                        return (
                            <tr key={row.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--surface-low)]/50">
                                <td className="px-4 py-3">
                                    <Link href={`/projects?status=All&projectId=${row.id}`} className="block min-w-0">
                                        <p className="truncate text-sm font-bold text-[var(--text-primary)]">{row.label}</p>
                                        <p className="mt-0.5 truncate text-xs font-medium text-[var(--text-muted)]">{row.partnerName}</p>
                                    </Link>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-xs font-semibold text-[var(--text-secondary)]">{row.isRecurring ? "Recurring" : "One-time"}</p>
                                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{row.serviceLabel}</p>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditAmountRow(row)
                                            setEditAmountValue(String(row.currentFee))
                                        }}
                                        className="group inline-flex items-center gap-1.5 font-mono text-sm font-bold text-[var(--text-primary)] hover:text-[var(--brand-primary)]"
                                        title="Click to edit amount"
                                    >
                                        <span>{formatCurrency(row.currentFee)}</span>
                                        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 text-[var(--text-muted)]" />
                                    </button>
                                </td>
                                <td className="px-4 py-3">
                                    <PaymentMethodMenu row={row} value={method} methods={availableMethods} disabled={loading} onChange={(value) => updateMethod(row, value)} />
                                </td>
                                <td className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)]">
                                    {row.paidAt ? format(new Date(row.paidAt), "dd MMM yyyy") : "Date unavailable"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <PaymentActionsMenu row={row} loading={loading} onRevert={() => void togglePaidState(row)} onDelete={() => setDeletePaymentRow(row)} />
                                </td>
                            </tr>
                        )
                    })}</tbody>
                </table>
            </div>

            <div className="grid gap-3 md:hidden">{visibleRows.map((row) => {
                const loading = pendingId === row.id
                const method = methodOverrides[row.id] || row.paymentMethod
                return (
                    <article key={row.id} className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)]">
                        <div className="flex items-start justify-between gap-3">
                            <Link href={`/projects?status=All&projectId=${row.id}`} className="min-w-0">
                                <h3 className="line-clamp-2 text-[15px] font-bold text-[var(--text-primary)]">{row.label}</h3>
                                <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{row.partnerName} · {row.isRecurring ? "Recurring" : "One-time"}</p>
                            </Link>
                            <PaymentActionsMenu row={row} loading={loading} onRevert={() => void togglePaidState(row)} onDelete={() => setDeletePaymentRow(row)} />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line-subtle)] pt-3">
                            <div>
                                <p className="text-xs text-[var(--text-muted)]">Amount</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditAmountRow(row)
                                        setEditAmountValue(String(row.currentFee))
                                    }}
                                    className="group mt-1 inline-flex items-center gap-1.5 font-mono text-sm font-bold text-[var(--text-primary)] hover:text-[var(--brand-primary)]"
                                >
                                    <span>{formatCurrency(row.currentFee)}</span>
                                    <Pencil className="h-3 w-3 text-[var(--text-muted)]" />
                                </button>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-[var(--text-muted)]">Paid on</p>
                                <p className="mt-1 text-xs font-semibold">{row.paidAt ? format(new Date(row.paidAt), "dd MMM yyyy") : "Date unavailable"}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="mb-1 text-xs text-[var(--text-muted)]">Method</p>
                                <PaymentMethodMenu row={row} value={method} methods={availableMethods} disabled={loading} onChange={(value) => updateMethod(row, value)} />
                            </div>
                        </div>
                    </article>
                )
            })}</div>

            {!visibleRows.length ? <ListEmptyState title="No paid projects found" description="Recorded payments will appear here." /> : null}
            {pagination.totalPages > 1 ? <div className="flex items-center justify-between rounded-[14px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 py-2 shadow-[var(--shadow-apple)]"><span className="text-xs font-semibold text-[var(--text-secondary)]">{pagination.page}/{pagination.totalPages} · {pagination.total} payments</span><div className="flex gap-1.5">{pagination.prevPage ? <Link href={pageHref(searchParams, pagination.prevPage)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-subtle)]"><ChevronLeft className="h-4 w-4" /></Link> : null}{pagination.nextPage ? <Link href={pageHref(searchParams, pagination.nextPage)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-subtle)]"><ChevronRight className="h-4 w-4" /></Link> : null}</div></div> : null}

            {/* Edit Amount Dialog */}
            <Dialog open={Boolean(editAmountRow)} onOpenChange={(open) => { if (!open) setEditAmountRow(null) }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Edit Payment Amount</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-xs text-[var(--text-secondary)]">{editAmountRow?.label}</p>
                        <label className="block text-xs font-semibold text-[var(--text-muted)]">
                            Amount (RON)
                            <Input
                                type="number"
                                step="1"
                                min="0"
                                value={editAmountValue}
                                onChange={(e) => setEditAmountValue(e.target.value)}
                                className="mt-1 font-mono"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        void saveEditedAmount()
                                    }
                                }}
                            />
                        </label>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditAmountRow(null)}>Cancel</Button>
                        <Button type="button" onClick={() => void saveEditedAmount()} disabled={savingAmount}>
                            {savingAmount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Payment Confirmation */}
            <AlertDialog open={Boolean(deletePaymentRow)} onOpenChange={(open) => { if (!open) setDeletePaymentRow(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete payment?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will revert the payment record for &ldquo;{deletePaymentRow?.label}&rdquo; back to unpaid.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                if (deletePaymentRow) {
                                    const row = deletePaymentRow
                                    setDeletePaymentRow(null)
                                    void togglePaidState(row)
                                }
                            }}
                        >
                            Delete payment
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}

function PaymentActionsMenu({ row, loading, onRevert, onDelete }: { row: PaymentBalanceRow; loading: boolean; onRevert: () => void; onDelete: () => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    disabled={loading}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                    aria-label={`Payment actions for ${row.label}`}
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                <DropdownMenuItem onSelect={onRevert} className="min-h-10 cursor-pointer rounded-lg px-3 font-semibold text-[var(--text-secondary)]">
                    <RotateCcw className="mr-2 h-4 w-4" />Revert to unpaid
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onDelete} className="min-h-10 cursor-pointer rounded-lg px-3 font-semibold text-[var(--state-urgent)] focus:text-[var(--state-urgent)]">
                    <Trash2 className="mr-2 h-4 w-4" />Delete payment
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function PaymentMethodMenu({ row, value, methods, disabled, onChange }: { row: PaymentBalanceRow; value: string | null; methods: string[]; disabled: boolean; onChange: (value: string) => Promise<boolean> }) {
    const [customOpen, setCustomOpen] = React.useState(false)
    const [customValue, setCustomValue] = React.useState("")
    const [savingCustom, setSavingCustom] = React.useState(false)
    const saveCustom = async () => {
        const normalized = normalizePaymentMethod(customValue)
        if (!normalized) return
        setSavingCustom(true)
        const saved = await onChange(normalized)
        setSavingCustom(false)
        if (saved) { setCustomOpen(false); setCustomValue("") }
    }
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                        aria-label={`Payment method for ${row.label}`}
                    >
                        <span className="truncate">{value || "Add method"}</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 rounded-xl p-1.5">
                    {methods.map((method) => (
                        <DropdownMenuItem key={method} onSelect={() => void onChange(method)} className="cursor-pointer rounded-lg">
                            <Check className={cn("mr-2 h-4 w-4", value === method ? "opacity-100" : "opacity-0")} />
                            {method}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setCustomOpen(true)} className="cursor-pointer rounded-lg">
                        <Pencil className="mr-2 h-4 w-4" />Add another…
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={customOpen} onOpenChange={setCustomOpen}>
                <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Add payment method</DialogTitle></DialogHeader><Input value={customValue} onChange={(event) => setCustomValue(event.target.value)} maxLength={64} placeholder="Method name" autoFocus onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveCustom() } }} /><DialogFooter><Button type="button" variant="outline" onClick={() => setCustomOpen(false)}>Cancel</Button><Button type="button" onClick={() => void saveCustom()} disabled={!normalizePaymentMethod(customValue) || savingCustom}>{savingCustom ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save</Button></DialogFooter></DialogContent>
            </Dialog>
        </>
    )
}

function pageHref(params: URLSearchParams, page: number) { const next = new URLSearchParams(params.toString()); next.set("page", String(page)); next.delete("payment"); return `/payments?${next.toString()}` }
function HeaderFilter({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) { return <th className={cn("px-4 py-3", className)}><Popover><PopoverTrigger asChild><button type="button" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.06em] text-[var(--text-secondary)]">{label}<ChevronDown className="h-3.5 w-3.5" /></button></PopoverTrigger><PopoverContent align="start" className="w-72 rounded-[16px] p-4">{children}</PopoverContent></Popover></th> }
function SingleFilter({ value, param, options, buildHref }: { value: string; param: string; options: { label: string; value: string }[]; buildHref: (overrides: Record<string, string | null>) => string }) { return <div className="grid gap-1">{options.map((option) => <Link key={option.value} href={buildHref({ [param]: option.value })} className={cn("flex h-9 items-center rounded-lg px-3 text-sm font-medium", value === option.value ? "bg-[var(--surface-low)] text-[var(--brand-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-low)]")}>{option.label}{value === option.value ? <Check className="ml-auto h-4 w-4" /> : null}</Link>)}</div> }
function ProjectPartnerFilters({ filters, projects, partners, buildHref }: { filters: PaymentLogFilters; projects: { id: string; name: string }[]; partners: { id: string; name: string }[]; buildHref: (overrides: Record<string, string | null>) => string }) { const router = useRouter(); return <div className="space-y-3"><FilterSelect value={filters.projectId} onValueChange={(value) => router.push(buildHref({ projectId: value }))} options={[{ label: "All projects", value: "all" }, ...projects.map((project) => ({ label: project.name, value: project.id }))]} /><FilterSelect value={filters.partnerId} onValueChange={(value) => router.push(buildHref({ partnerId: value }))} options={[{ label: "All partners", value: "all" }, ...partners.map((partner) => ({ label: partner.name, value: partner.id }))]} /></div> }
function PaidDateFilter({ filters, buildHref }: { filters: PaymentLogFilters; buildHref: (overrides: Record<string, string | null>) => string }) { const router = useRouter(); const [from, setFrom] = React.useState(filters.paidFrom); const [to, setTo] = React.useState(filters.paidTo); return <div className="space-y-3"><label className="text-xs font-semibold text-[var(--text-secondary)]">From<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1.5" /></label><label className="text-xs font-semibold text-[var(--text-secondary)]">To<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1.5" /></label><div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); router.push(buildHref({ paidFrom: null, paidTo: null })) }}>Reset</Button><Button type="button" size="sm" onClick={() => router.push(buildHref({ paidFrom: from, paidTo: to }))}>Apply</Button></div></div> }
function FilterSelect({ value, onValueChange, options }: { value: string; onValueChange: (value: string) => void; options: { label: string; value: string }[] }) { return <Select value={value} onValueChange={onValueChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select> }
function PaymentLogFilterFields({ filters, projects, partners, paymentMethods, buildHref, onNavigate }: { filters: PaymentLogFilters; projects: { id: string; name: string }[]; partners: { id: string; name: string }[]; paymentMethods: string[]; buildHref: (overrides: Record<string, string | null>) => string; onNavigate: (href: string) => void }) {
    const [draft, setDraft] = React.useState(filters)
    const set = (key: keyof PaymentLogFilters, value: string) => setDraft((current) => ({ ...current, [key]: value }))
    return (
        <div className="space-y-4">
            <FilterSelect value={draft.projectId} onValueChange={(value) => set("projectId", value)} options={[{ label: "All projects", value: "all" }, ...projects.map((project) => ({ label: project.name, value: project.id }))]} />
            <FilterSelect value={draft.partnerId} onValueChange={(value) => set("partnerId", value)} options={[{ label: "All partners", value: "all" }, ...partners.map((partner) => ({ label: partner.name, value: partner.id }))]} />
            <FilterSelect value={draft.type} onValueChange={(value) => set("type", value)} options={[{ label: "All types", value: "All" }, { label: "Recurring", value: "Recurring" }, { label: "One-time", value: "OneTime" }]} />
            <FilterSelect value={draft.method || "all"} onValueChange={(value) => set("method", value)} options={[{ label: "All methods", value: "all" }, ...paymentMethods.map((m) => ({ label: m, value: m }))]} />
            <FilterSelect value={draft.sort} onValueChange={(value) => set("sort", value)} options={[{ label: "Recently paid", value: "paid_recent" }, { label: "Amount high to low", value: "amount_desc" }, { label: "Amount low to high", value: "amount_asc" }]} />
            <div className="grid grid-cols-2 gap-3"><Input type="date" value={draft.paidFrom} onChange={(event) => set("paidFrom", event.target.value)} aria-label="Paid from" /><Input type="date" value={draft.paidTo} onChange={(event) => set("paidTo", event.target.value)} aria-label="Paid to" /></div>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setDraft({ projectId: "all", partnerId: "all", type: "All", method: "all", sort: "paid_recent", paidFrom: "", paidTo: "" })}>Reset</Button><Button type="button" onClick={() => onNavigate(buildHref({ projectId: draft.projectId, partnerId: draft.partnerId, type: draft.type, method: draft.method ?? null, balanceSort: draft.sort, paidFrom: draft.paidFrom, paidTo: draft.paidTo }))}>Apply</Button></div>
        </div>
    )
}
