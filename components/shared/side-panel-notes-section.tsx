"use client"

import * as React from "react"
import { CheckCircle2, Expand, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { SidePanelChip, SidePanelSectionTitle } from "@/components/ui/side-panel-primitives"
import { cn } from "@/lib/utils"

type SidePanelNotesSectionProps = {
    title: string
    statusLabel: string
    statusTone: "blue" | "emerald" | "amber" | "rose" | "slate"
    statusState?: "saving" | "ready" | "typing" | "saved" | "error"
    value: string
    onChange: (value: string) => void
    onBlur?: () => void
    uploadProjectId?: string
    onAddTemplate?: () => void
    onExpand?: () => void
    expandLabel?: string
    extraToolbarActions?: React.ReactNode
    icon?: React.ReactNode
    className?: string
    editorClassName?: string
    minHeightClassName?: string
}

function buildStatusIcon(state?: SidePanelNotesSectionProps["statusState"]) {
    if (state === "saving") return <Loader2 className="h-3.5 w-3.5 animate-spin" />
    if (state === "ready" || state === "saved") return <CheckCircle2 className="h-3.5 w-3.5" />
    return undefined
}

export function SidePanelNotesSection({
    title,
    icon,
    statusLabel,
    statusTone,
    statusState,
    value,
    onChange,
    onBlur,
    uploadProjectId,
    onAddTemplate,
    onExpand,
    expandLabel = "Open notes in full view",
    extraToolbarActions,
    className,
    editorClassName = "rounded-[22px] bg-[var(--surface-lowest)]",
    minHeightClassName = "h-[360px]",
}: SidePanelNotesSectionProps) {
    return (
        <section className={cn("space-y-3 border-t border-[var(--line-subtle)] pt-3", className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <SidePanelSectionTitle title={title} icon={icon} />
                <SidePanelChip
                    tone={statusTone}
                    icon={buildStatusIcon(statusState)}
                    label={statusLabel}
                />
            </div>

            <RichTextEditor
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                placeholder=""
                variant="plain"
                mode="document"
                notesMode
                className={editorClassName}
                minHeightClassName={minHeightClassName}
                uploadProjectId={uploadProjectId}
                toolbarActions={
                    <>
                        {onAddTemplate ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={onAddTemplate}
                                className="h-11 w-11 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] lg:h-8 lg:w-8"
                                aria-label="Add template"
                                title="Add template"
                            >
                                <Plus className="h-5 w-5 lg:h-4 lg:w-4" />
                            </Button>
                        ) : null}
                        {extraToolbarActions}
                        {onExpand ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={onExpand}
                                className="h-11 w-11 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] lg:h-8 lg:w-8"
                                aria-label={expandLabel}
                                title={expandLabel}
                            >
                                <Expand className="h-5 w-5 lg:h-4 lg:w-4" />
                            </Button>
                        ) : null}
                    </>
                }
            />
        </section>
    )
}
