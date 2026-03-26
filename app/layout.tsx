import { Inter, JetBrains_Mono } from "next/font/google"
import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers/providers"
import { getActiveTimer } from "@/lib/actions/time"
import { getSession } from "@/lib/auth"
import type { TimerPreferences } from "@/components/providers/timer-provider"
import prisma from "@/lib/prisma"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

export const viewport: import("next").Viewport = {
  themeColor: "#F8FAFC",
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "Pixelist",
  description: "Personal CRM & Time-Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pixelist",
  },
  formatDetection: {
    telephone: false,
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession()
  const activeTimerResult = session ? await getActiveTimer() : { success: true, data: null, status: "idle" as const }
  const rawActiveTimer = activeTimerResult.success && activeTimerResult.data
    ? { ...activeTimerResult.data, status: activeTimerResult.status }
    : null
  const initialActiveTimer = rawActiveTimer ? JSON.parse(JSON.stringify(rawActiveTimer)) : null
  let timerPreferenceRecord: {
    timerIdlePauseMinutes: number | null
    timerHardCapHours: number | null
    timerReminderIntervalMinutes: number | null
  } | null = null

  if (session) {
    try {
      timerPreferenceRecord = await prisma.user.findFirst({
        where: { id: session.userId, tenantId: session.tenantId },
        select: {
          timerIdlePauseMinutes: true,
          timerHardCapHours: true,
          timerReminderIntervalMinutes: true,
        }
      })
    } catch (error) {
      console.warn("[layout] Timer preference fields unavailable; using defaults.", error)
      timerPreferenceRecord = null
    }
  }
  const timerPreferences: TimerPreferences | null = timerPreferenceRecord
    ? {
      idlePauseMinutes: timerPreferenceRecord.timerIdlePauseMinutes,
      hardCapHours: timerPreferenceRecord.timerHardCapHours,
      reminderIntervalMinutes: timerPreferenceRecord.timerReminderIntervalMinutes,
    }
    : null

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">
        <Providers initialActiveTimer={initialActiveTimer} timerPreferences={timerPreferences}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
