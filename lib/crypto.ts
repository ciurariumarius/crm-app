import { createCipheriv, createDecipheriv, randomBytes } from "crypto"
import { readFileSync } from "fs"

const ENCRYPTION_PREFIX = "enc"
const LEGACY_VERSION = "v1"
const KEYED_VERSION = "v2"
const DEFAULT_KEY_ID = "default"
const PRODUCTION_ENCRYPTION_STRICT_DEFAULT = true

type KeyedConfigSource = "none" | "env" | "file"

type CryptoKeyState = {
    activeKeyId: string
    keys: Map<string, Buffer>
    legacyKey: Buffer | null
    keyedConfigSource: KeyedConfigSource
    keyedConfigEnabled: boolean
    strictProductionPolicyEnabled: boolean
}

let cachedState: CryptoKeyState | null = null

function normalizeBase64(raw: string): string {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/")
    const remainder = normalized.length % 4
    return remainder === 0 ? normalized : `${normalized}${"=".repeat(4 - remainder)}`
}

function parseKey(rawKey: string): Buffer {
    const trimmed = rawKey.trim()

    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return Buffer.from(trimmed, "hex")
    }

    return Buffer.from(normalizeBase64(trimmed), "base64")
}

function parseAndValidateKey(rawKey: string, source: string): Buffer {
    const key = parseKey(rawKey)
    if (key.length !== 32) {
        throw new Error(`${source} must decode to exactly 32 bytes`)
    }
    return key
}

function parseKeyEntries(raw: string): Map<string, Buffer> {
    const entries = raw
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    const keyMap = new Map<string, Buffer>()

    for (const entry of entries) {
        const separator = entry.includes("=") ? "=" : ":"
        const idx = entry.indexOf(separator)
        if (idx <= 0) {
            throw new Error("DATA_ENCRYPTION_KEYS entries must use keyId=key format")
        }

        const keyId = entry.slice(0, idx).trim()
        const rawKey = entry.slice(idx + 1).trim()
        if (!keyId || !rawKey) {
            throw new Error("DATA_ENCRYPTION_KEYS contains an invalid empty keyId or key")
        }

        if (keyMap.has(keyId)) {
            throw new Error(`Duplicate DATA_ENCRYPTION_KEYS key id "${keyId}"`)
        }

        keyMap.set(keyId, parseAndValidateKey(rawKey, `DATA_ENCRYPTION_KEYS(${keyId})`))
    }

    return keyMap
}

function readOptionalSecretFile(
    filePath: string | undefined,
    envName: string
): string | null {
    const normalizedPath = filePath?.trim()
    if (!normalizedPath) return null
    try {
        const contents = readFileSync(normalizedPath, "utf8").trim()
        if (!contents) {
            throw new Error(`${envName} points to an empty file`)
        }
        return contents
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown file read error"
        throw new Error(`Failed to read ${envName} file "${normalizedPath}": ${message}`)
    }
}

function resolveKeyedConfigValue() {
    const fromFile = readOptionalSecretFile(
        process.env.DATA_ENCRYPTION_KEYS_FILE,
        "DATA_ENCRYPTION_KEYS_FILE"
    )
    const fromEnv = process.env.DATA_ENCRYPTION_KEYS?.trim() || null

    if (fromFile && fromEnv) {
        throw new Error(
            "Both DATA_ENCRYPTION_KEYS and DATA_ENCRYPTION_KEYS_FILE are set. Use only one source."
        )
    }

    if (fromFile) return { value: fromFile, source: "file" as const }
    if (fromEnv) return { value: fromEnv, source: "env" as const }
    return { value: null, source: "none" as const }
}

function resolveLegacyKeyValue() {
    const fromFile = readOptionalSecretFile(
        process.env.DATA_ENCRYPTION_KEY_FILE,
        "DATA_ENCRYPTION_KEY_FILE"
    )
    const fromEnv = process.env.DATA_ENCRYPTION_KEY?.trim() || null

    if (fromFile && fromEnv) {
        throw new Error(
            "Both DATA_ENCRYPTION_KEY and DATA_ENCRYPTION_KEY_FILE are set. Use only one source."
        )
    }

    return fromFile ?? fromEnv
}

function isStrictProductionEncryptionPolicyEnabled() {
    const strictValue = process.env.DATA_ENCRYPTION_STRICT_PRODUCTION
    if (strictValue == null) return PRODUCTION_ENCRYPTION_STRICT_DEFAULT
    return strictValue.trim().toLowerCase() !== "false"
}

function enforceProductionEncryptionPolicy(args: {
    keyedConfigEnabled: boolean
    activeKeyIdConfigured: boolean
}) {
    if (process.env.NODE_ENV !== "production") return
    if (!isStrictProductionEncryptionPolicyEnabled()) return

    if (!args.keyedConfigEnabled) {
        throw new Error(
            "Production encryption policy requires DATA_ENCRYPTION_KEYS (or DATA_ENCRYPTION_KEYS_FILE). DATA_ENCRYPTION_KEY alone is not allowed."
        )
    }

    if (!args.activeKeyIdConfigured) {
        throw new Error(
            "Production encryption policy requires DATA_ENCRYPTION_KEY_ID for explicit active key selection."
        )
    }
}

function getEncryptionState(): CryptoKeyState {
    if (cachedState) return cachedState

    const keys = new Map<string, Buffer>()
    const keyedConfig = resolveKeyedConfigValue()
    const keyedRaw = keyedConfig.value
    const rawKey = resolveLegacyKeyValue()
    const legacyKey = rawKey ? parseAndValidateKey(rawKey, "DATA_ENCRYPTION_KEY") : null
    const configuredActiveKeyId = process.env.DATA_ENCRYPTION_KEY_ID?.trim()

    enforceProductionEncryptionPolicy({
        keyedConfigEnabled: Boolean(keyedRaw),
        activeKeyIdConfigured: Boolean(configuredActiveKeyId),
    })

    if (keyedRaw) {
        for (const [keyId, key] of parseKeyEntries(keyedRaw).entries()) {
            keys.set(keyId, key)
        }
    }

    if (keys.size === 0 && legacyKey) {
        keys.set(DEFAULT_KEY_ID, legacyKey)
    }

    if (keys.size === 0) {
        throw new Error("Missing DATA_ENCRYPTION_KEY or DATA_ENCRYPTION_KEYS environment variable")
    }

    const activeKeyId = configuredActiveKeyId || keys.keys().next().value

    if (!activeKeyId || !keys.has(activeKeyId)) {
        throw new Error("DATA_ENCRYPTION_KEY_ID is not present in DATA_ENCRYPTION_KEYS")
    }

    cachedState = {
        activeKeyId,
        keys,
        legacyKey,
        keyedConfigSource: keyedConfig.source,
        keyedConfigEnabled: Boolean(keyedRaw),
        strictProductionPolicyEnabled: isStrictProductionEncryptionPolicyEnabled(),
    }
    return cachedState
}

export function getEncryptionConfigSummary() {
    const state = getEncryptionState()
    return {
        activeKeyId: state.activeKeyId,
        keyIds: Array.from(state.keys.keys()),
        keyedConfigEnabled: state.keyedConfigEnabled,
        keyedConfigSource: state.keyedConfigSource,
        legacyKeyConfigured: Boolean(state.legacyKey),
        strictProductionPolicyEnabled: state.strictProductionPolicyEnabled,
    }
}

export function isEncryptedValue(value: string): boolean {
    return value.startsWith(`${ENCRYPTION_PREFIX}:`)
}

function encryptWithKey(key: Buffer, plaintext: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()

    return {
        iv: iv.toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
        tag: tag.toString("base64url"),
    }
}

function decryptWithKey(key: Buffer, ivEncoded: string, ciphertextEncoded: string, tagEncoded: string) {
    const iv = Buffer.from(ivEncoded, "base64url")
    const ciphertext = Buffer.from(ciphertextEncoded, "base64url")
    const tag = Buffer.from(tagEncoded, "base64url")

    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString("utf8")
}

export function encryptSensitiveValue(plaintext: string): string {
    const state = getEncryptionState()
    const activeKey = state.keys.get(state.activeKeyId)
    if (!activeKey) {
        throw new Error("Active encryption key not available")
    }

    const encrypted = encryptWithKey(activeKey, plaintext)

    return [
        ENCRYPTION_PREFIX,
        KEYED_VERSION,
        state.activeKeyId,
        encrypted.iv,
        encrypted.ciphertext,
        encrypted.tag,
    ].join(":")
}

export function decryptSensitiveValue(value: string): string {
    if (!isEncryptedValue(value)) {
        // Legacy plaintext values are accepted for backward compatibility.
        return value
    }

    const state = getEncryptionState()
    const parts = value.split(":")
    const [, version] = parts

    if (version === LEGACY_VERSION) {
        const [, , ivEncoded, ciphertextEncoded, tagEncoded] = parts
        if (!ivEncoded || !ciphertextEncoded || !tagEncoded) {
            throw new Error("Invalid encrypted value format")
        }

        const legacyDecryptKey = state.legacyKey ?? state.keys.get(state.activeKeyId)
        if (!legacyDecryptKey) {
            throw new Error("No key available for legacy encrypted value")
        }
        return decryptWithKey(legacyDecryptKey, ivEncoded, ciphertextEncoded, tagEncoded)
    }

    if (version === KEYED_VERSION) {
        const [, , keyId, ivEncoded, ciphertextEncoded, tagEncoded] = parts
        if (!keyId || !ivEncoded || !ciphertextEncoded || !tagEncoded) {
            throw new Error("Invalid encrypted value format")
        }

        const key = state.keys.get(keyId)
        if (!key) {
            throw new Error(`Missing decryption key for key id "${keyId}"`)
        }
        return decryptWithKey(key, ivEncoded, ciphertextEncoded, tagEncoded)
    }

    throw new Error("Invalid encrypted value format")
}

export function shouldRotateSensitiveValue(value: string): boolean {
    if (!isEncryptedValue(value)) {
        return true
    }

    const state = getEncryptionState()
    const parts = value.split(":")
    const [, version] = parts

    if (version === LEGACY_VERSION) {
        return true
    }

    if (version === KEYED_VERSION) {
        const [, , keyId] = parts
        return keyId !== state.activeKeyId
    }

    return true
}
