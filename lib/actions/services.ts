"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function createService(data: {
    serviceName: string
    isRecurring: boolean
    standardTasks: string[] // Array of strings
    sopLink?: string
    baseFee?: number
}) {
    await requireAuth()
    await prisma.service.create({
        data: {
            serviceName: data.serviceName,
            isRecurring: data.isRecurring,
            standardTasks: JSON.stringify(data.standardTasks),
            sopLink: data.sopLink,
            baseFee: data.baseFee,
        },
    })
    revalidatePath("/services")
}

export async function updateService(serviceId: string, data: {
    serviceName: string
    isRecurring: boolean
    standardTasks: string[]
    sopLink?: string
    baseFee?: number
}) {
    await requireAuth()
    await prisma.service.update({
        where: { id: serviceId },
        data: {
            serviceName: data.serviceName,
            isRecurring: data.isRecurring,
            standardTasks: JSON.stringify(data.standardTasks),
            sopLink: data.sopLink,
            baseFee: data.baseFee,
        },
    })
    revalidatePath("/services")
}
