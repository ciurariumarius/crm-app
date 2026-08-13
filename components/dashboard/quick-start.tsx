"use client"

import { Play } from "lucide-react"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentProjects.map((project) => (
                <button
                    key={project.id}
                    className="group relative flex flex-col items-start gap-6 p-6 rounded-[16px] bg-card border border-border hover:border-primary/30 hover:scale-[1.01] transition-all duration-500 text-left shadow-sm hover:shadow-md overflow-hidden"
                    onClick={() => startTimer(project.id, undefined, `Working on ${project.name}`)}
                >
                    {/* Mesh Gradient Overlay */}
                    <div className="absolute inset-0 bg-[var(--sidebar-accent)] opacity-0 transition-opacity duration-300 group-hover:opacity-40" />

                    <div className="flex items-center w-full justify-between relative z-10">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 transition-transform duration-500 group-hover:rotate-[360deg]">
                            <Play className="h-4 w-4 fill-current" strokeWidth={0} />
                            <div className="text-xs font-medium text-primary/60 group-hover:text-primary transition-colors">Fast Start</div>
                        </div>
                    </div>

                    <div className="space-y-2 w-full relative z-10">
                        <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{project.name}</div>
                        <div className="flex flex-col gap-1">
                            <div className="text-xs font-medium text-muted-foreground/80 truncate">{project.partnerName}</div>
                            <div className="text-xs font-medium text-muted-foreground/60 truncate">{project.siteName}</div>
                        </div>
                    </div>

                    {/* Subtle pulse */}
                    <div className="absolute -right-8 -bottom-8 h-24 w-24 bg-primary/5 blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700" />
                </button>
            ))}
            {recentProjects.length === 0 && (
                <div className="col-span-full text-center py-16 bg-muted/30 rounded-2xl border border-dashed border-border">
                    <p className="text-sm font-semibold text-muted-foreground">No Active Projects</p>
                    <p className="text-xs text-muted-foreground/60 mt-2 font-medium">Create a project to initialize the command interface.</p>
                </div>
            )}
        </div>
    )
}
