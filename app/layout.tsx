import { Plus_Jakarta_Sans } from "next/font/google"
import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers/providers"
import type { TimerPreferences } from "@/components/providers/timer-provider"
import { runSecurityPreflight } from "@/lib/security/preflight"
import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY } from "@/lib/theme"
import { headers } from "next/headers"
import { getAppShellData, getCachedSession } from "@/lib/server/app-shell"

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
  const nonce = (await headers()).get("x-nonce") || undefined
  const session = await getCachedSession()
  const shellData = session ? await getAppShellData(session.userId) : null
  const rawActiveTimer = shellData?.timer
    ? { ...shellData.timer, status: shellData.timerStatus }
    : null
  const initialActiveTimer = rawActiveTimer ? JSON.parse(JSON.stringify(rawActiveTimer)) : null
  let timerPreferenceRecord: {
    timerIdlePauseMinutes: number | null
    timerHardCapHours: number | null
    timerReminderIntervalMinutes: number | null
  } | null = null

  if (shellData?.preferences) timerPreferenceRecord = shellData.preferences
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
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
