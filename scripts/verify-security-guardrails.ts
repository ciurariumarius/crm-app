import { strict as assert } from "node:assert"
import { parseAndValidateExternalUrl } from "@/lib/security/domain-validation"

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
]

function run() {
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

  console.log("SECURITY_GUARDRAILS_OK")
}

run()
