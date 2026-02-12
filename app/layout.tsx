import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter as requested/standard
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { GlobalTimer } from "@/components/layout/global-timer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Limitless CRM",
  description: "GTM/PPC Personal CRM & Time-Tracker",
  manifest: "/manifest.json", // Prepared for PWA
};

import { Toaster } from "@/components/ui/sonner";
import { GlobalHeaderSearch } from "@/components/layout/global-header-search";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
              <header className="h-16 border-b bg-card/50 backdrop-blur-sm hidden md:flex items-center justify-between px-8">
                <GlobalHeaderSearch />
                <div className="flex items-center gap-4">
                  {/* Future: Profile / Notifications */}
                </div>
              </header>
              <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-8 transition-all duration-300">
                {children}
              </main>
            </div>
            <GlobalTimer />
            <Toaster />
          </div>
        </Providers>
      </body>
    </html>
  );
}
