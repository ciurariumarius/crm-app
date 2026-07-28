import {
    assertPublicResolvableHost,
    isSafePublicIconUrl,
    parseAndValidateExternalUrl,
} from "@/lib/security/domain-validation"

const ICON_REL_REGEX = /\b(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed)\b/i
const LINK_TAG_REGEX = /<link\b[^>]*>/gi
const ATTR_REGEX = /([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g

const MAX_FAVICON_HTML_BYTES = 256 * 1024
const FAVICON_FETCH_TIMEOUT_MS = 2500
const MAX_REDIRECTS = 2

function withTimeoutSignal(timeoutMs: number) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    return {
        signal: controller.signal,
        clear: () => clearTimeout(timeout),
    }
}

async function readTextBodyWithLimit(response: Response, maxBytes: number) {
    if (!response.body) return ""
    const reader = response.body.getReader()
    const decoder = new TextDecoder("utf-8")
    let size = 0
    let text = ""

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue

        size += value.byteLength
        if (size > maxBytes) {
            throw new Error("Favicon response exceeded size cap")
        }

        text += decoder.decode(value, { stream: true })
    }

    text += decoder.decode()
    return text
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

async function extractIconHrefFromHtml(html: string, baseUrl: string) {
    let match: RegExpExecArray | null = null
    LINK_TAG_REGEX.lastIndex = 0

    while ((match = LINK_TAG_REGEX.exec(html)) !== null) {
        const tag = match[0]
        const attrs = parseAttributes(tag)
        const rel = attrs.rel || ""
        const href = attrs.href || ""

        if (!href || !ICON_REL_REGEX.test(rel)) continue

        const absolute = toAbsoluteUrl(href, baseUrl)
        if (!absolute) continue
        if (!isSafePublicIconUrl(absolute)) continue

        const { normalizedHost } = parseAndValidateExternalUrl(absolute)
        await assertPublicResolvableHost(normalizedHost)
        return absolute
    }

    return null
}

async function fetchHomepageHtmlWithSafeRedirects(initialUrl: string) {
    let currentUrl = initialUrl

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        const { normalizedHost } = parseAndValidateExternalUrl(currentUrl)
        await assertPublicResolvableHost(normalizedHost)

        const timeout = withTimeoutSignal(FAVICON_FETCH_TIMEOUT_MS)

        try {
            const response = await fetch(currentUrl, {
                method: "GET",
                redirect: "manual",
                signal: timeout.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; PixelistBot/1.0)",
                    Accept: "text/html,application/xhtml+xml",
                },
                cache: "no-store",
            })

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get("location")
                if (!location) return null

                currentUrl = new URL(location, currentUrl).toString()
                continue
            }

            if (!response.ok) return null

            const contentType = (response.headers.get("content-type") || "").toLowerCase()
            if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
                return null
            }

            const html = await readTextBodyWithLimit(response, MAX_FAVICON_HTML_BYTES)
            return {
                html,
                finalUrl: response.url || currentUrl,
            }
        } finally {
            timeout.clear()
        }
    }

    return null
}

export function normalizeDomainHost(input: string | null | undefined) {
    if (!input) return ""

    try {
        const { normalizedHost } = parseAndValidateExternalUrl(input)
        return normalizedHost
    } catch {
        return ""
    }
}

export async function resolveDomainFaviconUrl(domain: string | null | undefined) {
    if (!domain) return null

    const { normalizedHost } = parseAndValidateExternalUrl(domain)
    await assertPublicResolvableHost(normalizedHost)

    const homepage = `https://${normalizedHost}`

    const payload = await fetchHomepageHtmlWithSafeRedirects(homepage)
    if (!payload) return null

    const discovered = await extractIconHrefFromHtml(payload.html, payload.finalUrl)
    if (discovered) return discovered

    return `https://${normalizedHost}/favicon.ico`
}
