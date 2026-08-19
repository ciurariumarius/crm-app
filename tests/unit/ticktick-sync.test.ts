import { describe, it, expect, beforeEach } from "vitest"
import { generateOAuthState, verifyOAuthState, extractUserIdFromOAuthState } from "@/lib/integrations/ticktick/auth"
import { formatTickTickTaskPayload } from "@/lib/integrations/ticktick/sync"
import { TickTickApiError } from "@/lib/integrations/ticktick/client"
import { encryptSensitiveValue, decryptSensitiveValue } from "@/lib/crypto"

describe("TickTick Integration Tests", () => {
    beforeEach(() => {
        process.env.JWT_SECRET = "test-jwt-secret-key-32b-length-must-be-long"
        process.env.DATA_ENCRYPTION_KEYS = "k1=0000000000000000000000000000000000000000000000000000000000000000"
        process.env.DATA_ENCRYPTION_KEY_ID = "k1"
    })

    describe("OAuth State Security", () => {
        it("generates and verifies valid OAuth state for the given user", () => {
            const userId = "user-12345"
            const state = generateOAuthState(userId)
            expect(state).toBeTruthy()
            expect(typeof state).toBe("string")

            const isValid = verifyOAuthState(state, userId)
            expect(isValid).toBe(true)
        })

        it("rejects state when verified against a different user", () => {
            const userId = "user-12345"
            const wrongUserId = "user-99999"
            const state = generateOAuthState(userId)

            const isValid = verifyOAuthState(state, wrongUserId)
            expect(isValid).toBe(false)
        })

        it("rejects tampered state payload", () => {
            const userId = "user-12345"
            const state = generateOAuthState(userId)
            const tampered = state.substring(0, state.length - 4) + "XXXX"

            const isValid = verifyOAuthState(tampered, userId)
            expect(isValid).toBe(false)
        })

        it("rejects garbage state strings", () => {
            expect(verifyOAuthState("not-a-real-state", "user-1")).toBe(false)
            expect(verifyOAuthState("", "user-1")).toBe(false)
        })

        it("extracts valid user ID from signed state", () => {
            const userId = "user-12345"
            const state = generateOAuthState(userId)
            expect(extractUserIdFromOAuthState(state)).toBe(userId)
        })

        it("returns null for tampered or garbage state in extractUserIdFromOAuthState", () => {
            expect(extractUserIdFromOAuthState("not-a-real-state")).toBeNull()
            expect(extractUserIdFromOAuthState("")).toBeNull()
        })
    })

    describe("TickTick API Error Classification", () => {
        it("flags HTTP 401 as an auth error requiring reconnection", () => {
            const error = new TickTickApiError("Unauthorized", 401, "UNAUTHORIZED", true)
            expect(error.status).toBe(401)
            expect(error.isAuthError).toBe(true)
            expect(error.name).toBe("TickTickApiError")
        })

        it("does not flag regular HTTP 500 or 429 as auth errors", () => {
            const serverError = new TickTickApiError("Internal Server Error", 500)
            expect(serverError.status).toBe(500)
            expect(serverError.isAuthError).toBe(false)

            const rateLimitError = new TickTickApiError("Too many requests", 429)
            expect(rateLimitError.status).toBe(429)
            expect(rateLimitError.isAuthError).toBe(false)
        })
    })

    describe("Token Encryption & Decryption", () => {
        it("encrypts and decrypts OAuth access tokens safely", () => {
            const rawToken = "ticktick_oauth_access_token_secret_xyz123"
            const encrypted = encryptSensitiveValue(rawToken)

            expect(encrypted).not.toBe(rawToken)
            expect(encrypted.startsWith("enc:")).toBe(true)

            const decrypted = decryptSensitiveValue(encrypted)
            expect(decrypted).toBe(rawToken)
        })
    })

    describe("TickTick Task Payload Formatting", () => {
        it("formats freelance task with site prefix in title and services + recurring month in description", () => {
            const payload = formatTickTickTaskPayload({
                name: "Update Homepage Hero",
                description: "Change banner image and headline",
                taskScope: "FREELANCE",
                project: {
                    name: "Taco Loco",
                    site: { domainName: "tacoloco.ro" },
                    services: [
                        { serviceName: "DEV", isRecurring: true },
                        { serviceName: "Mentenanță", isRecurring: true },
                    ],
                    createdAt: "2026-08-01T00:00:00.000Z",
                },
            })

            expect(payload.title).toBe("[tacoloco.ro] - Update Homepage Hero")
            expect(payload.content).toContain("DEV, Mentenanță - August 2026")
            expect(payload.content).toContain("Change banner image and headline")
        })

        it("formats LMS task with client in title and category in description", () => {
            const payload = formatTickTickTaskPayload({
                name: "Monthly report review",
                taskScope: "LMS",
                lmsAllocation: { client: "LMS Client Alpha" },
                lmsTaskType: { name: "Reporting" },
            })

            expect(payload.title).toBe("[LMS Client Alpha] - Monthly report review")
            expect(payload.content).toBe("LMS: Reporting")
        })

        it("formats general task without site prefix", () => {
            const payload = formatTickTickTaskPayload({
                name: "Renew domain license",
                taskScope: "GENERAL",
            })

            expect(payload.title).toBe("Renew domain license")
            expect(payload.content).toBeUndefined()
        })
    })
})
