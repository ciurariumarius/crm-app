"use client"

import { useState } from "react"
import Link from "next/link"
import { Site } from "@prisma/client"
import { Copy, ExternalLink, Save, Globe, Users, Expand, MoreHorizontal, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateSiteDetails } from "@/lib/actions/sites"
import { DeleteSiteButton } from "@/components/vault/delete-site-button"

interface SiteSheetContentProps {
    site: Site & { partner?: { id: string; name: string } }
    onUpdate?: (updatedSite: Site) => void
}

export function SiteSheetContent({ site, onUpdate }: SiteSheetContentProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: site.name || "",
        domainName: site.domainName || "",
        gtmId: site.gtmId || "",
        googleAdsId: site.googleAdsId || "",
        driveLink: site.driveLink || "",
        marketingVault: site.marketingVault || "",
    })

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
                onUpdate({ ...site, ...formData, marketingVault: vaultJson } as any)
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to save.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background md:max-w-4xl w-full">
            {/* Header */}
            <div className="p-6 border-b bg-muted/20 relative shrink-0">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                            {site.partner && (
                                <>
                                    <Link href={`/vault/${site.partner.id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                                        <Users className="h-3 w-3" />
                                        {site.partner.name}
                                    </Link>
                                    <span className="opacity-30">/</span>
                                </>
                            )}
                            <span className="flex items-center gap-1 text-foreground">
                                <Globe className="h-3 w-3" />
                                {site.domainName}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            {site.partner && (
                                <Link
                                    href={`/vault/${site.partner.id}/${site.id}`}
                                    className="p-2 rounded-md hover:bg-muted transition-colors opacity-50 hover:opacity-100 hover:text-primary"
                                    title="Open Full Page"
                                >
                                    <Expand className="h-4 w-4" />
                                </Link>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            className="text-4xl font-black italic tracking-tighter border-none bg-transparent p-0 focus-visible:ring-0 placeholder:opacity-20 h-auto w-full"
                            placeholder="Site Nickname"
                        />
                        <div className="flex items-center gap-2">
                            <Globe className="h-3 w-3 text-muted-foreground/40" />
                            <Input
                                value={formData.domainName}
                                onChange={(e) => setFormData({ ...formData, domainName: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                className="text-sm font-medium text-muted-foreground border-none bg-transparent p-0 focus-visible:ring-0 h-auto w-full"
                                placeholder="domain.com"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Scroller */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Properties Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">GTM ID</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                value={formData.gtmId}
                                onChange={(e) => setFormData({ ...formData, gtmId: e.target.value })}
                                onBlur={handleSave}
                                className="h-8 bg-muted/20 border-transparent hover:border-border transition-colors font-mono text-xs"
                                placeholder="GTM-XXXXXX"
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleCopy(formData.gtmId)}>
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ads ID</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                value={formData.googleAdsId}
                                onChange={(e) => setFormData({ ...formData, googleAdsId: e.target.value })}
                                onBlur={handleSave}
                                className="h-8 bg-muted/20 border-transparent hover:border-border transition-colors font-mono text-xs"
                                placeholder="123-456-7890"
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleCopy(formData.googleAdsId)}>
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-1 col-span-full">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Drive Folder</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                value={formData.driveLink}
                                onChange={(e) => setFormData({ ...formData, driveLink: e.target.value })}
                                onBlur={handleSave}
                                className="h-8 bg-muted/20 border-transparent hover:border-border transition-colors text-xs"
                                placeholder="https://drive.google.com/..."
                            />
                            {formData.driveLink && (
                                <Link href={formData.driveLink} target="_blank" className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-primary">
                                    <ExternalLink className="h-3 w-3" />
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="marketing" className="w-full">
                    <TabsList className="bg-muted/30 p-1 rounded-xl w-full grid grid-cols-2">
                        <TabsTrigger value="marketing" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Marketing Hub</TabsTrigger>
                        <TabsTrigger value="technical" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Raw Data</TabsTrigger>
                    </TabsList>

                    <TabsContent value="marketing" className="space-y-4 pt-4 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">Headlines / Ad Copy</Label>
                            <Textarea
                                className="min-h-[120px] bg-muted/10 border-muted-foreground/10 focus-visible:ring-1"
                                value={marketingData.headlines}
                                onChange={(e) => setMarketingData({ ...marketingData, headlines: e.target.value })}
                                onBlur={handleSave}
                                placeholder="Enter headlines (one per line)..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">Brand Voice & Notes</Label>
                            <Textarea
                                className="min-h-[100px] bg-muted/10 border-muted-foreground/10 focus-visible:ring-1"
                                value={marketingData.brandNotes}
                                onChange={(e) => setMarketingData({ ...marketingData, brandNotes: e.target.value })}
                                onBlur={handleSave}
                                placeholder="Target audience, tone, key selling points..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">Competitor Intelligence</Label>
                            <Textarea
                                className="min-h-[100px] bg-muted/10 border-muted-foreground/10 focus-visible:ring-1"
                                value={marketingData.competitors}
                                onChange={(e) => setMarketingData({ ...marketingData, competitors: e.target.value })}
                                onBlur={handleSave}
                                placeholder="Competitor URLs and notes..."
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="technical" className="pt-4">
                        <div className="p-4 bg-muted/20 rounded-xl border border-dashed text-xs text-muted-foreground">
                            Raw JSON data view coming soon.
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Footer / Danger Zone */}
                <div className="pt-8 border-t border-dashed">
                    <div className="flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity">
                        <span className="text-xs text-rose-500 font-medium">Danger Zone</span>
                        <DeleteSiteButton siteId={site.id} partnerId={site.partnerId} />
                    </div>
                </div>
            </div>
            <div className="p-4 border-t bg-muted/10 flex justify-end">
                <Button onClick={handleSave} disabled={loading} size="sm">
                    {loading ? "Saving..." : "Save Changes"}
                </Button>
            </div>
        </div>
    )
}
