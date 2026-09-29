import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

const SiteIdSchema = z.string().uuid()

export async function GET(
    request: Request,
    { params }: { params: Promise<{ siteId: string }> }
) {
    try {
        await requireAuth()
        const { siteId } = await params
        const validatedSiteId = SiteIdSchema.parse(siteId)
        const site = await prisma.site.findFirst({
            where: { id: validatedSiteId },
            select: {
                faviconData: true,
                faviconMimeType: true,
                faviconHash: true,
            },
        })

        if (!site?.faviconData || !site.faviconMimeType) {
            return new NextResponse(null, {
                status: 404,
                headers: { "Cache-Control": "private, no-store" },
            })
        }

        const etag = site.faviconHash ? `"${site.faviconHash}"` : null
        if (etag && request.headers.get("if-none-match") === etag) {
            return new NextResponse(null, {
                status: 304,
                headers: {
                    ETag: etag,
                    "Cache-Control": "private, max-age=31536000, immutable",
                },
            })
        }

        return new NextResponse(new Uint8Array(site.faviconData), {
            headers: {
                "Content-Type": site.faviconMimeType,
                "Content-Length": String(site.faviconData.byteLength),
                "Cache-Control": "private, max-age=31536000, immutable",
                ...(etag ? { ETag: etag } : {}),
            },
        })
    } catch {
        return new NextResponse(null, { status: 404 })
    }
}
