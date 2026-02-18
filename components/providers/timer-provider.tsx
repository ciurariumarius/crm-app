"use client"

import React, { createContext, useContext, useState, useEffect, useRef } from "react"
import { startTimer as serverStartTimer, stopTimer as serverStopTimer, pauseTimer as serverPauseTimer, resumeTimer as serverResumeTimer } from "@/lib/actions"
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

const TimerContext = createContext<TimerContextType | undefined>(undefined)

const IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const HARD_CAP_SECONDS = 3 * 3600 // 3 hours
const REMINDER_INTERVAL_SECONDS = 3600 // 1 hour

export function TimerProvider({ children, initialActiveTimer }: { children: React.ReactNode, initialActiveTimer?: any }) {
    const isIdle = useIdle(IDLE_TIMEOUT_MS / 1000) // react-use takes seconds
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


    // 1. Idle Detection Logic
    useEffect(() => {
        // Only trigger if running and the elapsed time since start > idle timeout
        // This prevents immediate pause on page load if user is technically "idle" but just opened the page
        if (timerState.isRunning && isIdle) {
            pauseTimer()
            toast.warning("Timer paused due to inactivity", {
                description: "You were idle for 15 minutes. Click resume to continue tracking.",
                action: {
                    label: "Resume",
                    onClick: () => resumeTimer()
                },
                duration: 10000 // Show for 10 seconds
            })
        }
    }, [isIdle, timerState.isRunning])

    // 2. Hard Cap & Hourly Reminders
    useEffect(() => {
        if (!timerState.isRunning) return

        // Hard Cap
        if (timerState.elapsedSeconds > HARD_CAP_SECONDS) {
            stopTimer()
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
        }

        // Hourly Reminders
        // Check if elapsed seconds is a multiple of REMINDER_INTERVAL_SECONDS (approximate trigger)
        // We use a range or 'previous' check usually, but since this runs on state update which is every second, modulo is okay-ish
        // BETTER: Store last reminded hour in a ref to avoid duplicate notifications
    }, [timerState.elapsedSeconds, timerState.isRunning])

    // Ref to track last reminded hour to prevent spamming
    const lastRemindedHourRef = useRef<number>(0)

    useEffect(() => {
        if (!timerState.isRunning) {
            lastRemindedHourRef.current = 0
            return
        }

        const currentHour = Math.floor(timerState.elapsedSeconds / 3600)

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

    // Request Notification Permission on Start
    const requestNotificationPermission = () => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission()
        }
    }

    const startTimer = async (projectId: string, taskId?: string, description?: string) => {
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
        lastRemindedHourRef.current = 0

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
        requestNotificationPermission()
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
