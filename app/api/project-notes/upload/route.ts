import { NextResponse } from "next/server"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { requireTenantContext } from "@/lib/tenant"
import { apiRouteError } from "@/lib/api-response"
import {
    buildProjectNoteRelativePath,
    createSignedProjectNoteUrl,
    resolveProjectNoteAbsolutePath,
    sanitizeProjectNoteSegment,
} from "@/lib/project-note-storage"

export const runtime = "nodejs"

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024
const MAX_FILES_PER_REQUEST = 8

type AllowedImageExtension = "png" | "jpg" | "webp" | "gif"

function detectImageExtensionFromMagicBytes(buffer: Buffer): AllowedImageExtension | null {
    if (buffer.length >= 8) {
        const isPng =
            buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47 &&
            buffer[4] === 0x0d &&
            buffer[5] === 0x0a &&
            buffer[6] === 0x1a &&
            buffer[7] === 0x0a
        if (isPng) return "png"
    }

    if (buffer.length >= 3) {
        const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
        if (isJpeg) return "jpg"
    }

    if (buffer.length >= 12) {
        const riffHeader = buffer.toString("ascii", 0, 4) === "RIFF"
        const webpHeader = buffer.toString("ascii", 8, 12) === "WEBP"
        if (riffHeader && webpHeader) return "webp"
    }

    if (buffer.length >= 6) {
        const gifHeader = buffer.toString("ascii", 0, 6)
        if (gifHeader === "GIF87a" || gifHeader === "GIF89a") return "gif"
    }

    return null
}

export async function POST(request: Request) {
    try {
        const session = await requireTenantContext()
        const formData = await request.formData()
        const projectIdRaw = String(formData.get("projectId") || "project")
        const projectId = sanitizeProjectNoteSegment(projectIdRaw).slice(0, 64)

        const files = formData
            .getAll("files")
            .filter((entry): entry is File => entry instanceof File)

        if (!files.length) {
            return NextResponse.json(
                { success: false, error: "No image provided." },
                { status: 400 }
            )
        }

        if (files.length > MAX_FILES_PER_REQUEST) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Too many files. Maximum ${MAX_FILES_PER_REQUEST} images per upload.`,
                },
                { status: 400 }
            )
        }

        const projectDirectory = resolveProjectNoteAbsolutePath(
            buildProjectNoteRelativePath(session.tenantId, projectId, "index")
        )
        await mkdir(path.dirname(projectDirectory), { recursive: true })

        const urls: string[] = []

        for (const file of files) {
            if (!file.type.startsWith("image/")) {
                return NextResponse.json(
                    { success: false, error: "Only image files are allowed." },
                    { status: 400 }
                )
            }

            if (file.size > MAX_FILE_SIZE_BYTES) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `File "${file.name}" exceeds 12MB size limit.`,
                    },
                    { status: 400 }
                )
            }

            const buffer = Buffer.from(await file.arrayBuffer())
            const extension = detectImageExtensionFromMagicBytes(buffer)
            if (!extension) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `File \"${file.name}\" is not a supported image format.`,
                    },
                    { status: 400 }
                )
            }

            const filename = `${Date.now()}-${randomUUID()}.${extension}`
            const relativePath = buildProjectNoteRelativePath(
                session.tenantId,
                projectId,
                filename
            )
            const absoluteFilePath = resolveProjectNoteAbsolutePath(relativePath)
            await writeFile(absoluteFilePath, buffer)

            urls.push(createSignedProjectNoteUrl(relativePath))
        }

        return NextResponse.json({ success: true, urls })
    } catch (error) {
        return apiRouteError(error, {
            unauthorizedMessage: "Unauthorized",
            unauthorizedCode: "AUTH_REQUIRED",
            fallbackMessage: "Upload failed.",
            fallbackCode: "PROJECT_NOTE_UPLOAD_FAILED",
            logLabel: "[project-notes/upload] failed",
        })
    }
}
