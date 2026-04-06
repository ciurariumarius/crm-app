"use client"

import dynamic from "next/dynamic"

type PaymentsPartnerOption = {
  id: string
  name: string
}

type PaymentsProjectOption = {
  id: string
  name?: string | null
  createdAt?: string | Date | null
  site?: {
    domainName?: string | null
  } | null
  services?: Array<{
    serviceName?: string | null
    isRecurring?: boolean | null
  }> | null
}

const PaymentsFilters = dynamic(
  () => import("@/components/payments/payments-filters").then((module) => module.PaymentsFilters),
  { ssr: false }
)

export function PaymentsFiltersClient({
  partners,
  projects,
  totalLogs,
}: {
  partners: PaymentsPartnerOption[]
  projects: PaymentsProjectOption[]
  totalLogs: number
}) {
  return <PaymentsFilters partners={partners} projects={projects} totalLogs={totalLogs} />
}

