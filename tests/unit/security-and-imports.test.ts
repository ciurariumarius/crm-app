import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import {
    assertPublicResolvableHost,
    DomainValidationError,
    parseAndValidateExternalUrl,
} from "@/lib/security/domain-validation"
import {
    buildTrustedRequestContext,
    normalizeAccountIdentifier,
} from "@/lib/security/request-context"
import { buildContentSecurityPolicy } from "@/lib/security/csp"

describe("external domain validation", () => {
    it("accepts a syntactically valid domain without requiring DNS", () => {
        expect(parseAndValidateExternalUrl("not-registered-example.ro").normalizedHost)
            .toBe("not-registered-example.ro")
    })

    it.each([
        "localhost",
        "http://127.0.0.1",
        "https://example.com:8080",
        "https://user:pass@example.com",
    ])("rejects unsafe input %s", (input) => {
        expect(() => parseAndValidateExternalUrl(input)).toThrow(DomainValidationError)
    })

    it("returns a typed error when DNS is unavailable", async () => {
        await expect(assertPublicResolvableHost("not-registered-example.invalid"))
            .rejects.toMatchObject({ code: "DNS_RESOLVE_FAILED" })
    })
})

describe("trusted request context", () => {
    it("ignores invalid forwarded addresses and keeps a valid fallback", () => {
        const headers = new Headers({
            "x-forwarded-for": "spoofed-value",
            "x-real-ip": "203.0.114.10",
            "x-request-id": "request-123",
            "user-agent": "test-agent",
        })

        expect(buildTrustedRequestContext(headers)).toEqual({
            requestId: "request-123",
            ipAddress: "203.0.114.10",
            userAgent: "test-agent",
        })
    })

    it("normalizes account identifiers before rate-limit keying", () => {
        expect(normalizeAccountIdentifier("  ADMIN  ")).toBe("admin")
    })
})

describe("production CSP", () => {
    it("uses a nonce without allowing inline scripts", () => {
        const csp = buildContentSecurityPolicy("nonce123", false)
        const scriptDirective = csp.split("; ").find((entry) => entry.startsWith("script-src"))

        expect(scriptDirective).toContain("'nonce-nonce123'")
        expect(scriptDirective).not.toContain("'unsafe-inline'")
        expect(scriptDirective).not.toContain("'unsafe-eval'")
    })
})

describe("ExcelJS dependency compatibility", () => {
    it("round-trips a workbook after the nested UUID override", async () => {
        const workbook = new ExcelJS.Workbook()
        const sheet = workbook.addWorksheet("Tasks")
        sheet.addRow(["Client", "Minutes"])
        sheet.addRow(["example.ro", 90])

        const buffer = await workbook.xlsx.writeBuffer()
        const reloaded = new ExcelJS.Workbook()
        await reloaded.xlsx.load(buffer)

        expect(reloaded.getWorksheet("Tasks")?.getCell("A2").value).toBe("example.ro")
        expect(reloaded.getWorksheet("Tasks")?.getCell("B2").value).toBe(90)
    })
})
