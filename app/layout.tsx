import { Plus_Jakarta_Sans } from "next/font/google"
import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers/providers"
import { getActiveTimer } from "@/lib/actions/time"
import { getSession } from "@/lib/auth"
import type { TimerPreferences } from "@/components/providers/timer-provider"
import prisma from "@/lib/prisma"
import { runSecurityPreflight } from "@/lib/security/preflight"
import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY } from "@/lib/theme"

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
})

runSecurityPreflight()

const themeInitScript = `
(() => {
  try {
    const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
    const defaultTheme = ${JSON.stringify(DEFAULT_THEME_MODE)};
    const root = document.documentElement;
    const persisted = localStorage.getItem(storageKey);
    const wantsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    let resolved = persisted;
    if (resolved !== "light" && resolved !== "dark") {
      if (defaultTheme === "light" || defaultTheme === "dark") {
        resolved = defaultTheme;
      } else {
        resolved = wantsDark ? "dark" : "light";
      }
    }

    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch (_) {}
})();
`

export const viewport: import("next").Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#090f1a" },
  ],
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
      timerPreferenceRecord = (await prisma.user.findFirst({
        where: { id: session.userId },
        select: {
          timerIdlePauseMinutes: true,
          timerHardCapHours: true,
          timerReminderIntervalMinutes: true,
        }
      })) as {
        timerIdlePauseMinutes: number | null
        timerHardCapHours: number | null
        timerReminderIntervalMinutes: number | null
      } | null
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
    <html lang="en" suppressHydrationWarning className={plusJakartaSans.variable}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <Providers initialActiveTimer={initialActiveTimer} timerPreferences={timerPreferences}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
