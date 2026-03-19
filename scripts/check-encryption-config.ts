import { getEncryptionConfigSummary } from "../lib/crypto"

function main() {
    const summary = getEncryptionConfigSummary()
    process.stdout.write("Encryption config OK\n")
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

try {
    main()
} catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    process.stderr.write(`Encryption config invalid: ${message}\n`)
    process.exitCode = 1
}
