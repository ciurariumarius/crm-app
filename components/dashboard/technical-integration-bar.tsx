"use client"

import { Input } from "@/components/ui/input"
import { Search, Globe, FileCode, Zap } from "lucide-react"
import { Card } from "@/components/ui/card"

export function TechnicalIntegrationBar() {
    return (
        <Card className="p-4 border border-border bg-card/50 backdrop-blur-sm shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sidebar-accent)] text-[var(--brand-primary)]">
                    <Zap className="h-4 w-4" />
                </div>
                <h3 className="ui-overline text-muted-foreground">Rapid entry tools</h3>
            </div>

            <div className="space-y-3">
                {/* URL Sniffer */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="ui-overline text-muted-foreground">URL sniffer</label>
                        <span className="ui-text-caption text-[var(--brand-primary)]">Auto-detect</span>
                    </div>
                    <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                        <Input
                            placeholder="Paste project URL..."
                            className="h-9 border-[var(--line-subtle)] bg-background/50 pl-9 text-xs transition-colors focus:bg-background"
                        />
                    </div>
                </div>

                {/* Quick Site Note */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                        <label className="ui-overline text-muted-foreground">Quick site note</label>
                        <Search className="h-3 w-3 text-muted-foreground/30" />
                    </div>
                    <div className="relative">
                        <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                        <Input
                            placeholder="Search or add note..."
                            className="h-9 border-[var(--line-subtle)] bg-background/50 pl-9 text-xs transition-colors focus:bg-background"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-2 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-low)] p-2">
                <p className="ui-text-caption leading-tight text-[var(--text-secondary)]">
                    Tip: Press <kbd className="mx-0.5 rounded border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-1 py-0.5 font-sans shadow-[var(--shadow-apple)]">CMD+K</kbd> to trigger these tools anywhere.
                </p>
            </div>
        </Card>
    )
}
