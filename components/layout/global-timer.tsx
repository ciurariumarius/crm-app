"use client"

import * as React from "react"
import { Play, Pause, Square } from "lucide-react"
import { useTimer } from "@/components/providers/timer-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function GlobalTimer() {
    const { timerState, stopTimer, pauseTimer, resumeTimer } = useTimer()
    const [isExpanded, setIsExpanded] = React.useState(false)

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    }

    const hasTimerSession = Boolean(timerState.activeLogId) || timerState.elapsedSeconds > 0

    if (!hasTimerSession) {
        return null
    }

    if (!isExpanded) {
        const minutes = Math.floor(timerState.elapsedSeconds / 60)

        return (
            <div className="fixed bottom-[calc(5.25rem+max(0.6rem,env(safe-area-inset-bottom)))] right-4 z-50 md:bottom-[max(1rem,env(safe-area-inset-bottom))] md:right-6 animate-in fade-in zoom-in duration-300">
                <div className="relative h-[3.25rem] w-[3.25rem]">
                    <div
                        className={timerState.isRunning
                            ? "timer-heartbeat absolute inset-0 rounded-full"
                            : "absolute inset-0 rounded-full bg-slate-400 shadow-[0_4px_12px_-4px_rgba(100,116,139,0.6)]"
                        }
                        style={
                            timerState.isRunning
                                ? {
                                    background: "var(--primary-container)",
                                    boxShadow: "0 4px 12px -4px color-mix(in srgb, var(--primary-container) 72%, transparent)",
                                }
                                : undefined
                        }
                    />
                    <Button
                        size="icon"
                        className="relative h-full w-full rounded-full border-0 bg-transparent p-0 text-white hover:bg-transparent"
                        onClick={() => setIsExpanded(true)}
                        aria-label="Open timer controls"
                    >
                        <div className="flex items-center justify-center w-full h-full">
                            <span className="font-mono font-bold text-lg md:text-xl leading-none tracking-tighter">
                                {minutes}&apos;
                            </span>
                        </div>
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <Card className="fixed bottom-[calc(5.25rem+max(0.6rem,env(safe-area-inset-bottom)))] right-4 md:right-6 md:bottom-[max(1rem,env(safe-area-inset-bottom))] p-4 shadow-xl z-50 border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 w-[calc(100vw-2rem)] max-w-80 animate-in slide-in-from-bottom-10 fade-in duration-300">
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
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(false)} aria-label="Collapse timer controls">
                        x
                    </Button>
                </div>

                <div className="text-sm text-muted-foreground truncate">
                    {timerState.description || "No active task"}
                </div>

                <div className="flex items-center gap-2 justify-end">
                    {timerState.isRunning ? (
                        <Button variant="outline" size="sm" onClick={() => void pauseTimer()}>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => void resumeTimer()}>
                            <Play className="mr-2 h-4 w-4" />
                            Resume
                        </Button>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => void stopTimer()}>
                        <Square className="mr-2 h-4 w-4" />
                        Stop
                    </Button>
                </div>
            </div>
        </Card>
    )
}
