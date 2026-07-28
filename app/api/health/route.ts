import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

const headers = {
    "Cache-Control": "no-store, max-age=0",
}

export async function GET() {
    try {
        await prisma.$queryRaw`SELECT 1`
        return NextResponse.json({ status: "ok" }, { headers })
    } catch {
        return NextResponse.json(
            { status: "unavailable" },
            { status: 503, headers }
        )
    }
}
