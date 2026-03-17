"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
    changePassword,
    generateTwoFactorSecret,
    enableTwoFactor,
    disableTwoFactor,
    updateProfile,
    revokeDeviceSession,
    revokeOtherDeviceSessions,
} from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Shield,
    Key,
    QrCode,
    User as UserIcon,
    Link as LinkIcon,
    Save,
    Loader2,
    Laptop,
    Smartphone,
    Monitor,
    LogOut,
} from "lucide-react"
import QRCode from "qrcode"
import { PageHeader } from "@/components/layout/page-header"
import Image from "next/image"
import { useRouter } from "next/navigation"

export interface UserData {
    name: string | null
    username: string
    profilePic: string | null
    twoFactorEnabled: boolean
    hourlyRate?: number | { toString(): string } | null
}

export interface DeviceSessionData {
    id: string
    userAgent: string | null
    ipAddress: string | null
    rememberDevice: boolean
    expiresAt: string
    lastSeenAt: string | null
    createdAt: string
    isCurrent: boolean
}

function formatSessionDate(value: string | null) {
    if (!value) return "Unknown"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Unknown"
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date)
}

function detectDeviceType(userAgent: string | null) {
    const ua = (userAgent || "").toLowerCase()
    if (/iphone|android|mobile/.test(ua)) return "mobile"
    if (/ipad|tablet/.test(ua)) return "tablet"
    return "desktop"
}

export function SettingsContent({
    user,
    sessionRegistryEnabled,
    deviceSessions: initialDeviceSessions,
}: {
    user: UserData
    sessionRegistryEnabled: boolean
    deviceSessions: DeviceSessionData[]
}) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [deviceLoading, setDeviceLoading] = useState(false)
    const [qrCodeUrl, setQrCodeUrl] = useState("")
    const [twoFactorSecret, setTwoFactorSecret] = useState("")
    const [token, setToken] = useState("")
    const [disablePassword, setDisablePassword] = useState("")
    const [is2FAEnabled, setIs2FAEnabled] = useState(user.twoFactorEnabled)
    const [deviceSessions, setDeviceSessions] = useState<DeviceSessionData[]>(initialDeviceSessions)

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
        if (!disablePassword) {
            toast.error("Current password is required to disable 2FA")
            return
        }
        setLoading(true)
        const result = await disableTwoFactor(disablePassword)
        if (result.success) {
            toast.success("Two-Factor Authentication Disabled")
            setIs2FAEnabled(false)
            setDisablePassword("")
        } else {
            toast.error(result.error || "Failed to disable 2FA")
        }
        setLoading(false)
    }

    const handleRevokeOtherSessions = async () => {
        setDeviceLoading(true)
        const result = await revokeOtherDeviceSessions()
        if (result.success) {
            toast.success(`Signed out ${result.revokedCount} other device${result.revokedCount === 1 ? "" : "s"}.`)
            setDeviceSessions((current) => current.filter((item) => item.isCurrent))
            router.refresh()
        } else {
            toast.error(result.error || "Failed to revoke other sessions.")
        }
        setDeviceLoading(false)
    }

    const handleRevokeDeviceSession = async (sessionId: string) => {
        setDeviceLoading(true)
        const result = await revokeDeviceSession(sessionId)
        if (result.success) {
            if (result.revokedCurrent) {
                window.location.assign("/login")
                return
            }
            setDeviceSessions((current) => current.filter((item) => item.id !== sessionId))
            toast.success("Device signed out.")
            router.refresh()
        } else {
            toast.error(result.error || "Failed to revoke session.")
        }
        setDeviceLoading(false)
    }

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <PageHeader
                title="Settings"
                subtitle="Manage your profile, password, and security preferences."
            />

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
                            <Label>Target Hourly Rate (RON)</Label>
                            <Input name="hourlyRate" type="number" defaultValue={user.hourlyRate?.toString() || "0"} placeholder="0" />
                            <p className="text-[10px] text-muted-foreground">Used for profitability and time sink alerts.</p>
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
                                <Input
                                    type="password"
                                    value={disablePassword}
                                    onChange={(e) => setDisablePassword(e.target.value)}
                                    placeholder="Current password"
                                    className="mt-2"
                                />
                                <Button variant="destructive" onClick={handleDisable2FA} disabled={loading || !disablePassword} className="mt-2">
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
                                            <Image src={qrCodeUrl} alt="2FA QR Code" width={192} height={192} className="w-48 h-48 mx-auto" unoptimized />
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

                {sessionRegistryEnabled && (
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                                    <Monitor className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">Active Devices</h2>
                                    <p className="text-xs text-muted-foreground">Manage where your account is signed in.</p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleRevokeOtherSessions}
                                disabled={deviceLoading}
                                className="gap-2"
                            >
                                {deviceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                Sign out other devices
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {deviceSessions.length === 0 && (
                                <p className="text-sm text-muted-foreground">No active devices found.</p>
                            )}

                            {deviceSessions.map((device) => {
                                const deviceType = detectDeviceType(device.userAgent)
                                return (
                                    <div
                                        key={device.id}
                                        className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                                    >
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground shrink-0">
                                                {deviceType === "mobile" ? (
                                                    <Smartphone className="h-4 w-4" />
                                                ) : deviceType === "tablet" ? (
                                                    <Monitor className="h-4 w-4" />
                                                ) : (
                                                    <Laptop className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">
                                                    {device.userAgent || "Unknown device"}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {device.ipAddress || "Unknown IP"} • Last seen {formatSessionDate(device.lastSeenAt)}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Expires {formatSessionDate(device.expiresAt)}
                                                    {device.rememberDevice ? " • Remembered" : ""}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {device.isCurrent ? (
                                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                                    Current device
                                                </span>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => void handleRevokeDeviceSession(device.id)}
                                                    disabled={deviceLoading}
                                                    className="gap-2"
                                                >
                                                    <LogOut className="h-3.5 w-3.5" />
                                                    Sign out
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
