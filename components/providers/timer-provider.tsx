"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

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
    startTimer: (projectId: string, taskId?: string, description?: string) => void
    stopTimer: () => void
    pauseTimer: () => void
    resumeTimer: () => void
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

export function TimerProvider({ children }: { children: React.ReactNode }) {
    const [timerState, setTimerState] = useState<TimerState>({
        isRunning: false,
        startTime: null,
        elapsedSeconds: 0,
        projectId: null,
        taskId: null,
        description: null,
    })

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("crm-timer")
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                // If it was running, calculate elapsed time since last save/start
                if (parsed.isRunning && parsed.startTime) {
                    const now = Date.now()
                    const additionalSeconds = Math.floor((now - parsed.lastUpdated) / 1000)
                    setTimerState({
                        ...parsed,
                        elapsedSeconds: parsed.elapsedSeconds + additionalSeconds,
                    })
                } else {
                    setTimerState(parsed)
                }
            } catch (e) {
                console.error("Failed to parse timer state", e)
            }
        }
    }, [])

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem("crm-timer", JSON.stringify({ ...timerState, lastUpdated: Date.now() }))
    }, [timerState])

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

    const startTimer = (projectId: string, taskId?: string, description?: string) => {
        setTimerState({
            isRunning: true,
            startTime: Date.now(),
            elapsedSeconds: 0,
            projectId,
            taskId: taskId || null,
            description: description || null,
        })
    }

    const stopTimer = () => {
        // Here functionality would be added to save the log to the DB
        setTimerState({
            isRunning: false,
            startTime: null,
            elapsedSeconds: 0,
            projectId: null,
            taskId: null,
            description: null,
        })
        localStorage.removeItem("crm-timer")
    }

    const pauseTimer = () => {
        setTimerState((prev) => ({ ...prev, isRunning: false }))
    }

    const resumeTimer = () => {
        setTimerState((prev) => ({ ...prev, isRunning: true }))
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
