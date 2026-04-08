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
  const compactClassName = "!h-10 !w-auto !min-w-0 !rounded-[16px] !px-2.5 !gap-1 !text-white md:!px-3"

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
