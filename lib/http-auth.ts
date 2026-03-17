import { timingSafeEqual } from "node:crypto"

export function safeCompare(input: string, expected: string) {
    const inputBuffer = Buffer.from(input)
    const expectedBuffer = Buffer.from(expected)
    if (inputBuffer.length !== expectedBuffer.length) {
        return false
    }
    return timingSafeEqual(inputBuffer, expectedBuffer)
}

export function matchesBearerOrHeaderSecret(
    request: Request,
    secret: string,
    headerName: string
) {
    const authHeader = request.headers.get("authorization") || ""
    const headerSecret = request.headers.get(headerName) || ""
    return (
        safeCompare(authHeader, `Bearer ${secret}`) ||
        safeCompare(headerSecret, secret)
    )
}
