import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import prisma from "@/lib/prisma";

const execAsync = promisify(exec);

export async function GET() {
    let dbTest: string;
    try {
        const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        dbTest = "Tables in connected DB: " + tables.map((r: any) => r.name).join(", ");
    } catch (e: any) {
        dbTest = "DB Error: " + e.message;
    }

    let dbFilePath = "unknown";
    try {
        // Get the actual file path of the connected DB
        const result = await prisma.$queryRawUnsafe<any[]>("PRAGMA database_list");
        dbFilePath = JSON.stringify(result);
    } catch (e: any) {
        dbFilePath = "PRAGMA error: " + e.message;
    }

    return new NextResponse(
        "DATABASE_URL env: " + (process.env.DATABASE_URL || "not set") + "\n\n" +
        dbTest + "\n\n" +
        "DB file path (PRAGMA): " + dbFilePath,
        { headers: { "Content-Type": "text/plain" } }
    );
}
