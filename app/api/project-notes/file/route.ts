import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { requireAuth } from "@/lib/auth"
import { apiRouteError } from "@/lib/api-response"
import {
    getProjectNoteMimeTypeFromRelativePath,
    isProjectNoteUrlExpired,
    resolveProjectNoteAbsolutePath,
    verifyProjectNotePathSignature,
} from "@/lib/project-note-storage"

export const runtime = "nodejs"

export async function GET(request: Request) {
    try {
        await requireAuth()
        const { searchParams } = new URL(request.url)
        const relativePath = searchParams.get("path") || ""
        const signature = searchParams.get("sig") || ""
        const expiresAtRaw = searchParams.get("exp")

        if (!relativePath || !signature) {
            return NextResponse.json({ success: false, error: "Missing file path or signature." }, { status: 400 })
        }

        if (expiresAtRaw) {
            const expiresAtUnix = Number.parseInt(expiresAtRaw, 10)
            if (!Number.isFinite(expiresAtUnix) || expiresAtUnix <= 0) {
                return NextResponse.json({ success: false, error: "Invalid file expiry timestamp." }, { status: 400 })
            }

            if (isProjectNoteUrlExpired(expiresAtUnix)) {
                return NextResponse.json({ success: false, error: "File URL has expired." }, { status: 403 })
            }

            if (!verifyProjectNotePathSignature(relativePath, signature, expiresAtUnix)) {
                return NextResponse.json({ success: false, error: "Invalid file signature." }, { status: 403 })
            }
        } else if (!verifyProjectNotePathSignature(relativePath, signature)) {
            return NextResponse.json({ success: false, error: "Invalid file signature." }, { status: 403 })
        }

        const absolutePath = resolveProjectNoteAbsolutePath(relativePath)
        const fileBuffer = await readFile(absolutePath)
        const fileName = path.basename(relativePath)
        const mimeType = getProjectNoteMimeTypeFromRelativePath(relativePath)

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": mimeType,
                "Content-Disposition": `inline; filename=\"${fileName}\"`,
                "Cache-Control": "private, max-age=300, must-revalidate",
                "X-Content-Type-Options": "nosniff",
            },
        })
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes("Invalid project note path")) {
                return NextResponse.json({ success: false, error: "Invalid file path." }, { status: 400 })
            }
        }

        const fsError = error as NodeJS.ErrnoException
        if (fsError?.code === "ENOENT") {
            return NextResponse.json({ success: false, error: "File not found." }, { status: 404 })
        }

        return apiRouteError(error, {
            unauthorizedMessage: "Unauthorized",
            unauthorizedCode: "AUTH_REQUIRED",
            fallbackMessage: "Failed to load file.",
            fallbackCode: "PROJECT_NOTE_FILE_LOAD_FAILED",
            logLabel: "[project-notes/file] failed",
        })
    }
}
