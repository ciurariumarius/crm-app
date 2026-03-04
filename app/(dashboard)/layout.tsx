import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { HeaderProvider } from "@/components/layout/header-context"
import { ShellFrame } from "@/components/layout/shell-frame"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const userData = await prisma.user.findFirst({
    where: { id: session.userId, tenantId: session.tenantId },
    select: { name: true, username: true, profilePic: true },
  })

  const user = userData ? JSON.parse(JSON.stringify(userData)) : undefined

  return (
    <HeaderProvider>
      <ShellFrame user={user}>
        {children}
      </ShellFrame>
    </HeaderProvider>
  );
}
