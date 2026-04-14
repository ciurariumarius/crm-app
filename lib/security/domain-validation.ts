import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { domainToASCII } from "node:url"

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])
const ALLOWED_PORTS = new Set(["", "80", "443"])
const RESERVED_HOST_SUFFIXES = [".localhost", ".local", ".internal"]

const IPV4_RESERVED_RANGES: Array<[number, number]> = [
    [ipv4ToNumber("0.0.0.0"), ipv4ToNumber("0.255.255.255")],
    [ipv4ToNumber("10.0.0.0"), ipv4ToNumber("10.255.255.255")],
    [ipv4ToNumber("100.64.0.0"), ipv4ToNumber("100.127.255.255")],
    [ipv4ToNumber("127.0.0.0"), ipv4ToNumber("127.255.255.255")],
    [ipv4ToNumber("169.254.0.0"), ipv4ToNumber("169.254.255.255")],
    [ipv4ToNumber("172.16.0.0"), ipv4ToNumber("172.31.255.255")],
    [ipv4ToNumber("192.0.0.0"), ipv4ToNumber("192.0.0.255")],
    [ipv4ToNumber("192.0.2.0"), ipv4ToNumber("192.0.2.255")],
    [ipv4ToNumber("192.168.0.0"), ipv4ToNumber("192.168.255.255")],
    [ipv4ToNumber("198.18.0.0"), ipv4ToNumber("198.19.255.255")],
    [ipv4ToNumber("198.51.100.0"), ipv4ToNumber("198.51.100.255")],
    [ipv4ToNumber("203.0.113.0"), ipv4ToNumber("203.0.113.255")],
    [ipv4ToNumber("224.0.0.0"), ipv4ToNumber("255.255.255.255")],
]

export class DomainValidationError extends Error {
    code: string

    constructor(code: string, message: string) {
        super(message)
        this.name = "DomainValidationError"
        this.code = code
    }
}

function ipv4ToNumber(ipv4: string) {
    const parts = ipv4.split(".").map((part) => Number.parseInt(part, 10))
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
        throw new Error(`Invalid IPv4 address: ${ipv4}`)
    }
    return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0
}

function isReservedIpv4(ipv4: string) {
    const numeric = ipv4ToNumber(ipv4)
    return IPV4_RESERVED_RANGES.some(([start, end]) => numeric >= start && numeric <= end)
}

function isReservedIpv6(ipv6: string) {
    const normalized = ipv6.toLowerCase()

    if (normalized === "::" || normalized === "::1") return true
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
    if (/^fe[89ab]/.test(normalized)) return true
    if (normalized.startsWith("2001:db8:")) return true
    if (normalized.startsWith("::ffff:")) {
        const mapped = normalized.slice("::ffff:".length)
        if (isIP(mapped) === 4) {
            return isReservedIpv4(mapped)
        }
        return true
    }

    return false
}

function isReservedIpAddress(ipAddress: string) {
    const family = isIP(ipAddress)
    if (family === 4) return isReservedIpv4(ipAddress)
    if (family === 6) return isReservedIpv6(ipAddress)
    return true
}

function normalizeHost(hostname: string) {
    const asciiHost = domainToASCII(hostname.trim().toLowerCase())
    return asciiHost.replace(/\.$/, "")
}

export function parseAndValidateExternalUrl(input: string) {
    const trimmed = input.trim()
    if (!trimmed) {
        throw new DomainValidationError("EMPTY_INPUT", "Domain is required")
    }

    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`

    let parsed: URL
    try {
        parsed = new URL(candidate)
    } catch {
        throw new DomainValidationError("INVALID_URL", "Invalid domain URL")
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        throw new DomainValidationError("INVALID_PROTOCOL", "Only http and https URLs are allowed")
    }

    if (parsed.username || parsed.password) {
        throw new DomainValidationError("USERINFO_NOT_ALLOWED", "Embedded credentials are not allowed")
    }

    if (!ALLOWED_PORTS.has(parsed.port)) {
        throw new DomainValidationError("NON_STANDARD_PORT", "Custom ports are not allowed")
    }

    const normalizedHost = normalizeHost(parsed.hostname)
    if (!normalizedHost) {
        throw new DomainValidationError("MISSING_HOST", "Domain host is required")
    }

    if (!normalizedHost.includes(".")) {
        throw new DomainValidationError("NON_PUBLIC_HOST", "A public domain is required")
    }

    if (normalizedHost === "localhost" || RESERVED_HOST_SUFFIXES.some((suffix) => normalizedHost.endsWith(suffix))) {
        throw new DomainValidationError("LOCAL_HOST", "Local domains are not allowed")
    }

    if (isIP(normalizedHost) !== 0) {
        throw new DomainValidationError("IP_LITERAL_NOT_ALLOWED", "IP addresses are not allowed")
    }

    return {
        parsedUrl: parsed,
        normalizedHost,
    }
}

export async function assertPublicResolvableHost(hostname: string) {
    const addresses = await lookup(hostname, { all: true, verbatim: true })
    if (!addresses.length) {
        throw new DomainValidationError("DNS_RESOLVE_FAILED", "Could not resolve domain")
    }

    for (const entry of addresses) {
        if (isReservedIpAddress(entry.address)) {
            throw new DomainValidationError("PRIVATE_OR_RESERVED_ADDRESS", "Domain resolves to a private or reserved address")
        }
    }
}

export async function validateExternalDomainHostInput(input: string) {
    const { normalizedHost } = parseAndValidateExternalUrl(input)
    await assertPublicResolvableHost(normalizedHost)
    return normalizedHost
}

export function isSafePublicIconUrl(input: string) {
    try {
        parseAndValidateExternalUrl(input)
        return true
    } catch {
        return false
    }
}
