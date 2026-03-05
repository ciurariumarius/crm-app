import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    let debugInfo = "";

    try {
        const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        debugInfo += "Tables: " + tables.map((r: any) => r.name).join(", ") + "\n\n";

        const userSchema = await prisma.$queryRawUnsafe<any[]>("PRAGMA table_info(users)");
        debugInfo += "Users table columns: " + userSchema.map(c => c.name).join(", ") + "\n\n";

        const auditSchema = await prisma.$queryRawUnsafe<any[]>("PRAGMA table_info(audit_logs)");
        debugInfo += "Audit logs columns: " + auditSchema.map(c => c.name).join(", ") + "\n\n";

        const userCount = await prisma.$queryRawUnsafe<any[]>("SELECT COUNT(*) as count FROM users");
        debugInfo += "User count: " + userCount[0].count + "\n\n";

    } catch (e: any) {
        debugInfo += "DB Error: " + e.message + "\n\n";
    }

    return new NextResponse(
        "DATABASE_URL env: " + (process.env.DATABASE_URL || "not set") + "\n\n" +
        debugInfo,
        { headers: { "Content-Type": "text/plain" } }
    );
}
