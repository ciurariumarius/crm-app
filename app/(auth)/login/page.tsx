"use client"

import { useState } from "react"
import { loginUser, verifyTwoFactor } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, User, ShieldCheck, Eye, EyeOff, Zap } from "lucide-react"

export default function LoginPage() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // 2FA State
    const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
    const [challengeToken, setChallengeToken] = useState("")
    const [token, setToken] = useState("")
    const [showLoginPassword, setShowLoginPassword] = useState(false)
    const [rememberDevice, setRememberDevice] = useState(true)

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const formData = new FormData(e.currentTarget)
            const result = await loginUser(formData)

            if (result.success) {
                if (result.requiresTwoFactor) {
                    setRequiresTwoFactor(true)
                    setChallengeToken(result.challengeToken!)
                    setLoading(false)
                } else {
                    window.location.href = "/"
                }
            } else {
                setError(result.error || "Login failed")
                setLoading(false)
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "An unexpected server error occurred."
            setError(message)
            setLoading(false)
        }
    }

    const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const result = await verifyTwoFactor(challengeToken, token)

        if (result.success) {
            window.location.href = "/"
        } else {
            setError(result.error || "Invalid code")
            setLoading(false)
        }
    }

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--bg-canvas)] p-4 md:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--brand-primary)_14%,transparent),transparent_66%)]" />

            <div className="z-10 w-full max-w-[420px]">
                <div className="mb-8 flex flex-col items-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--brand-primary)] text-white shadow-[var(--shadow-apple)]">
                        <Zap className="h-6 w-6 fill-current" />
                    </div>
                    <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-foreground">Pixelist</h1>
                    <p className="mt-2 text-sm font-medium text-muted-foreground">Authorized access only</p>
                </div>

                <div className="rounded-[20px] border border-border bg-card p-6 shadow-[var(--shadow-shell)] sm:p-8">
                    {requiresTwoFactor ? (
                        <form onSubmit={handleVerify} className="space-y-6">
                            <div className="flex justify-center mb-6">
                                <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[var(--sidebar-accent)] text-primary">
                                    <ShieldCheck className="h-8 w-8" />
                                </div>
                            </div>
                            <div className="space-y-2 text-center mb-6">
                                <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
                                <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
                            </div>

                            {error && (
                                <div className="rounded-[12px] border border-rose-500/20 bg-rose-500/10 p-3 text-center text-xs font-semibold text-rose-500">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground">Auth Code</Label>
                                <Input
                                    type="text"
                                    placeholder="000 000"
                                    className="h-12 bg-background text-center font-mono text-xl tracking-widest"
                                    maxLength={6}
                                    value={token}
                                    onChange={(e) => setToken(e.target.value.replace(/[^0-9]/g, ""))}
                                    required
                                    autoFocus
                                />
                            </div>

                            <Button type="submit" className="mt-4 h-12 w-full" disabled={loading}>
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Identity"}
                            </Button>

                            <button
                                type="button"
                                className="w-full text-center text-xs text-muted-foreground mt-4 hover:text-foreground transition-colors"
                                onClick={() => {
                                    setRequiresTwoFactor(false)
                                    setToken("")
                                    setError("")
                                }}
                            >
                                Back to Login
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleLogin} method="post" className="space-y-6">
                            {error && (
                                <div className="rounded-[12px] border border-rose-500/20 bg-rose-500/10 p-3 text-center text-xs font-semibold text-rose-500">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground">Username</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                    <Input
                                        name="username"
                                        placeholder="admin"
                                        className="h-12 bg-background pl-10"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                    <Input
                                        name="password"
                                        type={showLoginPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        className="h-12 bg-background pl-10 pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowLoginPassword((value) => !value)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
                                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                                    >
                                        {showLoginPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                                <input
                                    name="rememberDevice"
                                    value="true"
                                    type="checkbox"
                                    checked={rememberDevice}
                                    onChange={(event) => setRememberDevice(event.target.checked)}
                                    className="h-4 w-4 rounded border-border"
                                />
                                Keep me signed in on this device
                            </label>

                            <Button type="submit" className="mt-4 h-12 w-full" disabled={loading}>
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
                            </Button>
                            <p className="text-xs text-center text-muted-foreground mt-2">
                                Forgot password? Contact your administrator.
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
