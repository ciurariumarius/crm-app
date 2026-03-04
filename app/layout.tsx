import { Plus_Jakarta_Sans } from "next/font/google"
import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers/providers"
import prisma from "@/lib/prisma"
import { getActiveTimer } from "@/lib/actions/time"
import { getSession } from "@/lib/auth"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
})

export const viewport: import("next").Viewport = {
  themeColor: "#0D9488",
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

import { Toaster } from "@/components/ui/sonner"
import { HeaderProvider } from "@/components/layout/header-context"
import { ShellFrame } from "@/components/layout/shell-frame"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const session = await getSession();

  // If no session, just render the bare minimum for the login page
  if (!session) {
    return (
      <html lang="en" suppressHydrationWarning className={`${jakarta.variable}`}>
        <body className="font-sans">
          <Providers initialActiveTimer={null}>
            <main className="min-h-screen bg-background text-foreground">
              {children}
            </main>
            <Toaster />
          </Providers>
        </body>
      </html>
    );
  }

  // Keep layout lightweight: only load data required by shared chrome.
  const [activeTimerResult, userData] = await Promise.all([
    getActiveTimer(),
    prisma.user.findFirst({
      where: { id: session.userId, tenantId: session.tenantId },
      select: { name: true, username: true, profilePic: true },
    })
  ])

  const user = userData ? JSON.parse(JSON.stringify(userData)) : undefined

  // Handle new activeTimer structure
  const rawActiveTimer = activeTimerResult.success && activeTimerResult.data
    ? { ...activeTimerResult.data, status: activeTimerResult.status }
    : null

  const initialActiveTimer = rawActiveTimer ? JSON.parse(JSON.stringify(rawActiveTimer)) : null

  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable}`}>
      <body className="font-sans">
        <Providers initialActiveTimer={initialActiveTimer}>
          <HeaderProvider>
            <ShellFrame user={user}>
              {children}
            </ShellFrame>
          </HeaderProvider>
        </Providers>
      </body>
    </html>
  );
}
