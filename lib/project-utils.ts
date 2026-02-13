import { format } from "date-fns"

export const getProjectDisplayName = (project: any) => {
    if (!project) return "Unknown Project"
    if (project.name) return project.name

    const serviceNames = project.services?.map((s: any) => s.serviceName).join(" & ") || "Generic Project"
    const base = `${project.site?.domainName || "Unknown Site"} - ${serviceNames}`

    if (project.services?.[0]?.isRecurring) {
        return `${base} - ${format(new Date(), "MMMM")}`
    }
    return base
}
