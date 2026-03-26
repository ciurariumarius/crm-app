"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { startTimer as serverStartTimer, stopTimer as serverStopTimer, pauseTimer as serverPauseTimer, resumeTimer as serverResumeTimer } from "@/lib/actions/time"
import { toast } from "sonner"
import { useIdle } from "react-use"

type TimerState = {
    activeLogId: string | null
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
    stopTimer: (timerId?: string) => Promise<void>
    pauseTimer: (timerId?: string) => Promise<void>
    resumeTimer: (timerId?: string) => Promise<void>
}

export type InitialActiveTimer = {
    id?: string | null
    status?: string | null
    startTime?: string | Date | null
    durationSeconds?: number | null
    projectId?: string | null
    taskId?: string | null
    description?: string | null
    task?: { name?: string | null } | null
    project?: { name?: string | null } | null
}

export type TimerPreferences = {
    idlePauseMinutes?: number | null
    hardCapHours?: number | null
    reminderIntervalMinutes?: number | null
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

const DEFAULT_IDLE_MINUTES = 60
const DEFAULT_HARD_CAP_HOURS = 3
const DEFAULT_REMINDER_MINUTES = 60

function normalizePositiveInt(value: number | null | undefined, fallback: number) {
    if (value === null || value === undefined) return fallback
    if (!Number.isFinite(value)) return fallback
    const normalized = Math.floor(value)
    if (normalized < 0) return 0
    return normalized
}

export function TimerProvider({
    children,
    initialActiveTimer,
    preferences
}: {
    children: React.ReactNode
    initialActiveTimer?: InitialActiveTimer | null
    preferences?: TimerPreferences | null
}) {
    const resolvedPreferences = useMemo(() => {
        return {
            idlePauseMinutes: normalizePositiveInt(preferences?.idlePauseMinutes, DEFAULT_IDLE_MINUTES),
            hardCapHours: normalizePositiveInt(preferences?.hardCapHours, DEFAULT_HARD_CAP_HOURS),
            reminderIntervalMinutes: normalizePositiveInt(preferences?.reminderIntervalMinutes, DEFAULT_REMINDER_MINUTES),
        }
    }, [preferences?.hardCapHours, preferences?.idlePauseMinutes, preferences?.reminderIntervalMinutes])

    const idleTimeoutMs = resolvedPreferences.idlePauseMinutes > 0
        ? resolvedPreferences.idlePauseMinutes * 60 * 1000
        : Number.MAX_SAFE_INTEGER
    const hardCapSeconds = resolvedPreferences.hardCapHours > 0
        ? resolvedPreferences.hardCapHours * 3600
        : 0
    const reminderIntervalSeconds = resolvedPreferences.reminderIntervalMinutes > 0
        ? resolvedPreferences.reminderIntervalMinutes * 60
        : 0

    const isIdle = useIdle(idleTimeoutMs)
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
                activeLogId: initialActiveTimer.id ?? null,
                isRunning,
                startTime,
                elapsedSeconds,
                projectId: initialActiveTimer.projectId ?? null,
                taskId: initialActiveTimer.taskId ?? null,
                description: initialActiveTimer.description || initialActiveTimer.task?.name || initialActiveTimer.project?.name || null,
            }
        }

        return {
            activeLogId: null,
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
        try {
            const result = await serverStartTimer(projectId, taskId, description)
            if (result.success) {
                const serverLog = result.data
                const serverStartTime = serverLog?.startTime ? new Date(serverLog.startTime).getTime() : Date.now()
                setTimerState({
                    activeLogId: serverLog?.id ?? null,
                    isRunning: true,
                    startTime: serverStartTime,
                    elapsedSeconds: 0,
                    projectId,
                    taskId: taskId || null,
                    description: description || serverLog?.description || null,
                })
                lastRemindedHourRef.current = 0
                toast.success("Timer started")
            } else {
                toast.error(result.error || "Failed to start timer")
            }
        } catch {
            toast.error("An error occurred while starting the timer")
        }
    }, [requestNotificationPermission])

    const stopTimer = useCallback(async (timerId?: string) => {
        try {
            const result = await serverStopTimer(timerId || timerState.activeLogId || undefined)
            if (result.success) {
                setTimerState({
                    activeLogId: null,
                    isRunning: false,
                    startTime: null,
                    elapsedSeconds: 0,
                    projectId: null,
                    taskId: null,
                    description: null,
                })
                lastRemindedHourRef.current = 0
                toast.success("Timer stopped")
            } else {
                toast.error(result.error || "Failed to stop timer")
            }
        } catch {
            toast.error("An error occurred while stopping the timer")
        }
    }, [timerState.activeLogId])

    const pauseTimer = useCallback(async (timerId?: string) => {
        try {
            const result = await serverPauseTimer(timerId || timerState.activeLogId || undefined)
            if (result.success) {
                setTimerState((prev) => ({
                    ...prev,
                    activeLogId: result.data?.id ?? prev.activeLogId,
                    isRunning: false,
                    elapsedSeconds: result.data?.durationSeconds ?? prev.elapsedSeconds,
                    startTime: null,
                }))
                toast.success("Timer paused")
            } else {
                toast.error(result.error || "Failed to pause timer")
            }
        } catch {
            toast.error("An error occurred while pausing the timer")
        }
    }, [timerState.activeLogId])

    const resumeTimer = useCallback(async (timerId?: string) => {
        requestNotificationPermission()
        try {
            const result = await serverResumeTimer(timerId || timerState.activeLogId || undefined)
            if (result.success) {
                const resumedStartTime = result.data?.startTime ? new Date(result.data.startTime).getTime() : Date.now()
                const resumedElapsed = result.data?.durationSeconds
                    ? result.data.durationSeconds
                    : Math.max(0, Math.floor((Date.now() - resumedStartTime) / 1000))

                setTimerState((prev) => ({
                    ...prev,
                    activeLogId: result.data?.id ?? prev.activeLogId,
                    isRunning: true,
                    startTime: resumedStartTime,
                    elapsedSeconds: resumedElapsed,
                }))
                toast.success("Timer resumed")
            } else {
                toast.error(result.error || "Failed to resume timer")
            }
        } catch {
            toast.error("An error occurred while resuming the timer")
        }
    }, [requestNotificationPermission, timerState.activeLogId])

    // 1. Idle Detection Logic
    useEffect(() => {
        if (resolvedPreferences.idlePauseMinutes <= 0 || !timerState.isRunning || !isIdle) {
            idlePauseScheduledRef.current = false
            return
        }

        if (idlePauseScheduledRef.current) return
        idlePauseScheduledRef.current = true

        const timeoutId = window.setTimeout(() => {
            void pauseTimer()
            toast.warning("Timer paused due to inactivity", {
                description: `You were idle for ${resolvedPreferences.idlePauseMinutes} minutes. Click resume to continue tracking.`,
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
    }, [isIdle, pauseTimer, resolvedPreferences.idlePauseMinutes, resumeTimer, timerState.isRunning])

    // 2. Hard Cap & Hourly Reminders
    useEffect(() => {
        if (!timerState.isRunning || hardCapSeconds <= 0 || timerState.elapsedSeconds <= hardCapSeconds) {
            hardCapScheduledRef.current = false
            return
        }

        if (hardCapScheduledRef.current) return
        hardCapScheduledRef.current = true

        const timeoutId = window.setTimeout(() => {
            void stopTimer()
            toast.error("Timer auto-stopped", {
                description: `Timer limit of ${resolvedPreferences.hardCapHours} hour(s) reached.`,
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
    }, [hardCapSeconds, resolvedPreferences.hardCapHours, stopTimer, timerState.elapsedSeconds, timerState.isRunning])

    useEffect(() => {
        if (!timerState.isRunning || reminderIntervalSeconds <= 0) {
            lastRemindedHourRef.current = 0
            return
        }

        const currentHour = Math.floor(timerState.elapsedSeconds / reminderIntervalSeconds)

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
    }, [reminderIntervalSeconds, timerState.elapsedSeconds, timerState.isRunning])


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
