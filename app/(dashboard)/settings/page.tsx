import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SettingsContent } from "./settings-content"
import { requireTenantContext } from "@/lib/tenant"

export default async function SettingsPage() {
    let session: Awaited<ReturnType<typeof requireTenantContext>>
    try {
        session = await requireTenantContext()
    } catch {
        redirect("/login")
    }

    const user = await prisma.user.findFirst({
        where: { id: session.userId, tenantId: session.tenantId },
        select: {
            name: true,
            username: true,
            profilePic: true,
            twoFactorEnabled: true
        }
    })

    if (!user) {
        redirect("/login")
    }

    return <SettingsContent user={user as any} />
}
