import { Plus_Jakarta_Sans } from "next/font/google"
import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers/providers"
import { getActiveTimer } from "@/lib/actions/time"

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const activeTimerResult = await getActiveTimer()
  const rawActiveTimer = activeTimerResult.success && activeTimerResult.data
    ? { ...activeTimerResult.data, status: activeTimerResult.status }
    : null
  const initialActiveTimer = rawActiveTimer ? JSON.parse(JSON.stringify(rawActiveTimer)) : null

  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable}`}>
      <body className="font-sans">
        <Providers initialActiveTimer={initialActiveTimer}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
