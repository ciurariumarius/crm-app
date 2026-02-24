"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { createSession, destroySession, getSession, encrypt, decrypt } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limit"
import bcrypt from "bcryptjs"
import * as OTPAuth from "otpauth"

export async function loginUser(formData: FormData) {
    const data = Object.fromEntries(formData.entries())
    const username = data.username as string
    const password = data.password as string

    if (!username || !password) {
        return { success: false, error: "Username and password required" }
    }

    const rl = checkRateLimit(`login:${username}`)
    if (!rl.allowed) {
        return { success: false, error: "Too many login attempts. Please try again later." }
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } })
        if (!user) {
            return { success: false, error: "Invalid credentials" }
        }

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) {
            return { success: false, error: "Invalid credentials" }
        }

        if (user.twoFactorEnabled) {
            const challengeToken = await encrypt({
                userId: user.id,
                purpose: "2fa_challenge",
                exp: Math.floor(Date.now() / 1000) + 300,
            })
            return { success: true, requiresTwoFactor: true, challengeToken }
        }

        await createSession(user.id, user.username, true)
        return { success: true }

    } catch {
        return { success: false, error: "Login failed" }
    }
}

export async function verifyTwoFactor(challengeToken: string, token: string) {
    try {
        const challenge = await decrypt(challengeToken)
        if (!challenge || challenge.purpose !== "2fa_challenge") {
            return { success: false, error: "Invalid or expired challenge" }
        }

        if (challenge.exp && challenge.exp < Math.floor(Date.now() / 1000)) {
            return { success: false, error: "Challenge expired. Please log in again." }
        }

        const userId = challenge.userId as string

        const rl = checkRateLimit(`2fa:${userId}`)
        if (!rl.allowed) {
            return { success: false, error: "Too many verification attempts. Please try again later." }
        }

        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user || !user.twoFactorSecret) {
            return { success: false, error: "Invalid user or 2FA not set up" }
        }

        const totp = new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
            algorithm: "SHA1",
            digits: 6,
            period: 30,
        })
        const delta = totp.validate({ token, window: 1 })

        if (delta === null) {
            return { success: false, error: "Invalid authenticator code" }
        }

        await createSession(user.id, user.username, true)
        return { success: true }
    } catch {
        return { success: false, error: "Verification failed" }
    }
}

export async function logoutUser() {
    await destroySession()
    return { success: true }
}

export async function changePassword(formData: FormData) {
    const session = await getSession();
    if (!session) return { success: false, error: "Unauthorized" };

    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;

    if (!newPassword || newPassword.length < 8) {
        return { success: false, error: "New password must be at least 8 characters long" };
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return { success: false, error: "User not found" };

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) return { success: false, error: "Incorrect current password" };

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
    });

    return { success: true };
}

export async function generateTwoFactorSecret() {
    const session = await getSession();
    if (!session) return { success: false, error: "Unauthorized" };

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return { success: false, error: "User not found" };

    const secret = new OTPAuth.Secret();
    const totp = new OTPAuth.TOTP({
        issuer: "Pixelist",
        label: user.username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret,
    });

    return { success: true, secret: secret.base32, otpauth: totp.toString() };
}

export async function enableTwoFactor(token: string, secret: string) {
    const session = await getSession();
    if (!session) return { success: false, error: "Unauthorized" };

    const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(secret),
        algorithm: "SHA1",
        digits: 6,
        period: 30,
    });
    const delta = totp.validate({ token, window: 1 });
    if (delta === null) return { success: false, error: "Invalid code" };

    await prisma.user.update({
        where: { id: session.userId },
        data: { twoFactorEnabled: true, twoFactorSecret: secret }
    });

    return { success: true };
}

export async function disableTwoFactor() {
    const session = await getSession();
    if (!session) return { success: false, error: "Unauthorized" };

    await prisma.user.update({
        where: { id: session.userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null }
    });

    return { success: true };
}

export async function updateProfile(formData: FormData) {
    try {
        const session = await getSession();
        if (!session) return { success: false, error: "Unauthorized" };

        const name = formData.get("name") as string;
        const profilePic = formData.get("profilePic") as string;

        await prisma.user.update({
            where: { id: session.userId },
            data: {
                name: name || null,
                profilePic: profilePic || null
            }
        });

        revalidatePath("/");
        revalidatePath("/settings");
        return { success: true };
    } catch {
        return { success: false, error: "Failed to update profile" }
    }
}
