"use client"

import * as React from "react"
import { resolveResponsiveProfile, type ResponsiveProfile } from "@/lib/ui/responsive"

function getClientSnapshot(): ResponsiveProfile {
  if (typeof window === "undefined") return "desktop"
  return resolveResponsiveProfile(window.innerWidth)
}

function getServerSnapshot(): ResponsiveProfile {
  return "desktop"
}

function subscribe(onStoreChange: () => void) {
  const handler = () => onStoreChange()
  window.addEventListener("resize", handler, { passive: true })
  window.addEventListener("orientationchange", handler, { passive: true })
  return () => {
    window.removeEventListener("resize", handler)
    window.removeEventListener("orientationchange", handler)
  }
}

export function useResponsiveProfile() {
  return React.useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}

