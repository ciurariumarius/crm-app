export type SettlementProjectSnapshot = {
    id: string
    name?: string
    fee?: number | string | null
}

export type SettlementAuditDetails = {
    partnerId?: string
    partnerName?: string
    totalAmount?: number
    projectCount?: number
    settledAt?: string
    projects: SettlementProjectSnapshot[]
}

export function parseSettlementAuditDetails(details: string | null | undefined): SettlementAuditDetails | null {
    if (!details) return null

    try {
        const parsed = JSON.parse(details) as Partial<SettlementAuditDetails>
        if (!Array.isArray(parsed.projects)) return null

        const seen = new Set<string>()
        const projects = parsed.projects.filter((project): project is SettlementProjectSnapshot => {
            if (!project || typeof project.id !== "string" || project.id.length === 0 || seen.has(project.id)) {
                return false
            }
            seen.add(project.id)
            return true
        })

        if (projects.length === 0) return null
        return { ...parsed, projects }
    } catch {
        return null
    }
}

export function parseVoidedSettlementId(details: string | null | undefined): string | null {
    if (!details) return null

    try {
        const parsed = JSON.parse(details) as { auditLogId?: unknown }
        return typeof parsed.auditLogId === "string" && parsed.auditLogId.length > 0
            ? parsed.auditLogId
            : null
    } catch {
        return null
    }
}

export function isProjectStillInSettlementState(
    project: { paymentStatus: string; paidAt: Date | string | null },
    settlement: { createdAt: Date | string; settledAt?: string }
) {
    if (project.paymentStatus !== "Paid" || !project.paidAt) return false

    const paidAt = new Date(project.paidAt).getTime()
    if (!Number.isFinite(paidAt)) return false

    if (settlement.settledAt) {
        const settledAt = new Date(settlement.settledAt).getTime()
        return Number.isFinite(settledAt) && paidAt === settledAt
    }

    // Legacy settlements did not store settledAt. Their audit record was written
    // immediately after paidAt, so accept only that narrow historical window.
    const createdAt = new Date(settlement.createdAt).getTime()
    return Number.isFinite(createdAt) && paidAt <= createdAt && createdAt - paidAt <= 60_000
}
