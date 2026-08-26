import { createHmac, timingSafeEqual } from "node:crypto"
import path from "node:path"

const DEFAULT_STORAGE_ROOT = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "storage",
    "project-notes"
)
const DEFAULT_SIGNED_URL_TTL_SECONDS = 30 * 24 * 60 * 60
const MIN_SIGNED_URL_TTL_SECONDS = 60
const MAX_SIGNED_URL_TTL_SECONDS = 365 * 24 * 60 * 60

const MIME_BY_EXTENSION: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
}

function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

function parseTtlFromEnv() {
    const raw = process.env.PROJECT_NOTES_SIGNED_URL_TTL_SECONDS?.trim()
    const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_SIGNED_URL_TTL_SECONDS
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_SIGNED_URL_TTL_SECONDS
    }
    return clampNumber(parsed, MIN_SIGNED_URL_TTL_SECONDS, MAX_SIGNED_URL_TTL_SECONDS)
}

function buildProjectNoteSignaturePayload(relativePath: string, expiresAtUnix?: number) {
    return expiresAtUnix ? `${relativePath}:${expiresAtUnix}` : relativePath
}

function getSigningSecret() {
    const configured = process.env.PROJECT_NOTES_SIGNING_SECRET?.trim()
    if (configured) return configured

    // Production should keep signing key separate from auth/session key material.
    if (process.env.NODE_ENV === "production") {
        throw new Error("PROJECT_NOTES_SIGNING_SECRET must be set in production")
    }

    const fallback = process.env.JWT_SECRET?.trim()
    if (!fallback) {
        throw new Error("PROJECT_NOTES_SIGNING_SECRET or JWT_SECRET must be set")
    }
    return fallback
}

export function sanitizeProjectNoteSegment(input: string, fallback = "project") {
    const normalized = input.trim().replace(/[^a-zA-Z0-9_-]/g, "")
    return normalized || fallback
}

export function getProjectNotesStorageRoot() {
    return process.env.PROJECT_NOTES_STORAGE_ROOT?.trim() || DEFAULT_STORAGE_ROOT
}

export function buildProjectNoteRelativePath(
    projectId: string,
    fileName: string
) {
    const safeProject = sanitizeProjectNoteSegment(projectId, "project").slice(0, 64)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "")
    return `${safeProject}/${safeFileName}`
}

export function resolveProjectNoteAbsolutePath(relativePath: string) {
    if (!relativePath || relativePath.includes("\0")) {
        throw new Error("Invalid project note path")
    }

    const normalized = path.posix.normalize(relativePath).replace(/^\/+/, "")
    if (
        normalized === ".." ||
        normalized.startsWith("../") ||
        normalized.includes("/../")
    ) {
        throw new Error("Invalid project note path")
    }

    const root = getProjectNotesStorageRoot()
    const absolute = path.resolve(root, ...normalized.split("/"))
    const rootWithSeparator = `${path.resolve(root)}${path.sep}`
    if (!absolute.startsWith(rootWithSeparator)) {
        throw new Error("Invalid project note path")
    }

    return absolute
}

export function signProjectNotePath(relativePath: string, expiresAtUnix?: number) {
    return createHmac("sha256", getSigningSecret())
        .update(buildProjectNoteSignaturePayload(relativePath, expiresAtUnix))
        .digest("hex")
}

export function verifyProjectNotePathSignature(
    relativePath: string,
    signature: string,
    expiresAtUnix?: number
) {
    if (!signature) return false
    const expected = signProjectNotePath(relativePath, expiresAtUnix)
    const expectedBuffer = Buffer.from(expected)
    const signatureBuffer = Buffer.from(signature)
    if (expectedBuffer.length !== signatureBuffer.length) {
        return false
    }
    return timingSafeEqual(expectedBuffer, signatureBuffer)
}

export function isProjectNoteUrlExpired(expiresAtUnix: number) {
    const nowUnix = Math.floor(Date.now() / 1000)
    return nowUnix > expiresAtUnix
}

export function createSignedProjectNoteUrl(
  relativePath: string,
  options?: { expiresAtUnix?: number; ttlSeconds?: number }
) {
    if (options?.expiresAtUnix === undefined && options?.ttlSeconds === undefined) {
        const signature = signProjectNotePath(relativePath)
        return `/api/project-notes/file?path=${encodeURIComponent(relativePath)}&sig=${signature}`
    }
    const nowUnix = Math.floor(Date.now() / 1000)
    const ttlSeconds = clampNumber(
        options?.ttlSeconds ?? parseTtlFromEnv(),
        MIN_SIGNED_URL_TTL_SECONDS,
        MAX_SIGNED_URL_TTL_SECONDS
    )
    const expiresAtUnix = options?.expiresAtUnix ?? nowUnix + ttlSeconds
    const signature = signProjectNotePath(relativePath, expiresAtUnix)
    return `/api/project-notes/file?path=${encodeURIComponent(relativePath)}&sig=${signature}&exp=${expiresAtUnix}`
}

export function getProjectNoteMimeTypeFromRelativePath(relativePath: string) {
    const extension = path.extname(relativePath).replace(".", "").toLowerCase()
    return MIME_BY_EXTENSION[extension] || "application/octet-stream"
}
