import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET(request: Request) {
    try {
        const { stdout, stderr } = await execAsync("npx pm2 logs --lines 500 --nostream");
        return new NextResponse(stdout + "\n--- STDERR ---\n" + stderr, {
            headers: { "Content-Type": "text/plain" },
        });
    } catch (e: any) {
        return new NextResponse("Error: " + e.message, { status: 500 });
    }
}
