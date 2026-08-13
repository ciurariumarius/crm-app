"use client"

import dynamic from "next/dynamic"

type PartnerOption = {
  id: string
  name: string
}

type ServiceOption = {
  id: string
  name: string
}

const AddPartnerPaymentDialog = dynamic(
  () => import("@/components/payments/add-partner-payment-dialog").then((module) => module.AddPartnerPaymentDialog),
  { ssr: false }
)

export function PaymentsAddPaymentAction({
  partners,
  services,
  mobile = false,
}: {
  partners: PartnerOption[]
  services: ServiceOption[]
  mobile?: boolean
}) {
  const compactClassName = "!h-11 !w-auto !min-w-0 !rounded-[20px] !px-8 !gap-2 !text-white xl:!px-9"

  if (mobile) {
    return (
      <AddPartnerPaymentDialog
        partners={partners}
        services={services}
        label="Add"
        showLabelOnMobile
        className={compactClassName}
      />
    )
  }

  return (
    <AddPartnerPaymentDialog
      partners={partners}
      services={services}
      label="Add"
      showLabelOnMobile
      className={compactClassName}
    />
  )
}
