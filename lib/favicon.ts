const DOMAIN_CLEANUP_REGEX = /^https?:\/\//i
const ICON_REL_REGEX = /\b(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed)\b/i
const LINK_TAG_REGEX = /<link\b[^>]*>/gi
const ATTR_REGEX = /([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g

function withTimeoutSignal(timeoutMs: number) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    return {
        signal: controller.signal,
        clear: () => clearTimeout(timeout),
    }
}

function parseAttributes(tag: string) {
    const attrs: Record<string, string> = {}
    let match: RegExpExecArray | null = null
    ATTR_REGEX.lastIndex = 0
    while ((match = ATTR_REGEX.exec(tag)) !== null) {
        const key = match[1]?.toLowerCase()
        const value = match[2] ?? match[3] ?? match[4] ?? ""
        if (!key) continue
        attrs[key] = value
    }
    return attrs
}

function toAbsoluteUrl(href: string, baseUrl: string) {
    try {
        return new URL(href, baseUrl).toString()
    } catch {
        return null
    }
}

function extractIconHrefFromHtml(html: string, baseUrl: string) {
    let match: RegExpExecArray | null = null
    LINK_TAG_REGEX.lastIndex = 0

    while ((match = LINK_TAG_REGEX.exec(html)) !== null) {
        const tag = match[0]
        const attrs = parseAttributes(tag)
        const rel = attrs.rel || ""
        const href = attrs.href || ""
        if (!href) continue
        if (!ICON_REL_REGEX.test(rel)) continue

        const absolute = toAbsoluteUrl(href, baseUrl)
        if (absolute) return absolute
    }

    return null
}

export function normalizeDomainHost(input: string | null | undefined) {
    const raw = (input || "").trim()
    if (!raw) return ""
    return raw
        .replace(DOMAIN_CLEANUP_REGEX, "")
        .split("/")[0]
        .toLowerCase()
        .trim()
}

export async function resolveDomainFaviconUrl(domain: string | null | undefined) {
    const host = normalizeDomainHost(domain)
    if (!host) return null

    const homepage = `https://${host}`
    const timeout = withTimeoutSignal(3500)

    try {
        const response = await fetch(homepage, {
            method: "GET",
            redirect: "follow",
            signal: timeout.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; PixelistBot/1.0)",
                "Accept": "text/html,application/xhtml+xml",
            },
            cache: "no-store",
        })
        if (response.ok) {
            const contentType = response.headers.get("content-type") || ""
            if (contentType.includes("html")) {
                const html = await response.text()
                const discovered = extractIconHrefFromHtml(html, response.url || homepage)
                if (discovered) return discovered
            }
        }
    } catch {
        // Ignore network/parser errors and fallback below.
    } finally {
        timeout.clear()
    }

    return `https://${host}/favicon.ico`
}
