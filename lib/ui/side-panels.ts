type SidePanelSize = "wide" | "default" | "compact" | "narrow"
type SidePanelDialogSize = "compact" | "default" | "wide"

const SIDE_PANEL_BASE =
    "w-screen max-w-none p-0 flex flex-col overflow-hidden border-none bg-[#f8fafc] shadow-[var(--shadow-drawer)] focus-visible:outline-none"

const SIDE_PANEL_SIZE_CLASS: Record<SidePanelSize, string> = {
    wide: "sm:w-full sm:max-w-[1020px] sm:rounded-l-[12px]",
    default: "sm:w-full sm:max-w-[900px] sm:rounded-l-[12px]",
    compact: "sm:w-full sm:max-w-[760px] sm:rounded-l-[12px]",
    narrow: "sm:w-full sm:max-w-xl sm:rounded-l-[12px]",
}

export function sidePanelClass(size: SidePanelSize = "default") {
    return `${SIDE_PANEL_BASE} ${SIDE_PANEL_SIZE_CLASS[size]}`
}

export const SIDE_PANEL_HEADER_CLASS = "px-8 pt-9 pb-6 relative bg-transparent"

const SIDE_PANEL_DIALOG_BASE =
    "overflow-hidden rounded-2xl border border-slate-200/80 bg-[#FCFCFB] p-0 shadow-[0_40px_100px_-45px_rgba(15,23,42,0.7)]"

const SIDE_PANEL_DIALOG_SIZE_CLASS: Record<SidePanelDialogSize, string> = {
    compact: "w-[95vw] max-w-[95vw] sm:w-[560px] sm:max-w-[560px]",
    default: "h-[92vh] w-[94vw] max-w-[94vw] sm:w-[65vw] sm:min-w-[65vw] sm:max-w-[65vw]",
    wide: "h-[92vh] w-[95vw] max-w-[95vw] sm:w-[78vw] sm:min-w-[78vw] sm:max-w-[78vw]",
}

export function sidePanelDialogContentClass(size: SidePanelDialogSize = "default") {
    return `${SIDE_PANEL_DIALOG_BASE} ${SIDE_PANEL_DIALOG_SIZE_CLASS[size]}`
}

export const SIDE_PANEL_DIALOG_HEADER_CLASS = "border-b border-slate-200/70 px-8 py-5"
