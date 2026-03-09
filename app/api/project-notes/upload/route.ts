import { NextResponse } from "next/server"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { requireTenantContext } from "@/lib/tenant"

export const runtime = "nodejs"

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024
const MAX_FILES_PER_REQUEST = 8

const EXTENSIONS_BY_MIME: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}

function sanitizeSegment(input: string) {
    const normalized = input.trim().replace(/[^a-zA-Z0-9_-]/g, "")
    return normalized || "project"
}

export async function POST(request: Request) {
    try {
        const session = await requireTenantContext()
        const formData = await request.formData()
        const projectIdRaw = String(formData.get("projectId") || "project")
        const projectId = sanitizeSegment(projectIdRaw).slice(0, 64)

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

        const uploadDirectory = path.join(
            process.cwd(),
            "public",
            "uploads",
            "project-notes",
            session.tenantId,
            projectId
        )
        await mkdir(uploadDirectory, { recursive: true })

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
            const absoluteFilePath = path.join(uploadDirectory, filename)
            const buffer = Buffer.from(await file.arrayBuffer())
            await writeFile(absoluteFilePath, buffer)

            urls.push(
                `/uploads/project-notes/${session.tenantId}/${projectId}/${filename}`
            )
        }

        return NextResponse.json({ success: true, urls })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed."
        const status = message === "Unauthorized" ? 401 : 500
        return NextResponse.json({ success: false, error: message }, { status })
    }
}
