"use client"

import { useState } from "react"
import { toast } from "sonner"
import { changePassword, generateTwoFactorSecret, enableTwoFactor, disableTwoFactor, updateProfile } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Key, QrCode, User as UserIcon, Link as LinkIcon, Save, Loader2 } from "lucide-react"
import QRCode from "qrcode"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"

interface UserData {
    name: string | null
    username: string
    profilePic: string | null
    twoFactorEnabled: boolean
}

export function SettingsContent({ user }: { user: UserData }) {
    const [loading, setLoading] = useState(false)
    const [qrCodeUrl, setQrCodeUrl] = useState("")
    const [twoFactorSecret, setTwoFactorSecret] = useState("")
    const [token, setToken] = useState("")
    const [is2FAEnabled, setIs2FAEnabled] = useState(user.twoFactorEnabled)

    const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        const result = await updateProfile(formData)

        if (result.success) {
            toast.success("Profile updated successfully")
        } else {
            toast.error(result.error)
        }
        setLoading(false)
    }

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
            toast.success("Two-Factor Authentication Enabled!")
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
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <div className="flex h-10 items-center justify-between gap-4">
                <div className="flex flex-col gap-1 pr-12 md:pr-0 h-full">
                    <div className="flex items-center gap-3">
                        <MobileMenuTrigger />
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground md:pl-0 leading-none flex items-center h-full">
                            Settings
                        </h1>
                    </div>
                </div>
            </div>
            <p className="text-muted-foreground pl-14 md:pl-0 -mt-4">Manage your profile, password, and security preferences.</p>

            <div className="grid grid-cols-1 gap-8">
                {/* Profile Card */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                            <UserIcon className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl font-bold">Profile</h2>
                    </div>

                    <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-xl">
                        <div className="space-y-2">
                            <Label>Display Name</Label>
                            <Input name="name" defaultValue={user.name || ""} placeholder="Your Name" />
                        </div>
                        <div className="space-y-2">
                            <Label>Profile Picture URL</Label>
                            <div className="relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                <Input name="profilePic" defaultValue={user.profilePic || ""} placeholder="https://..." className="pl-10" />
                            </div>
                            <p className="text-[10px] text-muted-foreground">Provide an absolute URL to an image. Leave blank to use defaults.</p>
                        </div>
                        <Button type="submit" disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Profile
                        </Button>
                    </form>
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
        </div>
    )
}
