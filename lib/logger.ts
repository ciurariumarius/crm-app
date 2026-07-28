type LogLevel = "info" | "warn" | "error"

const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|secret|token|credential|key/i

function redact(value: unknown, depth = 0): unknown {
    if (depth > 4) return "[MAX_DEPTH]"
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message.slice(0, 1000),
            stack: value.stack?.split("\n").slice(0, 8).join("\n"),
        }
    }
    if (Array.isArray(value)) return value.slice(0, 50).map((entry) => redact(entry, depth + 1))
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
                key,
                SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redact(entry, depth + 1),
            ])
        )
    }
    if (typeof value === "string") return value.slice(0, 2000)
    return value
}

function write(level: LogLevel, event: string, fields?: Record<string, unknown>) {
    const payload = JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event,
        ...(fields ? redact(fields) as Record<string, unknown> : {}),
    })

    if (level === "error") console.error(payload)
    else if (level === "warn") console.warn(payload)
    else console.info(payload)
}

export const logger = {
    info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
    warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
    error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
}
