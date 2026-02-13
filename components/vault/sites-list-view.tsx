"use client"

import * as React from "react"
import Link from "next/link"
import { Globe, ExternalLink } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"

interface SitesListViewProps {
    sites: any[]
    partnerId: string
}

export function SitesListView({ sites, partnerId }: SitesListViewProps) {
    const [selectedSite, setSelectedSite] = React.useState<any>(null)

    return (
        <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sites.map((site) => (
                    <div
                        key={site.id}
                        onClick={() => setSelectedSite(site)}
                        className="cursor-pointer h-full transition-transform hover:scale-[1.02]"
                    >
                        <Card className="h-full hover:bg-muted/50 transition-colors">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    {site.domainName}
                                </CardTitle>
                                <CardDescription>
                                    {site._count?.projects || 0} Active Projects
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {site.driveLink && (
                                    <div
                                        className="flex items-center text-xs text-blue-500 hover:underline"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            window.open(site.driveLink, '_blank')
                                        }}
                                    >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Drive Folder
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ))}
                {sites.length === 0 && (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                        No sites found for this partner. Add their first website.
                    </div>
                )}
            </div>

            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col gap-0 border-l border-border bg-background shadow-xl">
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => {
                                // Update local state to reflect changes immediately
                                setSelectedSite({ ...selectedSite, ...updated })
                                // You might want to update the list here too via a callback or router refresh
                            }}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </>
    )
}
