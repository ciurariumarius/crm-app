"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { loginUser, verifyTwoFactor } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, User, ShieldCheck } from "lucide-react"

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // 2FA State
    const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
    const [challengeToken, setChallengeToken] = useState("")
    const [token, setToken] = useState("")

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const result = await loginUser(formData)

        if (result.success) {
            if (result.requiresTwoFactor) {
                setRequiresTwoFactor(true)
                setChallengeToken(result.challengeToken!)
                setLoading(false)
            } else {
                router.push("/")
            }
        } else {
            setError(result.error || "Login failed")
            setLoading(false)
        }
    }

    const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const result = await verifyTwoFactor(challengeToken, token)

        if (result.success) {
            router.push("/")
        } else {
            setError(result.error || "Invalid code")
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
            {/* Minimal Decorative Background element */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl opacity-50 pointer-events-none" />

            <div className="w-full max-w-[400px] p-8 z-10">
                <div className="mb-12 text-center">
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
                        Pixelist<span className="text-primary">.</span>
                    </h1>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground/50 mt-2 font-black">Authorized Access Only</p>
                </div>

                <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl">
                    {requiresTwoFactor ? (
                        <form onSubmit={handleVerify} className="space-y-6">
                            <div className="flex justify-center mb-6">
                                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                    <ShieldCheck className="h-8 w-8" />
                                </div>
                            </div>
                            <div className="space-y-2 text-center mb-6">
                                <h2 className="text-lg font-bold">Two-Factor Authentication</h2>
                                <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
                            </div>

                            {error && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold text-center">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Auth Code</Label>
                                <Input
                                    type="text"
                                    placeholder="000 000"
                                    className="h-12 text-center text-xl font-mono tracking-widest bg-background border-border"
                                    maxLength={6}
                                    value={token}
                                    onChange={(e) => setToken(e.target.value.replace(/[^0-9]/g, ""))}
                                    required
                                    autoFocus
                                />
                            </div>

                            <Button type="submit" className="w-full h-12 rounded-xl font-bold tracking-wide mt-4" disabled={loading}>
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
                        <form onSubmit={handleLogin} className="space-y-6">
                            {error && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold text-center">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Username</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                    <Input
                                        name="username"
                                        placeholder="admin"
                                        className="pl-10 h-12 bg-background border-border"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                    <Input
                                        name="password"
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-10 h-12 bg-background border-border"
                                        required
                                    />
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-12 rounded-xl font-bold tracking-wide mt-4" disabled={loading}>
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
