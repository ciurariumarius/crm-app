import { getEncryptionConfigSummary } from "@/lib/crypto"

let hasRunSecurityPreflight = false

function assertProductionSecurityConfig() {
    if (process.env.NODE_ENV !== "production") return

    if (process.env.ENABLE_SESSION_REGISTRY !== "true") {
        throw new Error("FATAL: ENABLE_SESSION_REGISTRY must be true in production")
    }

    try {
        getEncryptionConfigSummary()
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown encryption config error"
        throw new Error(`FATAL: Production security preflight failed (${message})`)
    }
}

export function runSecurityPreflight() {
    if (hasRunSecurityPreflight) return
    assertProductionSecurityConfig()
    hasRunSecurityPreflight = true
}
