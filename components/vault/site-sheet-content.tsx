"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Site } from "@prisma/client"
import { Copy, ExternalLink, Globe, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { updateSiteDetails } from "@/lib/actions/sites"
import { normalizeExternalHttpUrl } from "@/lib/external-url"
import { formatRelativeDate } from "@/lib/utils"
import { DeleteSiteButton } from "@/components/vault/delete-site-button"
import { SidePanelDangerZone, SidePanelMetaBar, SidePanelSectionTitle } from "@/components/ui/side-panel-primitives"

interface SiteSheetContentProps {
    site: Site & { partner?: { id: string; name: string } }
    onUpdate?: (updatedSite: Site & { partner?: { id: string; name: string } }) => void
    onClose?: () => void
}

function normalizeDomain(domain: string | null | undefined) {
    return (domain || "").trim().replace(/^https?:\/\//, "").split("/")[0]
}

function getFaviconCandidates(domain: string | null | undefined, storedFaviconUrl?: string | null) {
    const normalized = normalizeDomain(domain)
    if (!normalized) return storedFaviconUrl ? [storedFaviconUrl] : []
    return [
        ...(storedFaviconUrl ? [storedFaviconUrl] : []),
        `https://${normalized}/favicon.ico`,
    ]
}

function getDomainInitials(domain: string | null | undefined) {
    const normalized = normalizeDomain(domain)
    if (!normalized) return "??"
    const token = normalized.split(".")[0] || normalized
    return token.slice(0, 2).toUpperCase()
}

function SiteFaviconTile({
    domain,
    faviconUrl,
}: {
    domain: string | null | undefined
    faviconUrl?: string | null
}) {
    const [failed, setFailed] = useState(false)
    const [candidateIndex, setCandidateIndex] = useState(0)
    const candidates = useMemo(() => getFaviconCandidates(domain, faviconUrl), [domain, faviconUrl])
    const activeFaviconUrl = candidates[candidateIndex] || null
    const fallback = getDomainInitials(domain)

    return (
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-low)]">
            {!failed && activeFaviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={activeFaviconUrl}
                    alt=""
                    className="h-8 w-8 rounded-md object-contain"
                    loading="lazy"
                    onLoad={(event) => {
                        const { naturalWidth, naturalHeight } = event.currentTarget
                        if (naturalWidth < 24 || naturalHeight < 24) {
                            if (candidateIndex < candidates.length - 1) {
                                setCandidateIndex((prev) => prev + 1)
                                return
                            }
                            setFailed(true)
                        }
                    }}
                    onError={() => {
                        if (candidateIndex < candidates.length - 1) {
                            setCandidateIndex((prev) => prev + 1)
                            return
                        }
                        setFailed(true)
                    }}
                />
            ) : (
                <span className="text-[11px] font-extrabold tracking-wide text-[var(--text-primary)]">{fallback}</span>
            )}
        </span>
    )
}

export function SiteSheetContent({ site, onUpdate, onClose }: SiteSheetContentProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: site.name || "",
        domainName: site.domainName || "",
        gtmId: site.gtmId || "",
        googleAdsId: site.googleAdsId || "",
        driveLink: site.driveLink || "",
        marketingVault: site.marketingVault || "",
    })
    const safeDriveLink = normalizeExternalHttpUrl(formData.driveLink)

    // Parse marketing vault
    const [marketingData, setMarketingData] = useState<{
        headlines: string
        brandNotes: string
        competitors: string
    }>(() => {
        try {
            const parsed = site.marketingVault ? JSON.parse(site.marketingVault) : {}
            return {
                headlines: Array.isArray(parsed.headlines) ? parsed.headlines.join("\n") : parsed.headlines || "",
                brandNotes: parsed.brandNotes || "",
                competitors: Array.isArray(parsed.competitors) ? parsed.competitors.join("\n") : parsed.competitors || "",
            }
        } catch {
            return { headlines: "", brandNotes: "", competitors: "" }
        }
    })

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.info("Copied to clipboard")
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            // Prepare marketing vault JSON
            const vaultJson = JSON.stringify({
                headlines: marketingData.headlines.split("\n").filter(Boolean),
                brandNotes: marketingData.brandNotes,
                competitors: marketingData.competitors.split("\n").filter(Boolean),
            })

            await updateSiteDetails(site.id, {
                ...formData,
                marketingVault: vaultJson,
            })
            toast.success("Saved successfully!")
            if (onUpdate) {
                onUpdate({ ...site, ...formData, marketingVault: vaultJson })
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to save.")
        } finally {
            setLoading(false)
        }
    }

    const [isEditingDomain, setIsEditingDomain] = useState(false)

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-background">
            <div className="absolute right-8 top-8 z-30 flex items-center gap-2">
                {onClose && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-10 w-10 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                        aria-label="Close site"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                )}
            </div>
            {/* Header / Title Area */}
            <div className="flex-1 overflow-y-auto px-8 pb-6 pt-10">
                <div className="mx-auto max-w-[980px] space-y-4 pb-12 pr-12">
                    <div className="space-y-3 pr-4 pt-1 pb-1">
                        {isEditingDomain ? (
                            <Input
                                value={formData.domainName}
                                onChange={(e) => setFormData({ ...formData, domainName: e.target.value })}
                                onBlur={() => {
                                    setIsEditingDomain(false)
                                    handleSave()
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsEditingDomain(false)
                                        handleSave()
                                    }
                                    if (e.key === 'Escape') {
                                        setFormData({ ...formData, domainName: site.domainName || "" })
                                        setIsEditingDomain(false)
                                    }
                                }}
                                className="text-2xl font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)] md:text-3xl h-auto p-0 border-none bg-transparent focus-visible:ring-0"
                                autoFocus
                            />
                        ) : (
                            <div className="group flex w-full items-start gap-3 py-1">
                                <SiteFaviconTile
                                    key={`${normalizeDomain(formData.domainName)}:${site.faviconUrl || ""}`}
                                    domain={formData.domainName}
                                    faviconUrl={site.faviconUrl}
                                />
                                <div className="min-w-0 flex-1 pt-1">
                                    <h1 className="text-xl font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)] md:text-2xl">
                                        {formData.domainName}
                                    </h1>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsEditingDomain(true)}
                                    className="mt-0.5 h-8 w-8 shrink-0 rounded-lg text-[var(--text-muted)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="h-px w-full bg-[var(--line-subtle)]" />

                    <div className="space-y-4">
                        <SidePanelSectionTitle title="Tracking IDs" />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                            <Label className="ui-overline text-[var(--text-muted)]">GTM ID</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={formData.gtmId}
                                    onChange={(e) => setFormData({ ...formData, gtmId: e.target.value })}
                                    onBlur={handleSave}
                                    className="h-9 bg-[var(--surface-lowest)] border-[var(--line-subtle)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] transition-colors font-mono text-xs shadow-sm rounded-xl"
                                    placeholder="GTM-XXXXXX"
                                />
                                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-[var(--surface-low)] rounded-xl" onClick={() => handleCopy(formData.gtmId)}>
                                    <Copy className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="ui-overline text-[var(--text-muted)]">Ads ID</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={formData.googleAdsId}
                                    onChange={(e) => setFormData({ ...formData, googleAdsId: e.target.value })}
                                    onBlur={handleSave}
                                    className="h-9 bg-[var(--surface-lowest)] border-[var(--line-subtle)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] transition-colors font-mono text-xs shadow-sm rounded-xl"
                                    placeholder="123-456-7890"
                                />
                                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-[var(--surface-low)] rounded-xl" onClick={() => handleCopy(formData.googleAdsId)}>
                                    <Copy className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-1 col-span-full">
                            <Label className="ui-overline text-[var(--text-muted)]">Drive folder</Label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                                        <Globe className="h-3.5 w-3.5" />
                                    </div>
                                    <Input
                                        value={formData.driveLink}
                                        onChange={(e) => setFormData({ ...formData, driveLink: e.target.value })}
                                        onBlur={handleSave}
                                        className="h-9 bg-[var(--surface-lowest)] border-[var(--line-subtle)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] transition-colors text-xs shadow-sm rounded-xl pl-9"
                                        placeholder="https://drive.google.com/..."
                                    />
                                </div>
                                {safeDriveLink && (
                                    <Link href={safeDriveLink} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-[var(--surface-lowest)] border border-[var(--line-subtle)] hover:bg-[var(--surface-low)] rounded-xl text-[var(--text-muted)] hover:text-blue-600 transition-all shadow-sm">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                    </div>

                    <Tabs defaultValue="marketing" className="w-full pt-4">
                        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-[var(--surface-low)] p-1">
                            <TabsTrigger value="marketing" className="rounded-lg data-[state=active]:bg-[var(--surface-lowest)] data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-tight">Marketing Hub</TabsTrigger>
                            <TabsTrigger value="technical" className="rounded-lg data-[state=active]:bg-[var(--surface-lowest)] data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-tight">Raw Data</TabsTrigger>
                        </TabsList>

                        <TabsContent value="marketing" className="space-y-5 pt-6 animate-in slide-in-from-bottom-2 duration-300">
                            <SidePanelSectionTitle title="Marketing hub" />
                            <div className="space-y-2">
                                <Label className="ui-overline text-[var(--text-secondary)]">Headlines / ad copy</Label>
                                <Textarea
                                    className="min-h-[120px] bg-[var(--surface-lowest)] border-[var(--line-subtle)] focus-visible:ring-1 rounded-2xl shadow-sm text-sm"
                                    value={marketingData.headlines}
                                    onChange={(e) => setMarketingData({ ...marketingData, headlines: e.target.value })}
                                    onBlur={handleSave}
                                    placeholder="Enter headlines (one per line)..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="ui-overline text-[var(--text-secondary)]">Brand voice & notes</Label>
                                <Textarea
                                    className="min-h-[100px] bg-[var(--surface-lowest)] border-[var(--line-subtle)] focus-visible:ring-1 rounded-2xl shadow-sm text-sm"
                                    value={marketingData.brandNotes}
                                    onChange={(e) => setMarketingData({ ...marketingData, brandNotes: e.target.value })}
                                    onBlur={handleSave}
                                    placeholder="Target audience, tone, key selling points..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="ui-overline text-[var(--text-secondary)]">Competitor intelligence</Label>
                                <Textarea
                                    className="min-h-[100px] bg-[var(--surface-lowest)] border-[var(--line-subtle)] focus-visible:ring-1 rounded-2xl shadow-sm text-sm"
                                    value={marketingData.competitors}
                                    onChange={(e) => setMarketingData({ ...marketingData, competitors: e.target.value })}
                                    onBlur={handleSave}
                                    placeholder="Competitor URLs and notes..."
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="technical" className="pt-6">
                            <div className="p-8 bg-[var(--surface-low)] rounded-2xl border border-[var(--line-subtle)] border-dashed ui-text-caption text-[var(--text-muted)] text-center">
                                Raw JSON data view coming soon.
                            </div>
                        </TabsContent>
                    </Tabs>

                    <SidePanelDangerZone
                        title="Danger zone"
                        description="Delete this domain and all related references."
                        className="border-[var(--line-subtle)]"
                    >
                        <DeleteSiteButton siteId={site.id} partnerId={site.partnerId} />
                    </SidePanelDangerZone>

                    <SidePanelMetaBar
                        className="mt-2 pt-6"
                        entityLabel="Domain ID"
                        entityId={site.id.slice(0, 8)}
                        createdAt={formatRelativeDate(site.createdAt)}
                        updatedAt={site.updatedAt ? formatRelativeDate(site.updatedAt) : undefined}
                    />
                </div>
            </div>
            
            <div className="p-4 border-t bg-[var(--surface-lowest)] flex justify-end gap-3 px-8">
                <Button onClick={handleSave} disabled={loading} size="sm" className="rounded-full px-6 font-bold shadow-sm">
                    {loading ? "Saving..." : "Save Changes"}
                </Button>
            </div>
        </div>
    )
}
