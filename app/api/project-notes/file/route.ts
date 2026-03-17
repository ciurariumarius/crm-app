import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { requireTenantContext } from "@/lib/tenant"
import {
    getProjectNoteMimeTypeFromRelativePath,
    getTenantIdFromProjectNotePath,
    isProjectNoteUrlExpired,
    resolveProjectNoteAbsolutePath,
    verifyProjectNotePathSignature,
} from "@/lib/project-note-storage"

export const runtime = "nodejs"

export async function GET(request: Request) {
    try {
        const session = await requireTenantContext()
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

        const pathTenantId = getTenantIdFromProjectNotePath(relativePath)
        if (!pathTenantId || pathTenantId !== session.tenantId) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 })
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
            if (error.message === "Unauthorized") {
                return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
            }

            if (error.message.includes("Invalid project note path")) {
                return NextResponse.json({ success: false, error: "Invalid file path." }, { status: 400 })
            }
        }

        const fsError = error as NodeJS.ErrnoException
        if (fsError?.code === "ENOENT") {
            return NextResponse.json({ success: false, error: "File not found." }, { status: 404 })
        }

        return NextResponse.json({ success: false, error: "Failed to load file." }, { status: 500 })
    }
}
