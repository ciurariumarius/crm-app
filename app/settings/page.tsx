import { getSession } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SettingsContent } from "./settings-content"

export default async function SettingsPage() {
    const session = await getSession()

    if (!session) {
        redirect("/login")
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId },
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
