"use client"

import { useState } from "react"
import { Site } from "@prisma/client"
import { Copy, ExternalLink, Save, Globe } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateSiteDetails } from "@/lib/actions"
import { DeleteSiteButton } from "@/components/vault/delete-site-button"

export function SiteDetail({ site }: { site: Site }) {
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
        } catch (error) {
            console.error(error)
            toast.error("Failed to save.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start gap-8">
                <div className="flex-1 space-y-4">
                    <div className="space-y-1">
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            className="text-4xl font-black italic tracking-tighter border-none bg-transparent p-0 focus-visible:ring-0 placeholder:opacity-20 h-auto"
                            placeholder="Site Nickname (e.g. Meta Ads Account)"
                        />
                        <div className="flex items-center gap-2 group">
                            < Globe className="h-4 w-4 text-muted-foreground/40" />
                            <Input
                                value={formData.domainName}
                                onChange={(e) => setFormData({ ...formData, domainName: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                className="text-sm font-semibold text-muted-foreground border-none bg-transparent p-0 focus-visible:ring-0 h-6 w-full"
                                placeholder="domain.com"
                            />
                        </div>
                    </div>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="h-12 px-8 font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20"
                >
                    {loading ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Hub</>}
                </Button>
            </div>

            <Tabs defaultValue="technical" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="technical">Technical</TabsTrigger>
                    <TabsTrigger value="marketing">Marketing Hub</TabsTrigger>
                </TabsList>

                {/* Technical Tab */}
                <TabsContent value="technical">
                    <Card>
                        <CardHeader>
                            <CardTitle>Technical Assets</CardTitle>
                            <CardDescription>
                                Manage tracking IDs and external links.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="gtm">GTM Container ID</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="gtm"
                                        value={formData.gtmId}
                                        onChange={(e) => setFormData({ ...formData, gtmId: e.target.value })}
                                    />
                                    <Button variant="outline" size="icon" onClick={() => handleCopy(formData.gtmId)}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="ads">Google Ads ID</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="ads"
                                        value={formData.googleAdsId}
                                        onChange={(e) => setFormData({ ...formData, googleAdsId: e.target.value })}
                                    />
                                    <Button variant="outline" size="icon" onClick={() => handleCopy(formData.googleAdsId)}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="drive">Google Drive Folder</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="drive"
                                        value={formData.driveLink}
                                        onChange={(e) => setFormData({ ...formData, driveLink: e.target.value })}
                                    />
                                    {formData.driveLink && (
                                        <Button variant="outline" size="icon" asChild>
                                            <a href={formData.driveLink} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Marketing Tab */}
                <TabsContent value="marketing">
                    <Card>
                        <CardHeader>
                            <CardTitle>Marketing Vault</CardTitle>
                            <CardDescription>
                                Store headlines, copy, and competitor notes.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label>Headlines / Ad Copy (One per line)</Label>
                                <Textarea
                                    className="min-h-[150px]"
                                    value={marketingData.headlines}
                                    onChange={(e) => setMarketingData({ ...marketingData, headlines: e.target.value })}
                                    placeholder="Best headline ever..."
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Brand Notes / Guidelines</Label>
                                <Textarea
                                    className="min-h-[100px]"
                                    value={marketingData.brandNotes}
                                    onChange={(e) => setMarketingData({ ...marketingData, brandNotes: e.target.value })}
                                    placeholder="Tone of voice: Professional but friendly..."
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Competitors (One per line)</Label>
                                <Textarea
                                    className="min-h-[100px]"
                                    value={marketingData.competitors}
                                    onChange={(e) => setMarketingData({ ...marketingData, competitors: e.target.value })}
                                    placeholder="Competitor A..."
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card className="border-rose-200 bg-rose-50/30">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-rose-900">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                    <DeleteSiteButton siteId={site.id} partnerId={site.partnerId} />
                </CardContent>
            </Card>
        </div>
    )
}
