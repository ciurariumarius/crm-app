import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        const logPath = "/home/populatia-crm/.pm2/logs/pixelist-crm-out.log";
        const errPath = "/home/populatia-crm/.pm2/logs/pixelist-crm-error.log";

        let outLogs = "";
        let errLogs = "";

        try { outLogs = fs.readFileSync(logPath, "utf-8").slice(-10000); } catch (e) { }
        try { errLogs = fs.readFileSync(errPath, "utf-8").slice(-10000); } catch (e) { }

        return NextResponse.json({ outLogs, errLogs });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
