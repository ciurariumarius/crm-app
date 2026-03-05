import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    let debugInfo: any = {};

    try {
        const tables: any[] = await prisma.$queryRawUnsafe(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        debugInfo.tables = tables.map(r => r.name);

        const projsInfo = await prisma.$queryRawUnsafe<any[]>("PRAGMA table_info(projects)");
        debugInfo.projects_columns = projsInfo.map(c => `${c.name} (${c.type})`);

        const tasksInfo = await prisma.$queryRawUnsafe<any[]>("PRAGMA table_info(tasks)");
        debugInfo.tasks_columns = tasksInfo.map(c => `${c.name} (${c.type})`);

        const userCount: any[] = await prisma.$queryRawUnsafe("SELECT COUNT(*) as count FROM users");
        debugInfo.user_count = userCount[0].count;

    } catch (e: any) {
        debugInfo.error = e.message;
    }

    const responseText = JSON.stringify(debugInfo, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
        2
    );

    return new NextResponse(
        responseText,
        { headers: { "Content-Type": "application/json" } }
    );
}
