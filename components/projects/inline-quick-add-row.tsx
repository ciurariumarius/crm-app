"use client"

import * as React from "react"
import { Check, ChevronDown, Loader2, Play, Plus, Square, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createProject, deleteProject } from "@/lib/actions/projects"
import { createSite } from "@/lib/actions/sites"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ProjectStatus = "Active" | "Completed" | "Closed"
type PaymentStatus = "Paid" | "Unpaid"

type PartnerSite = {
    id: string
    domainName: string
}

type Partner = {
    id: string
    name: string
    sites?: PartnerSite[]
}

type Service = {
    id: string
    serviceName: string
    isRecurring: boolean
    baseFee?: number | string | null
}

type SiteOption = {
    id: string
    domainName: string
    partnerId: string
}

type QuickAddDefaults = {
    status?: ProjectStatus
    paymentStatus?: PaymentStatus
}

const QUICK_ADD_DEFAULTS_KEY = "pixelist.quick-add.defaults.v3"

function normalizeDomain(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
}

function parseNumberish(value: string): number | undefined {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed.replace(",", "."))
    if (Number.isNaN(parsed)) return undefined
    return parsed
}

function isValidDomain(value: string) {
    return /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(value)
}

interface InlineQuickAddRowProps {
    partners: Partner[]
    services: Service[]
    onCancel: () => void
    gridColumns: string
    autoFocus?: boolean
}

export function InlineQuickAddRow({
    partners,
    services,
    onCancel,
    gridColumns,
    autoFocus = false,
}: InlineQuickAddRowProps) {
    const router = useRouter()
    const domainInputRef = React.useRef<HTMLInputElement | null>(null)
    const amountInputRef = React.useRef<HTMLInputElement | null>(null)
    const [domainValue, setDomainValue] = React.useState("")
    const [saving, setSaving] = React.useState(false)

    const [selectedPartnerId, setSelectedPartnerId] = React.useState("")
    const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>([])
    const [status, setStatus] = React.useState<ProjectStatus>("Active")
    const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus>("Unpaid")
    const [amount, setAmount] = React.useState("0")
    const [servicePickerValue, setServicePickerValue] = React.useState("")

    const siteOptions = React.useMemo<SiteOption[]>(() => {
        return partners.flatMap((partner) =>
            (partner.sites ?? []).map((site) => ({
                id: site.id,
                domainName: site.domainName,
                partnerId: partner.id,
            }))
        )
    }, [partners])

    const selectedServices = React.useMemo(
        () => services.filter((service) => selectedServiceIds.includes(service.id)),
        [services, selectedServiceIds]
    )

    const selectedKind = selectedServices.length > 0 ? selectedServices[0]?.isRecurring : null

    const availableServices = React.useMemo(() => {
        if (selectedKind === null) return services
        return services.filter((service) => service.isRecurring === selectedKind)
    }, [services, selectedKind])

    const remainingServices = React.useMemo(
        () => availableServices.filter((service) => !selectedServiceIds.includes(service.id)),
        [availableServices, selectedServiceIds]
    )

    const sitesForPartner = React.useMemo(() => {
        if (!selectedPartnerId) return []
        return siteOptions.filter((site) => site.partnerId === selectedPartnerId)
    }, [selectedPartnerId, siteOptions])
    const selectedPartnerName = React.useMemo(
        () => partners.find((partner) => partner.id === selectedPartnerId)?.name || "",
        [partners, selectedPartnerId]
    )

    const rowMinWidthClass = React.useMemo(() => {
        if (!gridColumns) return ""
        return gridColumns.includes("150px") ? "md:min-w-[1280px]" : ""
    }, [gridColumns])

    const domainListId = React.useId()

    const normalizedDomain = React.useMemo(() => normalizeDomain(domainValue), [domainValue])
    const domainLooksValid = normalizedDomain.length > 0 && isValidDomain(normalizedDomain)

    const matchedSite = React.useMemo(() => {
        if (!domainLooksValid) return null
        return sitesForPartner.find((site) => normalizeDomain(site.domainName) === normalizedDomain) ?? null
    }, [domainLooksValid, normalizedDomain, sitesForPartner])
    const matchedSiteOtherPartner = React.useMemo(() => {
        if (!domainLooksValid || !selectedPartnerId) return null
        return siteOptions.find(
            (site) =>
                normalizeDomain(site.domainName) === normalizedDomain &&
                site.partnerId !== selectedPartnerId
        ) ?? null
    }, [domainLooksValid, normalizedDomain, selectedPartnerId, siteOptions])

    React.useEffect(() => {
        if (!autoFocus) return
        const timer = window.setTimeout(() => {
            domainInputRef.current?.focus()
            domainInputRef.current?.select()
        }, 30)
        return () => window.clearTimeout(timer)
    }, [autoFocus])

    React.useEffect(() => {
        if (typeof window === "undefined") return

        try {
            const raw = window.localStorage.getItem(QUICK_ADD_DEFAULTS_KEY)
            if (!raw) return

            const parsed = JSON.parse(raw) as QuickAddDefaults
            if (parsed.status === "Active" || parsed.status === "Completed" || parsed.status === "Closed") {
                setStatus(parsed.status)
            }
            if (parsed.paymentStatus === "Paid" || parsed.paymentStatus === "Unpaid") {
                setPaymentStatus(parsed.paymentStatus)
            }
        } catch {}
    }, [partners, services])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        const payload: QuickAddDefaults = {
            status,
            paymentStatus,
        }
        window.localStorage.setItem(QUICK_ADD_DEFAULTS_KEY, JSON.stringify(payload))
    }, [paymentStatus, status])

    const toggleService = React.useCallback(
        (serviceId: string) => {
            const service = services.find((candidate) => candidate.id === serviceId)
            if (!service) return

            setSelectedServiceIds((current) => {
                if (current.includes(serviceId)) {
                    return current.filter((id) => id !== serviceId)
                }

                if (current.length === 0) return [serviceId]

                const currentServices = services.filter((candidate) => current.includes(candidate.id))
                const currentKind = currentServices[0]?.isRecurring
                if (currentKind !== undefined && currentKind !== service.isRecurring) {
                    toast.error("Use only one project type at a time (monthly or one-time).")
                    return current
                }

                return [...current, serviceId]
            })
        },
        [services]
    )

    const missingRequirements = React.useMemo(() => {
        const missing: string[] = []

        if (!selectedPartnerId) {
            missing.push("partner")
        }

        if (!normalizedDomain) {
            missing.push("domain")
        } else if (!domainLooksValid) {
            missing.push("valid domain")
        }

        if (selectedServiceIds.length === 0) {
            missing.push("service")
        }

        return missing
    }, [domainLooksValid, normalizedDomain, selectedPartnerId, selectedServiceIds.length])

    const createProjectFromDraft = React.useCallback(async () => {
        if (saving) return

        if (missingRequirements.length > 0) {
            toast.error(`Complete required fields: ${missingRequirements.join(", ")}.`)
            return
        }

        const parsedAmount = parseNumberish(amount)
        if (amount.trim() && parsedAmount === undefined) {
            toast.error("Amount must be a valid number.")
            return
        }

        setSaving(true)

        try {
            let targetSiteId = matchedSite?.id ?? ""

            if (!targetSiteId) {
                const site = await createSite(selectedPartnerId, normalizedDomain)
                targetSiteId = site.id
            }

            const result = await createProject({
                siteId: targetSiteId,
                serviceIds: selectedServiceIds,
                currentFee: parsedAmount,
                status,
                paymentStatus,
            })

            if (!result.success || !result.data) {
                toast.error(result.error || "Failed to create project.")
                return
            }

            const createdProjectId = result.data.id
            router.refresh()

            toast.success("Project created", {
                action: {
                    label: "Undo",
                    onClick: async () => {
                        const undoResult = await deleteProject(createdProjectId)
                        if (!undoResult.success) {
                            toast.error(undoResult.error || "Failed to undo project creation.")
                            return
                        }
                        router.refresh()
                        toast.success("Project removed")
                    },
                },
            })

            const keepStatus = status
            const keepPaymentStatus = paymentStatus

            setDomainValue("")
            setAmount("0")
            setServicePickerValue("")
            setSelectedPartnerId("")
            setStatus(keepStatus)
            setPaymentStatus(keepPaymentStatus)
            setSelectedServiceIds([])

            window.setTimeout(() => {
                domainInputRef.current?.focus()
            }, 20)
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create project."
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }, [
        amount,
        matchedSite,
        missingRequirements,
        normalizedDomain,
        paymentStatus,
        router,
        saving,
        selectedPartnerId,
        selectedServiceIds,
        status,
    ])

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault()
            void createProjectFromDraft()
        }
    }

    const handleAmountFocus = () => {
        if (amount !== "0") return
        window.setTimeout(() => {
            amountInputRef.current?.select()
        }, 0)
    }

    const handleAmountKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault()
            void createProjectFromDraft()
            return
        }

        const isSingleDigit = /^[0-9]$/.test(event.key)
        const isDecimal = event.key === "." || event.key === ","
        const isAllSelected =
            event.currentTarget.selectionStart === 0 &&
            event.currentTarget.selectionEnd === event.currentTarget.value.length

        if (amount === "0" && !isAllSelected && (isSingleDigit || isDecimal)) {
            event.preventDefault()
            setAmount(isDecimal ? "0." : event.key)
        }
    }

    return (
        <div className={cn("w-full rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-[var(--shadow-apple)]", rowMinWidthClass)}>
            <div className="overflow-x-auto hidescrollbar">
                <div className="min-w-[1180px]">
                    <div className="grid grid-cols-[300px_300px_250px_170px_auto_auto] items-end gap-3">
                        <label className="flex flex-col gap-1.5">
                            <span className="caption-caps">Partner</span>
                            <div className="relative">
                                <select
                                    value={selectedPartnerId}
                                    onChange={(event) => setSelectedPartnerId(event.target.value)}
                                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-[13px] font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                    aria-label="Partner"
                                >
                                    <option value="">Select partner</option>
                                    {partners.map((partner) => (
                                        <option key={partner.id} value={partner.id}>
                                            {partner.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            </div>
                        </label>

                        <label className="flex flex-col gap-1.5">
                            <span className="caption-caps">Domain</span>
                            <div className="relative">
                                <Input
                                    ref={domainInputRef}
                                    value={domainValue}
                                    onChange={(event) => setDomainValue(event.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={!selectedPartnerId}
                                    list={domainListId}
                                    placeholder={selectedPartnerId ? "domain.com" : "Select partner first"}
                                    className={cn(
                                        "h-10 rounded-xl border bg-white pr-16 text-[13px] font-medium",
                                        !selectedPartnerId && "cursor-not-allowed bg-slate-50 text-slate-400",
                                        domainValue && !domainLooksValid && "border-rose-300",
                                        domainLooksValid && !matchedSite && "border-blue-300",
                                        matchedSite && "border-emerald-300"
                                    )}
                                />
                                <datalist id={domainListId}>
                                    {sitesForPartner.map((site) => (
                                        <option key={site.id} value={site.domainName} />
                                    ))}
                                </datalist>
                                {selectedPartnerId ? (
                                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                                        {sitesForPartner.length} {sitesForPartner.length === 1 ? "site" : "sites"}
                                    </span>
                                ) : null}
                                {domainLooksValid ? (
                                    <span
                                        className={cn(
                                            "pointer-events-none absolute right-2 -top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]",
                                            matchedSite
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-blue-100 text-blue-700"
                                        )}
                                    >
                                        {matchedSite ? "linked" : "new"}
                                    </span>
                                ) : null}
                            </div>
                        </label>

                        <label className="flex flex-col gap-1.5">
                            <span className="caption-caps">Service</span>
                            <div className="relative">
                                <select
                                    value={servicePickerValue}
                                    onChange={(event) => {
                                        const value = event.target.value
                                        if (value) {
                                            toggleService(value)
                                        }
                                        setServicePickerValue("")
                                    }}
                                    className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-[13px] font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                                    aria-label="Add service"
                                >
                                    <option value="">Add service</option>
                                    {remainingServices.map((service) => (
                                        <option key={service.id} value={service.id}>
                                            {service.serviceName}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            </div>
                        </label>

                        <label className="flex flex-col gap-1.5">
                            <span className="caption-caps">Amount</span>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                                    RON
                                </span>
                                <Input
                                    ref={amountInputRef}
                                    value={amount}
                                    onChange={(event) => setAmount(event.target.value)}
                                    onFocus={handleAmountFocus}
                                    onKeyDown={handleAmountKeyDown}
                                    onBlur={() => {
                                        if (amount.trim() === "") setAmount("0")
                                    }}
                                    placeholder="0"
                                    className="h-10 rounded-xl border-slate-200 bg-white pl-11 pr-3 text-right font-mono text-[13px] tabular-nums"
                                />
                            </div>
                        </label>

                        <Button
                            type="button"
                            variant="default"
                            className="h-10 min-w-[114px] rounded-xl px-5 font-semibold shadow-[var(--shadow-apple)]"
                            onClick={() => void createProjectFromDraft()}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            {saving ? "Saving" : "Save"}
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            className="h-10 rounded-xl px-2.5 text-slate-500 hover:bg-slate-100"
                            onClick={onCancel}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-start gap-3">
                <div className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                    {(["Active", "Completed", "Closed"] as ProjectStatus[]).map((option) => {
                        const isActive = status === option
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setStatus(option)}
                                className={cn(
                                    "inline-flex h-6 items-center gap-1 rounded-lg px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-all",
                                    isActive
                                        ? option === "Active"
                                            ? "bg-[#2563EB] text-white shadow-sm"
                                            : option === "Completed"
                                                ? "bg-[#ECFDF5] text-[#047857] shadow-sm"
                                                : "bg-slate-700 text-white shadow-sm"
                                        : "text-slate-500 hover:bg-white/80"
                                )}
                            >
                                {option === "Active" ? <Play className="h-3 w-3 fill-current" /> : option === "Completed" ? <Check className="h-3.5 w-3.5" /> : <Square className="h-3 w-3 fill-current" />}
                                {option}
                            </button>
                        )
                    })}
                </div>

                <div className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                    {(["Paid", "Unpaid"] as PaymentStatus[]).map((option) => {
                        const isActive = paymentStatus === option
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setPaymentStatus(option)}
                                className={cn(
                                    "inline-flex h-6 items-center rounded-lg px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-all",
                                    isActive
                                        ? option === "Paid"
                                            ? "bg-[#ECFDF5] text-[#047857] shadow-sm"
                                            : "bg-[#FFF1F2] text-[#BE123C] shadow-sm"
                                        : "text-slate-500 hover:bg-white/80"
                                )}
                            >
                                {option}
                            </button>
                        )
                    })}
                </div>

                {selectedServices.map((service) => (
                    <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(service.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-full border border-blue-200/70 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-700 shadow-sm"
                        title="Remove service"
                    >
                        <span className="max-w-[180px] truncate">{service.serviceName}</span>
                        <X className="h-3 w-3" />
                    </button>
                ))}

                <span className="inline-flex h-7 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-medium tracking-[0.01em] text-slate-600">
                    {!selectedPartnerId ? (
                        <span>Choose a partner to unlock domain suggestions.</span>
                    ) : !domainValue ? (
                        <span>
                            Start typing a domain for {selectedPartnerName}. {sitesForPartner.length} known {sitesForPartner.length === 1 ? "site" : "sites"} available.
                        </span>
                    ) : !domainLooksValid ? (
                        <span className="text-rose-600">Enter a valid domain (example.com).</span>
                    ) : matchedSite ? (
                        <span className="text-emerald-700">Matched an existing site for {selectedPartnerName}.</span>
                    ) : matchedSiteOtherPartner ? (
                        <span className="text-amber-700">Domain exists under another partner. Saving will also add it to {selectedPartnerName}.</span>
                    ) : (
                        <span className="text-blue-700">This will create a new site for {selectedPartnerName}.</span>
                    )}
                </span>

                {missingRequirements.length > 0 ? (
                    <span className="inline-flex h-7 items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-rose-700">
                        Required: {missingRequirements.join(" · ")}
                    </span>
                ) : (
                    <span className="inline-flex h-7 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-emerald-700">
                        Ready
                    </span>
                )}
            </div>
        </div>
    )
}
