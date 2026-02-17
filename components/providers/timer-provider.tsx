"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { startTimer as serverStartTimer, stopTimer as serverStopTimer, pauseTimer as serverPauseTimer, resumeTimer as serverResumeTimer } from "@/lib/actions"
import { toast } from "sonner"

type TimerState = {
    isRunning: boolean
    startTime: number | null
    elapsedSeconds: number
    projectId: string | null
    taskId: string | null
    description: string | null
}

type TimerContextType = {
    timerState: TimerState
    startTimer: (projectId: string, taskId?: string, description?: string) => Promise<void>
    stopTimer: () => Promise<void>
    pauseTimer: () => Promise<void>
    resumeTimer: () => Promise<void>
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

export function TimerProvider({ children, initialActiveTimer }: { children: React.ReactNode, initialActiveTimer?: any }) {
    const [timerState, setTimerState] = useState<TimerState>(() => {
        if (initialActiveTimer) {
            const isRunning = initialActiveTimer.status === "running"
            const startTime = initialActiveTimer.startTime ? new Date(initialActiveTimer.startTime).getTime() : null
            let elapsedSeconds = 0

            if (isRunning && startTime) {
                elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
            } else if (initialActiveTimer.durationSeconds) {
                elapsedSeconds = initialActiveTimer.durationSeconds
            }

            return {
                isRunning,
                startTime,
                elapsedSeconds,
                projectId: initialActiveTimer.projectId,
                taskId: initialActiveTimer.taskId,
                description: initialActiveTimer.description || initialActiveTimer.task?.name || initialActiveTimer.project?.name || null,
            }
        }

        return {
            isRunning: false,
            startTime: null,
            elapsedSeconds: 0,
            projectId: null,
            taskId: null,
            description: null,
        }
    })

    // Tick
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (timerState.isRunning) {
            interval = setInterval(() => {
                setTimerState((prev) => ({
                    ...prev,
                    elapsedSeconds: prev.elapsedSeconds + 1,
                }))
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [timerState.isRunning])

    const startTimer = async (projectId: string, taskId?: string, description?: string) => {
        // Optimistic update
        const newState = {
            isRunning: true,
            startTime: Date.now(),
            elapsedSeconds: 0,
            projectId,
            taskId: taskId || null,
            description: description || null,
        }
        setTimerState(newState)

        try {
            const result = await serverStartTimer(projectId, taskId)
            if (!result.success) {
                toast.error(result.error || "Failed to start timer")
                // Rollback if needed, but usually we just want to stay consistent with server
            }
        } catch (error) {
            toast.error("An error occurred while starting the timer")
        }
    }

    const stopTimer = async () => {
        setTimerState({
            isRunning: false,
            startTime: null,
            elapsedSeconds: 0,
            projectId: null,
            taskId: null,
            description: null,
        })

        try {
            const result = await serverStopTimer()
            if (result.success) {
                toast.success("Timer stopped")
            } else {
                toast.error(result.error || "Failed to stop timer")
            }
        } catch (error) {
            toast.error("An error occurred while stopping the timer")
        }
    }

    const pauseTimer = async () => {
        setTimerState((prev) => ({ ...prev, isRunning: false }))
        try {
            const result = await serverPauseTimer()
            if (result.success) {
                toast.success("Timer paused")
            } else {
                toast.error(result.error || "Failed to pause timer")
            }
        } catch (error) {
            toast.error("An error occurred while pausing the timer")
        }
    }

    const resumeTimer = async () => {
        // Optimistic update
        setTimerState((prev) => ({ ...prev, isRunning: true, startTime: Date.now() }))
        try {
            const result = await serverResumeTimer()
            if (result.success) {
                toast.success("Timer resumed")
            } else {
                toast.error(result.error || "Failed to resume timer")
            }
        } catch (error) {
            toast.error("An error occurred while resuming the timer")
        }
    }

    return (
        <TimerContext.Provider value={{ timerState, startTimer, stopTimer, pauseTimer, resumeTimer }}>
            {children}
        </TimerContext.Provider>
    )
}

export function useTimer() {
    const context = useContext(TimerContext)
    if (context === undefined) {
        throw new Error("useTimer must be used within a TimerProvider")
    }
    return context
}
