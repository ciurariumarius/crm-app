"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function createPartner(data: {
    name: string
    isMainJob: boolean
    internalNotes?: string
}) {
    await requireAuth()
    await prisma.partner.create({
        data: {
            name: data.name,
            isMainJob: data.isMainJob,
            internalNotes: data.internalNotes,
        },
    })
    revalidatePath("/vault")
}

export async function updatePartner(partnerId: string, data: {
    name: string
    businessName?: string
    isMainJob: boolean
    emailPrimary?: string
    emailSecondary?: string
    phone?: string
    internalNotes?: string
}) {
    await requireAuth()
    await prisma.partner.update({
        where: { id: partnerId },
        data,
    })
    revalidatePath("/vault")
    revalidatePath(`/vault/${partnerId}`)
}

export async function deletePartner(partnerId: string) {
    await requireAuth()
    await prisma.partner.delete({
        where: { id: partnerId },
    })
    revalidatePath("/vault")
}
