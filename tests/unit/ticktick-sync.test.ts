import { describe, it, expect, beforeEach } from "vitest"
import { generateOAuthState, verifyOAuthState, extractUserIdFromOAuthState } from "@/lib/integrations/ticktick/auth"
import {
    formatTickTickTaskPayload,
    parseTickTickTaskTitleAndStatus,
    TICKTICK_PENDING_ICON,
    TICKTICK_PENDING_TAG,
} from "@/lib/integrations/ticktick/sync"
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
            expect(payload.tags).toBeUndefined()
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
            expect(payload.tags).toBeUndefined()
        })

        it("formats general task without site prefix", () => {
            const payload = formatTickTickTaskPayload({
                name: "Renew domain license",
                taskScope: "GENERAL",
            })

            expect(payload.title).toBe("Renew domain license")
            expect(payload.content).toBeUndefined()
            expect(payload.tags).toBeUndefined()
        })

        it("prepends pause icon and adds pending tag when task status is Pending", () => {
            const payload = formatTickTickTaskPayload({
                name: "Fix navigation menu",
                status: "Pending",
                taskScope: "FREELANCE",
                project: {
                    name: "Taco Loco",
                    site: { domainName: "tacoloco.ro" },
                },
            })

            expect(payload.title).toBe(`${TICKTICK_PENDING_ICON} [tacoloco.ro] - Fix navigation menu`)
            expect(payload.tags).toEqual([TICKTICK_PENDING_TAG])
        })

        it("prepends pause icon for Paused legacy status", () => {
            const payload = formatTickTickTaskPayload({
                name: "Internal task",
                status: "Paused",
                taskScope: "GENERAL",
            })

            expect(payload.title).toBe(`${TICKTICK_PENDING_ICON} Internal task`)
            expect(payload.tags).toEqual([TICKTICK_PENDING_TAG])
        })
    })

    describe("TickTick Task Title & Pending Status Parsing", () => {
        it("detects ⏸️ icon and extracts clean task title", () => {
            const result = parseTickTickTaskTitleAndStatus("⏸️ [tacoloco.ro] - Fix header")
            expect(result.isPending).toBe(true)
            expect(result.cleanTitle).toBe("[tacoloco.ro] - Fix header")
        })

        it("detects ⏳ icon and extracts clean task title", () => {
            const result = parseTickTickTaskTitleAndStatus("⏳ [tacoloco.ro] - Fix header")
            expect(result.isPending).toBe(true)
            expect(result.cleanTitle).toBe("[tacoloco.ro] - Fix header")
        })

        it("detects 🟡 icon and extracts clean task title", () => {
            const result = parseTickTickTaskTitleAndStatus("🟡 [tacoloco.ro] - Fix header")
            expect(result.isPending).toBe(true)
            expect(result.cleanTitle).toBe("[tacoloco.ro] - Fix header")
        })

        it("detects (P) and [P] text markers and extracts clean title", () => {
            const prefixP = parseTickTickTaskTitleAndStatus("(P) [site.com] - Do work")
            expect(prefixP.isPending).toBe(true)
            expect(prefixP.cleanTitle).toBe("[site.com] - Do work")

            const bracketP = parseTickTickTaskTitleAndStatus("[P] [site.com] - Do work")
            expect(bracketP.isPending).toBe(true)
            expect(bracketP.cleanTitle).toBe("[site.com] - Do work")

            const suffixP = parseTickTickTaskTitleAndStatus("[site.com] - Do work (P)")
            expect(suffixP.isPending).toBe(true)
            expect(suffixP.cleanTitle).toBe("[site.com] - Do work")
        })

        it("detects pending from tags even if title has no icon", () => {
            const result = parseTickTickTaskTitleAndStatus("Regular task title", ["pending"])
            expect(result.isPending).toBe(true)
            expect(result.cleanTitle).toBe("Regular task title")
        })

        it("returns isPending false for normal titles without pending markers", () => {
            const result = parseTickTickTaskTitleAndStatus("[tacoloco.ro] - Active task title")
            expect(result.isPending).toBe(false)
            expect(result.cleanTitle).toBe("[tacoloco.ro] - Active task title")
        })
    })
})
