"use client"

import * as React from "react"
import { Play, Pause, Square, Timer } from "lucide-react"
import { useTimer } from "@/components/providers/timer-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function GlobalTimer() {
    const { timerState, startTimer, stopTimer, pauseTimer, resumeTimer } = useTimer()
    const [isExpanded, setIsExpanded] = React.useState(false)

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    }

    if (!timerState.isRunning && timerState.elapsedSeconds === 0 && !isExpanded) {
        return (
            <Button
                size="icon"
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 animate-in fade-in zoom-in duration-300"
                onClick={() => setIsExpanded(true)}
            >
                <Timer className="h-6 w-6" />
            </Button>
        )
    }

    return (
        <Card className="fixed bottom-6 right-6 p-4 shadow-xl z-50 border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 w-80 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Badge variant={timerState.isRunning ? "default" : "secondary"} className="animate-pulse">
                            {timerState.isRunning ? "Tracking" : "Paused"}
                        </Badge>
                        <span className="text-2xl font-mono font-bold tracking-wider">
                            {formatTime(timerState.elapsedSeconds)}
                        </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(false)}>
                        x
                    </Button>
                </div>

                <div className="text-sm text-muted-foreground truncate">
                    {timerState.description || "No active task"}
                </div>

                <div className="flex items-center gap-2 justify-end">
                    {timerState.isRunning ? (
                        <Button variant="outline" size="sm" onClick={pauseTimer}>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={resumeTimer}>
                            <Play className="mr-2 h-4 w-4" />
                            Resume
                        </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={stopTimer}>
                        <Square className="mr-2 h-4 w-4" />
                        Stop
                    </Button>
                </div>
            </div>
        </Card>
    )
}
