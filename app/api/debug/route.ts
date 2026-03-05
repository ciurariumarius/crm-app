import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    let debugInfo = "";

    try {
        const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        debugInfo += "Tables: " + tables.map((r: any) => r.name).join(", ") + "\n\n";

        // Check columns in users
        const usersInfo = await prisma.$queryRawUnsafe<any[]>("PRAGMA table_info(users)");
        debugInfo += "Users columns: " + usersInfo.map(c => c.name).join(", ") + "\n\n";

        // Check columns in tasks
        const tasksInfo = await prisma.$queryRawUnsafe<any[]>("PRAGMA table_info(tasks)");
        debugInfo += "Tasks columns: " + tasksInfo.map(c => c.name).join(", ") + "\n\n";

        // Check columns in projects
        const projectsInfo = await prisma.$queryRawUnsafe<any[]>("PRAGMA table_info(projects)");
        debugInfo += "Projects columns: " + projectsInfo.map(c => c.name).join(", ") + "\n\n";

        const userCount = await prisma.$queryRawUnsafe<any[]>("SELECT COUNT(*) as count FROM users");
        debugInfo += "User count in DB: " + userCount[0].count + "\n\n";

    } catch (e: any) {
        debugInfo += "DB Error: " + e.message + "\n\n";
    }

    return new NextResponse(
        "DATABASE_URL: " + (process.env.DATABASE_URL || "not set") + "\n\n" +
        debugInfo,
        { headers: { "Content-Type": "text/plain" } }
    );
}
