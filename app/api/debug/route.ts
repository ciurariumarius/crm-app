import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET(request: Request) {
    try {
        const { stdout: stdout1, stderr: stderr1 } = await execAsync("npx pm2 status");
        const { stdout: stdout2, stderr: stderr2 } = await execAsync("which pm2");
        return new NextResponse("npx pm2 status:\n" + stdout1 + stderr1 + "\n\nwhich pm2:\n" + stdout2 + stderr2, {
            headers: { "Content-Type": "text/plain" },
        });
    } catch (e: any) {
        return new NextResponse("Error: " + e.message, { status: 500 });
    }
}
