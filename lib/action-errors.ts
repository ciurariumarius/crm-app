import { ZodError } from "zod"

export class ActionError extends Error {
    code: string
    userMessage: string

    constructor(code: string, userMessage: string) {
        super(userMessage)
        this.name = "ActionError"
        this.code = code
        this.userMessage = userMessage
    }
}

export function getActionErrorMessage(error: unknown, fallback: string) {
    if (error instanceof ZodError) {
        return error.issues[0]?.message ?? "Invalid request data"
    }
    if (error instanceof ActionError) {
        return error.userMessage
    }
    return fallback
}
