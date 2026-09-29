"use client"

import * as React from "react"
import { ExternalLink, Pencil, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DomainFavicon } from "@/components/domains/domain-favicon"
import { DeleteSiteButton } from "@/components/vault/delete-site-button"
import { SidePanelMetaBar } from "@/components/ui/side-panel-primitives"
import { refreshSiteFavicon, updateSiteDetails } from "@/lib/actions/sites"
import { formatRelativeDate } from "@/lib/utils"

type SiteSheetItem = {
    id: string
    partnerId: string
    name: string | null
    domainName: string
    faviconHash?: string | null
    createdAt: Date
    updatedAt: Date
    partner?: { id: string; name: string }
    _count?: { projects: number }
}

interface SiteSheetContentProps {
    site: SiteSheetItem
    onUpdate?: (updatedSite: SiteSheetItem) => void
    onClose?: () => void
}

export function SiteSheetContent({ site, onUpdate, onClose }: SiteSheetContentProps) {
    const [domainName, setDomainName] = React.useState(site.domainName)
    const [displayName, setDisplayName] = React.useState(site.name || "")
    const [faviconHash, setFaviconHash] = React.useState(site.faviconHash || null)
    const [editingDomain, setEditingDomain] = React.useState(false)
    const [saving, setSaving] = React.useState(false)
    const [refreshingFavicon, setRefreshingFavicon] = React.useState(false)

    React.useEffect(() => {
        setDomainName(site.domainName)
        setDisplayName(site.name || "")
        setFaviconHash(site.faviconHash || null)
    }, [site])

    const save = async (next: { domainName?: string; name?: string }) => {
        if (saving) return
        const cleanDomain = (next.domainName ?? domainName).trim()
        const cleanName = (next.name ?? displayName).trim()
        if (cleanDomain === site.domainName && cleanName === (site.name || "")) return

        setSaving(true)
        try {
            const result = await updateSiteDetails(site.id, { domainName: cleanDomain, name: cleanName })
            if (!result.success) {
                toast.error(result.error || "Failed to save domain")
                setDomainName(site.domainName)
                setDisplayName(site.name || "")
                return
            }
            if (result.warning) toast.warning(result.warning.message)
            else toast.success("Domain saved")
            setFaviconHash(result.faviconHash || null)
            const updated = { ...site, domainName: cleanDomain, name: cleanName || null, faviconHash: result.faviconHash || null }
            onUpdate?.(updated)
        } catch {
            toast.error("Failed to save domain")
        } finally {
            setSaving(false)
        }
    }

    const refreshFavicon = async () => {
        setRefreshingFavicon(true)
        try {
            const result = await refreshSiteFavicon(site.id)
            if (!result.success) {
                toast.error(result.error || "Failed to refresh favicon")
                return
            }
            if (result.warning) toast.warning(result.warning.message)
            else toast.success("Favicon refreshed")
            setFaviconHash(result.faviconHash || null)
            onUpdate?.({ ...site, faviconHash: result.faviconHash || null })
        } catch {
            toast.error("Failed to refresh favicon")
        } finally {
            setRefreshingFavicon(false)
        }
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            <div className="flex items-center justify-end gap-1 border-b border-[var(--line-subtle)] px-5 py-3">
                <Button type="button" variant="ghost" size="icon" onClick={() => void refreshFavicon()} disabled={refreshingFavicon} className="h-9 w-9 rounded-lg" aria-label="Refresh favicon" title="Refresh favicon">
                    <RefreshCw className={`h-4 w-4 ${refreshingFavicon ? "animate-spin" : ""}`} />
                </Button>
                <DeleteSiteButton siteId={site.id} iconOnly onDeleted={onClose} />
                {onClose ? <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-lg" aria-label="Close domain"><X className="h-5 w-5" /></Button> : null}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="mx-auto max-w-lg space-y-8">
                    <div className="flex items-start gap-4">
                        <DomainFavicon siteId={site.id} domain={domainName} faviconHash={faviconHash} className="h-14 w-14 rounded-xl" imageClassName="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                            {editingDomain ? (
                                <Input
                                    value={domainName}
                                    onChange={(event) => setDomainName(event.target.value)}
                                    onBlur={() => { setEditingDomain(false); void save({ domainName }) }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") { setEditingDomain(false); void save({ domainName }) }
                                        if (event.key === "Escape") { setDomainName(site.domainName); setEditingDomain(false) }
                                    }}
                                    className="h-auto border-0 bg-transparent p-0 text-xl font-bold shadow-none focus-visible:ring-0"
                                    autoFocus
                                />
                            ) : (
                                <div className="flex items-start gap-2">
                                    <h1 className="min-w-0 flex-1 break-words text-xl font-bold tracking-tight text-[var(--text-primary)]">{domainName}</h1>
                                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => setEditingDomain(true)} aria-label="Edit domain"><Pencil className="h-3.5 w-3.5" /></Button>
                                </div>
                            )}
                            <a href={`https://${domainName}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
                                Open website <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        </div>
                    </div>

                    <div className="grid gap-5 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-low)] p-4">
                        <label className="space-y-1.5">
                            <span className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">Display name</span>
                            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} onBlur={() => void save({ name: displayName })} placeholder="Optional name" className="h-10 bg-[var(--surface-lowest)]" />
                        </label>
                        <DetailRow label="Partner" value={site.partner?.name || "—"} />
                        <DetailRow label="Projects" value={String(site._count?.projects || 0)} />
                    </div>

                    <SidePanelMetaBar
                        entityLabel="Domain ID"
                        entityId={site.id.slice(0, 8)}
                        createdAt={formatRelativeDate(site.createdAt)}
                        updatedAt={formatRelativeDate(site.updatedAt)}
                    />
                </div>
            </div>
        </div>
    )
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return <div className="flex items-center justify-between gap-4 border-t border-[var(--line-subtle)] pt-4"><span className="text-sm text-[var(--text-secondary)]">{label}</span><span className="truncate text-sm font-semibold text-[var(--text-primary)]">{value}</span></div>
}
