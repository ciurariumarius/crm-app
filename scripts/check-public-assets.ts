import { readdir } from "node:fs/promises"
import path from "node:path"
import {
    BLOCKED_PUBLIC_DIAGNOSTIC_PATTERN,
    PUBLIC_ASSET_PATH_SET,
} from "../lib/security/public-assets"

async function walk(directory: string, prefix = ""): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true })
    const results: string[] = []

    for (const entry of entries) {
        const relative = path.posix.join(prefix, entry.name)
        if (entry.isDirectory()) {
            results.push(...await walk(path.join(directory, entry.name), relative))
        } else if (entry.isFile()) {
            results.push(`/${relative}`)
        }
    }

    return results
}

async function main() {
    const files = await walk(path.join(process.cwd(), "public"))
    const blocked = files.filter((file) => BLOCKED_PUBLIC_DIAGNOSTIC_PATTERN.test(file))
    const unexpected = files.filter((file) => !PUBLIC_ASSET_PATH_SET.has(file))

    if (blocked.length || unexpected.length) {
        throw new Error(
            [
                blocked.length ? `blocked diagnostics: ${blocked.join(", ")}` : "",
                unexpected.length ? `unexpected public assets: ${unexpected.join(", ")}` : "",
            ].filter(Boolean).join("; ")
        )
    }

    process.stdout.write(`Public asset allowlist OK (${files.length} files).\n`)
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
