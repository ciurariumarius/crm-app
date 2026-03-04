import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { JWTPayload } from "jose";

const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
    throw new Error("FATAL: JWT_SECRET environment variable is not set. The application cannot start without it.");
}
const key = new TextEncoder().encode(secretKey);

export const SESSION_COOKIE_NAME = "crm_session";

export type SessionPayload = JWTPayload & {
    userId: string;
    username: string;
    tenantId: string;
    twoFactorVerified: boolean;
    expires?: Date;
};

export async function encrypt(payload: JWTPayload) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(key);
}

export async function decrypt<T = JWTPayload>(input: string): Promise<T | null> {
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ["HS256"],
        });
        return payload as T;
    } catch {
        return null;
    }
}

export async function createSession(userId: string, username: string, tenantId: string, twoFactorVerified: boolean = false) {
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const session = await encrypt({ userId, username, tenantId, twoFactorVerified, expires });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session, {
        expires,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
    });
}

export async function getSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return null;
    return await decrypt<SessionPayload>(sessionCookie);
}

export async function updateSession(request: NextRequest) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return null;

    const parsed = await decrypt<SessionPayload>(sessionCookie);
    if (!parsed) return null;

    parsed.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // refresh 7 days
    const res = NextResponse.next();
    res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: await encrypt(parsed),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        expires: parsed.expires,
        path: "/",
    });
    return res;
}

export async function destroySession() {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, "", {
        expires: new Date(0),
        path: "/",
    });
}

export async function requireAuth() {
    const session = await getSession();
    if (!session || !session.userId || !session.tenantId) {
        throw new Error("Unauthorized");
    }
    return session;
}
