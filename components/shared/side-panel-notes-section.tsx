"use client"

import * as React from "react"
import { format } from "date-fns"
import { Expand } from "lucide-react"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { cn } from "@/lib/utils"

type SidePanelNotesSectionProps = {
    title?: string
    statusLabel?: string
    statusTone?: "blue" | "emerald" | "amber" | "rose" | "slate"
    statusState?: "saving" | "ready" | "typing" | "saved" | "error"
    value: string
    onChange: (value: string) => void
    onBlur?: () => void
    updatedAt?: Date | string | null
    uploadProjectId?: string
    imageUploadsDisabled?: boolean
    onAddTemplate?: () => void
    onExpand?: () => void
    expandLabel?: string
    extraToolbarActions?: React.ReactNode
    icon?: React.ReactNode
    className?: string
    editorClassName?: string
    minHeightClassName?: string
}

export function SidePanelNotesSection({
    value,
    onChange,
    onBlur,
    updatedAt,
    uploadProjectId,
    imageUploadsDisabled,
    onExpand,
    expandLabel = "Open notes in full view",
    extraToolbarActions,
    className,
    editorClassName = "rounded-[16px] bg-[var(--surface-lowest)]",
    minHeightClassName = "h-[360px]",
}: SidePanelNotesSectionProps) {
    const formattedDate = React.useMemo(() => {
        if (!updatedAt) return null
        try {
            const dateObj = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt
            if (Number.isNaN(dateObj.getTime())) return null
            return format(dateObj, "d MMMM yyyy 'at' HH:mm")
        } catch {
            return null
        }
    }, [updatedAt])

    return (
        <section className={cn("pt-0", className)}>
            <RichTextEditor
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                placeholder="Title"
                variant="plain"
                mode="document"
                panelStyle="borderless"
                documentLayout="left"
                documentWidth="full"
                documentPadding="compact"
                toolbarVisibility="always"
                toolbarPreset="minimal"
                toolbarTone="quiet"
                toolbarPinned
                notesMode
                notesAppearance="apple"
                documentHeader={
                    <div className="flex min-w-0 items-center justify-between gap-2 pb-0.5 pt-0">
                        {formattedDate ? (
                            <p className="min-w-0 truncate text-xs font-normal text-[var(--text-muted)]">
                                {formattedDate}
                            </p>
                        ) : <div />}
                        <div className="flex shrink-0 items-center gap-1.5">
                            {extraToolbarActions}
                            {onExpand ? (
                                <button
                                    type="button"
                                    onClick={onExpand}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                    aria-label={expandLabel}
                                    title={expandLabel}
                                >
                                    <Expand className="h-4 w-4" />
                                </button>
                            ) : null}
                        </div>
                    </div>
                }
                className={cn("h-full min-h-0", editorClassName)}
                minHeightClassName={minHeightClassName}
                uploadProjectId={uploadProjectId}
                imageUploadsDisabled={imageUploadsDisabled}
            />
        </section>
    )
}
