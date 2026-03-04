import { requireAuth } from "@/lib/auth"

export async function requireTenantContext() {
    const session = await requireAuth()
    if (!session.tenantId) {
        throw new Error("Tenant context is missing")
    }
    return session
}

