const LEGACY_AD_HOC_PAYMENT_DOMAIN = "ad-hoc-payments.local"

export function getLegacyAdHocPaymentDomain() {
    return LEGACY_AD_HOC_PAYMENT_DOMAIN
}

export function getPartnerAdHocPaymentDomain(partnerId: string) {
    const normalizedPartnerId = partnerId.trim().toLowerCase()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalizedPartnerId)) {
        throw new Error("A valid partner ID is required for the payment site")
    }

    return `ad-hoc-payments-${normalizedPartnerId}.local`
}
