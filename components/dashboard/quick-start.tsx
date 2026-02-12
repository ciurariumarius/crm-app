"use client"

import { Play } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTimer } from "@/components/providers/timer-provider"

interface QuickStartProps {
    recentProjects: {
        id: string
        name: string
        siteName: string
        partnerName: string
    }[]
}

export function QuickStart({ recentProjects }: QuickStartProps) {
    const { startTimer } = useTimer()

    return (
        <Card>
            <CardHeader>
                <CardTitle>Quick Start</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recentProjects.map((project) => (
                    <Button
                        key={project.id}
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-start gap-1"
                        onClick={() => startTimer(project.id, undefined, `Working on ${project.name}`)}
                    >
                        <div className="flex items-center w-full justify-between">
                            <span className="font-semibold truncate w-full text-left">{project.name}</span>
                            <Play className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {project.partnerName} • {project.siteName}
                        </span>
                    </Button>
                ))}
                {recentProjects.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground border-dashed border-2 rounded-lg">
                        No recent projects found. Create a project in the Vault to get started.
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
