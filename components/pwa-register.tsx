"use client";

import { useEffect } from "react";

export function PWARegister() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => console.log("Service Worker registered"))
                .catch((err) => console.error("Service Worker registration failed", err));
        }
    }, []);

    return null;
}
