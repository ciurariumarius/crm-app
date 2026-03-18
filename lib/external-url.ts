export function normalizeExternalHttpUrl(input: string | null | undefined): string | null {
    if (!input) return null

    const trimmed = input.trim()
    if (!trimmed) return null

    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`

    let parsed: URL
    try {
        parsed = new URL(candidate)
    } catch {
        return null
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null
    }

    if (!parsed.hostname) {
        return null
    }

    return parsed.toString()
}

export function isSafeExternalHttpUrl(input: string | null | undefined): boolean {
    return normalizeExternalHttpUrl(input) !== null
}
