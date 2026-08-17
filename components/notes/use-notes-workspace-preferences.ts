"use client"

import * as React from "react"

export type NoteSort = "modified" | "created" | "title"
export function useNotesWorkspacePreferences() {
  const [sidebarWidth, setSidebarWidth] = React.useState(236)
  const [listWidth, setListWidth] = React.useState(336)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [listCollapsed, setListCollapsed] = React.useState(false)
  const [noteSort, setNoteSort] = React.useState<NoteSort>("modified")
  const hydratedRef = React.useRef(false)

  React.useEffect(() => {
    const storedSidebarWidth = Number(window.localStorage.getItem("notes.sidebarWidth"))
    const storedListWidth = Number(window.localStorage.getItem("notes.listWidth"))
    const storedSidebarCollapsed = window.localStorage.getItem("notes.sidebarCollapsed")
    const storedListCollapsed = window.localStorage.getItem("notes.listCollapsed")
    const storedSort = window.localStorage.getItem("notes.sort")

    if (Number.isFinite(storedSidebarWidth)) {
      setSidebarWidth(Math.min(320, Math.max(200, storedSidebarWidth)))
    }
    if (Number.isFinite(storedListWidth)) {
      setListWidth(Math.min(440, Math.max(280, storedListWidth)))
    }
    setSidebarCollapsed(storedSidebarCollapsed === "true")
    setListCollapsed(storedListCollapsed === "true")
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
    window.localStorage.setItem("notes.sidebarCollapsed", String(sidebarCollapsed))
  }, [sidebarCollapsed])

  React.useEffect(() => {
    if (!hydratedRef.current) return
    window.localStorage.setItem("notes.listCollapsed", String(listCollapsed))
  }, [listCollapsed])

  React.useEffect(() => {
    if (!hydratedRef.current) return
    window.localStorage.setItem("notes.sort", noteSort)
  }, [noteSort])

  return {
    sidebarWidth,
    setSidebarWidth,
    listWidth,
    setListWidth,
    sidebarCollapsed,
    setSidebarCollapsed,
    listCollapsed,
    setListCollapsed,
    noteSort,
    setNoteSort,
  }
}
