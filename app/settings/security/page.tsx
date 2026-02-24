"use client"

import { useState } from "react"
import { toast } from "sonner"
import { changePassword, generateTwoFactorSecret, enableTwoFactor, disableTwoFactor } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Key, QrCode } from "lucide-react"
import QRCode from "qrcode"

export default function SecuritySettingsPage() {
    const [loading, setLoading] = useState(false)
    const [qrCodeUrl, setQrCodeUrl] = useState("")
    const [twoFactorSecret, setTwoFactorSecret] = useState("")
    const [token, setToken] = useState("")
    const [is2FAEnabled, setIs2FAEnabled] = useState(false)

    const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        const newPassword = formData.get("newPassword") as string
        const confirmPassword = formData.get("confirmPassword") as string

        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match")
            setLoading(false)
            return
        }

        const result = await changePassword(formData)
        if (result.success) {
            toast.success("Password changed successfully")
                ; (e.target as HTMLFormElement).reset()
        } else {
            toast.error(result.error)
        }
        setLoading(false)
    }

    const handleGenerate2FA = async () => {
        setLoading(true)
        const result = await generateTwoFactorSecret()
        if (result.success && result.otpauth && result.secret) {
            const url = await QRCode.toDataURL(result.otpauth)
            setQrCodeUrl(url)
            setTwoFactorSecret(result.secret)
        } else {
            toast.error(result.error || "Failed to generate 2FA secret")
        }
        setLoading(false)
    }

    const handleEnable2FA = async () => {
        setLoading(true)
        const result = await enableTwoFactor(token, twoFactorSecret)
        if (result.success) {
            toast.success("Two-Factor Authentication Enbled!")
            setIs2FAEnabled(true)
            setQrCodeUrl("")
            setTwoFactorSecret("")
            setToken("")
        } else {
            toast.error(result.error || "Failed to enable 2FA")
        }
        setLoading(false)
    }

    const handleDisable2FA = async () => {
        setLoading(true)
        const result = await disableTwoFactor()
        if (result.success) {
            toast.success("Two-Factor Authentication Disabled")
            setIs2FAEnabled(false)
        } else {
            toast.error(result.error || "Failed to disable 2FA")
        }
        setLoading(false)
    }

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-12">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Security Settings</h1>
                <p className="text-muted-foreground">Manage your password and Multi-Factor Auth</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Change Password Card */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <Key className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl font-bold">Change Password</h2>
                    </div>

                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Current Password</Label>
                            <Input name="currentPassword" type="password" required />
                        </div>
                        <div className="space-y-2">
                            <Label>New Password</Label>
                            <Input name="newPassword" type="password" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Confirm New Password</Label>
                            <Input name="confirmPassword" type="password" required />
                        </div>
                        <Button type="submit" disabled={loading}>Update Password</Button>
                    </form>
                </div>

                {/* 2FA Setup Card */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                                <Shield className="h-5 w-5" />
                            </div>
                            <h2 className="text-xl font-bold">Two-Factor Auth</h2>
                        </div>
                    </div>

                    {is2FAEnabled ? (
                        <div className="text-center space-y-4">
                            <div className="inline-flex h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full items-center justify-center mb-2">
                                <Shield className="h-8 w-8" />
                            </div>
                            <h3 className="text-lg font-bold text-emerald-500">2FA is Enabled</h3>
                            <p className="text-sm text-muted-foreground">Your account is secured with a secondary authenticator app.</p>
                            <Button variant="destructive" onClick={handleDisable2FA} disabled={loading} className="mt-4">
                                Disable 2FA
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <p className="text-sm text-muted-foreground">
                                Add an additional layer of security to your account by requesting more than just a password to log in.
                            </p>

                            {!qrCodeUrl ? (
                                <Button onClick={handleGenerate2FA} className="w-full bg-indigo-500 hover:bg-indigo-600" disabled={loading}>
                                    <QrCode className="mr-2 h-4 w-4" /> Setup Authenticator App
                                </Button>
                            ) : (
                                <div className="space-y-6 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-500 text-center">
                                    <h3 className="font-bold">1. Scan QR Code</h3>
                                    <p className="text-xs text-muted-foreground">Use Google Authenticator or Authy to scan this code.</p>
                                    <div className="bg-white p-4 rounded-xl inline-block shadow-md">
                                        <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 mx-auto" />
                                    </div>
                                    <p className="text-[10px] font-mono select-all bg-muted p-2 rounded">{twoFactorSecret}</p>

                                    <div className="space-y-4 border-t pt-6 text-left">
                                        <h3 className="font-bold">2. Verify Token</h3>
                                        <div className="space-y-2">
                                            <Label>Enter 6-digit code</Label>
                                            <Input
                                                value={token}
                                                onChange={(e) => setToken(e.target.value.replace(/[^0-9]/g, ""))}
                                                maxLength={6}
                                                className="font-mono tracking-widest text-center text-lg"
                                                placeholder="000000"
                                            />
                                        </div>
                                        <Button onClick={handleEnable2FA} className="w-full" disabled={loading || token.length !== 6}>
                                            Enable 2FA
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
