import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface DailyStatsProps {
    totalSeconds: number
    goalSeconds?: number // Optional daily goal, default 8h?
    partnerStats: { name: string; seconds: number; color: string }[]
}

export function DailyStats({ totalSeconds, goalSeconds = 28800, partnerStats }: DailyStatsProps) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const percentage = Math.min(100, (totalSeconds / goalSeconds) * 100)

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Progress</CardTitle>
                <div className="text-2xl font-bold">
                    {hours}h {minutes}m
                    <span className="text-muted-foreground text-sm font-normal ml-2">
                        / {Math.floor(goalSeconds / 3600)}h
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                <Progress value={percentage} className="h-4 mb-4" />
                <div className="space-y-2">
                    {partnerStats.map((stat) => (
                        <div key={stat.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${stat.color}`} />
                                <span className="font-medium">{stat.name}</span>
                            </div>
                            <span className="text-muted-foreground">
                                {Math.floor(stat.seconds / 3600)}h {Math.floor((stat.seconds % 3600) / 60)}m
                            </span>
                        </div>
                    ))}
                    {partnerStats.length === 0 && (
                        <div className="text-center text-muted-foreground text-xs py-2">
                            No time tracked today
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
