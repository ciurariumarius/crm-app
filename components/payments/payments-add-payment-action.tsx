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
  if (mobile) {
    return (
      <AddPartnerPaymentDialog
        partners={partners}
        label="Add"
        showLabelOnMobile
        className="!h-10 !w-auto !min-w-[132px] !rounded-[18px] !px-3.5 !gap-1.5 !text-white"
      />
    )
  }

  return <AddPartnerPaymentDialog partners={partners} />
}

