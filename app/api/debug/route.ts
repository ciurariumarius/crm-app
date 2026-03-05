import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import prisma from "@/lib/prisma";

const execAsync = promisify(exec);

export async function GET(request: Request) {
    let dbTest: string;
    try {
        const tables = await prisma.$queryRawUnsafe<{name:string}[]>(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        dbTest = "Tables: " + tables.map((r: any) => r.name).join(", ");
    } catch (e: any) {
        dbTest = "DB Error: " + e.message;
    }

    try {
        const { stdout: path } = await execAsync("which pm2");
        return new NextResponse(dbTest + "\nPM2 Path: " + path, {
            headers: { "Content-Type": "text/plain" },
        });
    } catch (e: any) {
        return new NextResponse(dbTest, {
            headers: { "Content-Type": "text/plain" },
        });
    }
}
