import { strict as assert } from "node:assert"
import { parseAndValidateExternalUrl } from "@/lib/security/domain-validation"
import { buildContentSecurityPolicy } from "@/lib/security/csp"
import { BLOCKED_PUBLIC_DIAGNOSTIC_PATTERN } from "@/lib/security/public-assets"
import { buildTrustedRequestContext } from "@/lib/security/request-context"
import { readFile } from "node:fs/promises"

const shouldFail = [
  "localhost",
  "127.0.0.1",
  "169.254.10.5",
  "10.0.0.5",
  "172.16.1.2",
  "192.168.1.7",
  "https://admin:secret@example.com",
  "https://example.com:8080",
]

const shouldPass = [
  "https://example.com",
  "example.org",
  "https://cdn.example.net/assets/favicon.ico",
  "not-yet-resolved-example.ro",
]

async function run() {
  for (const input of shouldFail) {
    let failed = false
    try {
      parseAndValidateExternalUrl(input)
    } catch {
      failed = true
    }
    assert.equal(failed, true, `Expected input to fail validation: ${input}`)
  }

  for (const input of shouldPass) {
    const parsed = parseAndValidateExternalUrl(input)
    assert.ok(parsed.normalizedHost.length > 0, `Expected host for ${input}`)
  }

  const context = buildTrustedRequestContext(new Headers({
    "x-forwarded-for": "not-an-ip",
    "x-real-ip": "203.0.114.10",
  }))
  assert.equal(context.ipAddress, "203.0.114.10")
  assert.equal(BLOCKED_PUBLIC_DIAGNOSTIC_PATTERN.test("/pm2_out.txt"), true)

  const scriptDirective = buildContentSecurityPolicy("guardrail", false)
    .split("; ")
    .find((directive) => directive.startsWith("script-src"))
  assert.ok(scriptDirective?.includes("'nonce-guardrail'"))
  assert.equal(scriptDirective?.includes("'unsafe-inline'"), false)

  const authSource = await readFile("lib/actions/auth.ts", "utf8")
  assert.ok(authSource.includes("login_account:"))
  assert.ok(authSource.includes("2fa_account:"))

  console.log("SECURITY_GUARDRAILS_OK")
}

void run()
