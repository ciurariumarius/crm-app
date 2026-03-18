import { NextResponse } from "next/server"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { requireTenantContext } from "@/lib/tenant"
import {
    buildProjectNoteRelativePath,
    createSignedProjectNoteUrl,
    resolveProjectNoteAbsolutePath,
    sanitizeProjectNoteSegment,
} from "@/lib/project-note-storage"

export const runtime = "nodejs"

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024
const MAX_FILES_PER_REQUEST = 8

const EXTENSIONS_BY_MIME: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
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

            const extension = EXTENSIONS_BY_MIME[file.type] || "png"
            const filename = `${Date.now()}-${randomUUID()}.${extension}`
            const relativePath = buildProjectNoteRelativePath(
                session.tenantId,
                projectId,
                filename
            )
            const absoluteFilePath = resolveProjectNoteAbsolutePath(relativePath)
            const buffer = Buffer.from(await file.arrayBuffer())
            await writeFile(absoluteFilePath, buffer)

            urls.push(createSignedProjectNoteUrl(relativePath))
        }

        return NextResponse.json({ success: true, urls })
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized") {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        console.error("[project-notes/upload] failed", error)
        return NextResponse.json({ success: false, error: "Upload failed." }, { status: 500 })
    }
}
