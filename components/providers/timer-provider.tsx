"use client"

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { startTimer as serverStartTimer, stopTimer as serverStopTimer, pauseTimer as serverPauseTimer, resumeTimer as serverResumeTimer } from "@/lib/actions/time"
import { toast } from "sonner"
import { useIdle } from "react-use"

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

export type InitialActiveTimer = {
    status?: string | null
    startTime?: string | Date | null
    durationSeconds?: number | null
    projectId?: string | null
    taskId?: string | null
    description?: string | null
    task?: { name?: string | null } | null
    project?: { name?: string | null } | null
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

const IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const HARD_CAP_SECONDS = 3 * 3600 // 3 hours
const REMINDER_INTERVAL_SECONDS = 3600 // 1 hour

export function TimerProvider({ children, initialActiveTimer }: { children: React.ReactNode, initialActiveTimer?: InitialActiveTimer | null }) {
    const isIdle = useIdle(IDLE_TIMEOUT_MS) // react-use takes milliseconds
    const [timerState, setTimerState] = useState<TimerState>(() => {
        // Hydrate from initial server state (if available)
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
                startTime: startTime,
                elapsedSeconds: elapsedSeconds,
                projectId: initialActiveTimer.projectId ?? null,
                taskId: initialActiveTimer.taskId ?? null,
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

    // Ref to track last reminded hour to prevent spamming
    const lastRemindedHourRef = useRef<number>(0)
    const idlePauseScheduledRef = useRef(false)
    const hardCapScheduledRef = useRef(false)

    // Request Notification Permission on Start
    const requestNotificationPermission = useCallback(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission()
        }
    }, [])

    const startTimer = useCallback(async (projectId: string, taskId?: string, description?: string) => {
        requestNotificationPermission()
        const newState = {
            isRunning: true,
            startTime: Date.now(),
            elapsedSeconds: 0,
            projectId,
            taskId: taskId || null,
            description: description || null,
        }
        setTimerState(newState)
        lastRemindedHourRef.current = 0

        try {
            const result = await serverStartTimer(projectId, taskId)
            if (result.success) {
                toast.success("Timer started")
            } else {
                toast.error(result.error || "Failed to start timer")
            }
        } catch {
            toast.error("An error occurred while starting the timer")
        }
    }, [requestNotificationPermission])

    const stopTimer = useCallback(async () => {
        setTimerState({
            isRunning: false,
            startTime: null,
            elapsedSeconds: 0,
            projectId: null,
            taskId: null,
            description: null,
        })
        lastRemindedHourRef.current = 0

        try {
            const result = await serverStopTimer()
            if (result.success) {
                toast.success("Timer stopped")
            } else {
                toast.error(result.error || "Failed to stop timer")
            }
        } catch {
            toast.error("An error occurred while stopping the timer")
        }
    }, [])

    const pauseTimer = useCallback(async () => {
        setTimerState((prev) => ({ ...prev, isRunning: false }))
        try {
            const result = await serverPauseTimer()
            if (result.success) {
                toast.success("Timer paused")
            } else {
                toast.error(result.error || "Failed to pause timer")
            }
        } catch {
            toast.error("An error occurred while pausing the timer")
        }
    }, [])

    const resumeTimer = useCallback(async () => {
        requestNotificationPermission()
        setTimerState((prev) => ({ ...prev, isRunning: true, startTime: Date.now() }))
        try {
            const result = await serverResumeTimer()
            if (result.success) {
                toast.success("Timer resumed")
            } else {
                toast.error(result.error || "Failed to resume timer")
            }
        } catch {
            toast.error("An error occurred while resuming the timer")
        }
    }, [requestNotificationPermission])

    // 1. Idle Detection Logic
    useEffect(() => {
        if (!timerState.isRunning || !isIdle) {
            idlePauseScheduledRef.current = false
            return
        }

        if (idlePauseScheduledRef.current) return
        idlePauseScheduledRef.current = true

        const timeoutId = window.setTimeout(() => {
            void pauseTimer()
            toast.warning("Timer paused due to inactivity", {
                description: "You were idle for 15 minutes. Click resume to continue tracking.",
                action: {
                    label: "Resume",
                    onClick: () => {
                        void resumeTimer()
                    }
                },
                duration: 10000 // Show for 10 seconds
            })
            idlePauseScheduledRef.current = false
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [isIdle, pauseTimer, resumeTimer, timerState.isRunning])

    // 2. Hard Cap & Hourly Reminders
    useEffect(() => {
        if (!timerState.isRunning || timerState.elapsedSeconds <= HARD_CAP_SECONDS) {
            hardCapScheduledRef.current = false
            return
        }

        if (hardCapScheduledRef.current) return
        hardCapScheduledRef.current = true

        const timeoutId = window.setTimeout(() => {
            void stopTimer()
            toast.error("Timer auto-stopped", {
                description: "Timer limit of 3 hours reached.",
                duration: Infinity
            })

            // Attempt to send browser notification for hard stop
            if (Notification.permission === "granted") {
                new Notification("Timer Stopped", {
                    body: "Maximum duration of 3 hours reached.",
                    icon: "/icon.png" // Optional
                })
            }
            hardCapScheduledRef.current = false
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [stopTimer, timerState.elapsedSeconds, timerState.isRunning])

    useEffect(() => {
        if (!timerState.isRunning) {
            lastRemindedHourRef.current = 0
            return
        }

        const currentHour = Math.floor(timerState.elapsedSeconds / REMINDER_INTERVAL_SECONDS)

        if (currentHour > 0 && currentHour > lastRemindedHourRef.current) {
            lastRemindedHourRef.current = currentHour

            // Trigger Notification
            toast.info(`Timer Running: ${currentHour}h`, {
                description: "Just a reminder that your timer is still running.",
                duration: 5000
            })

            if (Notification.permission === "granted") {
                new Notification("Timer Update", {
                    body: `You have been tracking time for ${currentHour} hour(s).`,
                })
            }
        }
    }, [timerState.elapsedSeconds, timerState.isRunning])


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
