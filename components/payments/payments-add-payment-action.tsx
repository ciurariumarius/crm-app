"use client"

import dynamic from "next/dynamic"

type PartnerOption = {
  id: string
  name: string
}

const AddPartnerPaymentDialog = dynamic(
  () => import("@/components/payments/add-partner-payment-dialog").then((module) => module.AddPartnerPaymentDialog),
  { ssr: false }
)

export function PaymentsAddPaymentAction({
  partners,
  mobile = false,
}: {
  partners: PartnerOption[]
  mobile?: boolean
}) {
  const compactClassName = "!h-10 !w-auto !min-w-0 !rounded-[28px] !px-8 !gap-2 !text-white md:!px-9"

  if (mobile) {
    return (
      <AddPartnerPaymentDialog
        partners={partners}
        label="Add"
        showLabelOnMobile
        className={compactClassName}
      />
    )
  }

  return <AddPartnerPaymentDialog partners={partners} label="Add" className={compactClassName} />
}
