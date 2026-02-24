import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createProject } from '@/lib/actions'

export const dynamic = 'force-dynamic' // Ensure it runs every time

export async function GET(request: Request) {
    // Authenticate cron requests
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const today = new Date()
        const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)

        // Find ALL active projects that have at least one recurring service
        // AND were created before the current month started (i.e., last month's projects)
        const projectsToRollover = await prisma.project.findMany({
            where: {
                status: "Active",
                createdAt: {
                    lt: startOfCurrentMonth
                },
                services: {
                    some: {
                        isRecurring: true
                    }
                }
            },
            include: {
                services: true,
                site: true
            }
        })

        if (projectsToRollover.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No projects to rollover",
                processed: 0
            })
        }

        const results = []

        for (const project of projectsToRollover) {
            // 1. Mark the old project as Completed
            await prisma.project.update({
                where: { id: project.id },
                data: {
                    status: 'Completed',
                    // Optional: timestamp completion? updatedAt handles it.
                }
            })

            // 2. Create the NEW project for the current month
            // We reuse the createProject action which now has auto-naming logic!
            // It will generate: "Site - Services - [CurrentMonth]"
            // We pass null/undefined for name to trigger generation.

            const serviceIds = project.services.map(s => s.id)

            // Convert Decimal to number for the action input
            const currentFee = project.currentFee ? Number(project.currentFee) : 0

            const newProjectRes = await createProject({
                siteId: project.siteId,
                serviceIds: serviceIds,
                currentFee: currentFee,
                // Name left undefined -> auto-generated with current month
            })

            results.push({
                oldProjectId: project.id,
                oldProjectName: project.name,
                newProject: newProjectRes.success ? 'Created' : 'Failed',
                error: newProjectRes.error
            })
        }

        return NextResponse.json({
            success: true,
            processed: projectsToRollover.length,
            details: results
        })

    } catch (error) {
        console.error("Rollover failed:", error)
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
