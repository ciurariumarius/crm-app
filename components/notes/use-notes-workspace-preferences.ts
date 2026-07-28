"use client"

import * as React from "react"

export type NoteSort = "modified" | "created" | "title"
export type NoteListMode = "list" | "gallery"

export function useNotesWorkspacePreferences() {
  const [sidebarWidth, setSidebarWidth] = React.useState(236)
  const [listWidth, setListWidth] = React.useState(336)
  const [listMode, setListMode] = React.useState<NoteListMode>("list")
  const [noteSort, setNoteSort] = React.useState<NoteSort>("modified")
  const hydratedRef = React.useRef(false)

  React.useEffect(() => {
    const storedSidebarWidth = Number(window.localStorage.getItem("notes.sidebarWidth"))
    const storedListWidth = Number(window.localStorage.getItem("notes.listWidth"))
    const storedListMode = window.localStorage.getItem("notes.listMode")
    const storedSort = window.localStorage.getItem("notes.sort")

    if (Number.isFinite(storedSidebarWidth)) {
      setSidebarWidth(Math.min(320, Math.max(200, storedSidebarWidth)))
    }
    if (Number.isFinite(storedListWidth)) {
      setListWidth(Math.min(440, Math.max(280, storedListWidth)))
    }
    if (storedListMode === "list" || storedListMode === "gallery") {
      setListMode(storedListMode)
    }
    if (storedSort === "modified" || storedSort === "created" || storedSort === "title") {
      setNoteSort(storedSort)
    }
    hydratedRef.current = true
  }, [])

  React.useEffect(() => {
    if (!hydratedRef.current) return
    window.localStorage.setItem("notes.sidebarWidth", String(sidebarWidth))
  }, [sidebarWidth])

  React.useEffect(() => {
    if (!hydratedRef.current) return
    window.localStorage.setItem("notes.listWidth", String(listWidth))
  }, [listWidth])

  React.useEffect(() => {
    if (!hydratedRef.current) return
    window.localStorage.setItem("notes.listMode", listMode)
  }, [listMode])

  React.useEffect(() => {
    if (!hydratedRef.current) return
    window.localStorage.setItem("notes.sort", noteSort)
  }, [noteSort])

  return {
    sidebarWidth,
    setSidebarWidth,
    listWidth,
    setListWidth,
    listMode,
    setListMode,
    noteSort,
    setNoteSort,
  }
}
