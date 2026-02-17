import { GoogleAdsDashboard, AdsAccount } from "@/components/ppc/google-ads-dashboard"
import Papa from "papaparse"

async function getGoogleAdsData(): Promise<AdsAccount[]> {
    const SHEET_ID = "1xfyJoVmvgE_l3lxn4mNCHcZHCWF_ZCgaSCbGOz6L45o"
    const GID = "787963349"
    const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`

    try {
        const response = await fetch(CSV_URL, { next: { revalidate: 300 } }) // Cache for 5 mins
        const csvText = await response.text()

        const { data } = Papa.parse(csvText, { header: false })

        // Skip first 2 header rows
        const rows = data.slice(2) as string[][]

        return rows.map((row) => {
            // Filter out empty rows or rows without account name
            if (!row[1]) return null

            return {
                id: row[0],
                name: row[1],
                currency: row[2],
                status: row[3],
                yesterday: {
                    cost: row[4],
                    costDelta: row[5],
                    revenue: row[6],
                    roas: row[7],
                    roasDelta: row[8],
                    conversions: row[9]
                },
                last3Days: {
                    cost: row[10],
                    costDelta: row[11],
                    revenue: row[12],
                    roas: row[13],
                    roasDelta: row[14],
                    conversions: row[15]
                },
                last7Days: {
                    cost: row[16],
                    costDelta: row[17],
                    revenue: row[18],
                    roas: row[19],
                    roasDelta: row[20],
                    conversions: row[21]
                },
                last14Days: {
                    cost: row[22],
                    costDelta: row[23],
                    revenue: row[24],
                    roas: row[25],
                    roasDelta: row[26],
                    conversions: row[27]
                },
                last30Days: {
                    cost: row[28],
                    costDelta: row[29],
                    revenue: row[30],
                    roas: row[31],
                    roasDelta: row[32],
                    conversions: row[33]
                },
                last90Days: {
                    cost: row[34],
                    costDelta: row[35],
                    revenue: row[36],
                    roas: row[37],
                    roasDelta: row[38],
                    conversions: row[39]
                },
                link: row[40],
                dailyBudget: row[41],
                tRoas: row[42],
                tCpa: row[43]
            }
        }).filter(Boolean) as AdsAccount[]

    } catch (error) {
        console.error("Error fetching Google Ads data:", error)
        return []
    }
}

export default async function GoogleAdsPage() {
    const data = await getGoogleAdsData()

    return (
        <div className="h-full">
            <GoogleAdsDashboard accounts={data} />
        </div>
    )
}
