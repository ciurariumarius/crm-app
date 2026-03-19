"use client"

import { Input } from "@/components/ui/input"
import { Search, Globe, FileCode, Zap } from "lucide-react"
import { Card } from "@/components/ui/card"

export function TechnicalIntegrationBar() {
    return (
        <Card className="p-4 border border-border bg-card/50 backdrop-blur-sm shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                    <Zap className="h-4 w-4" />
                </div>
                <h3 className="ui-overline text-muted-foreground">Rapid entry tools</h3>
            </div>

            <div className="space-y-3">
                {/* URL Sniffer */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="ui-overline text-muted-foreground">URL sniffer</label>
                        <span className="ui-text-caption text-indigo-500">Auto-detect</span>
                    </div>
                    <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                        <Input
                            placeholder="Paste project URL..."
                            className="pl-9 h-9 text-xs border-indigo-100 bg-background/50 focus:bg-background transition-colors"
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
                            className="pl-9 h-9 text-xs border-indigo-100 bg-background/50 focus:bg-background transition-colors"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-2 p-2 rounded-lg bg-indigo-50/50 border border-indigo-100/50">
                <p className="ui-text-caption leading-tight text-indigo-600">
                    Tip: Press <kbd className="px-1 py-0.5 rounded border border-indigo-200 bg-white shadow-sm font-sans mx-0.5">CMD+K</kbd> to trigger these tools anywhere.
                </p>
            </div>
        </Card>
    )
}
