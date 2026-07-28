import prisma from "@/lib/prisma"
import { HeaderProvider } from "@/components/layout/header-context"
import { ShellFrame } from "@/components/layout/shell-frame"
import { redirect } from "next/navigation"
import { getCachedSession } from "@/lib/server/app-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();

  if (!session) {
    redirect("/login");
  }

  const userData = await prisma.user.findFirst({
    where: { id: session.userId },
    select: { name: true, username: true, profilePic: true },
  })

  const user = userData ? JSON.parse(JSON.stringify(userData)) : undefined

  return (
    <HeaderProvider>
      <ShellFrame
        user={user}
      >
        {children}
      </ShellFrame>
    </HeaderProvider>
  );
}
