export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean) {
    const scriptSrc = isDevelopment
        ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
        : `'self' 'nonce-${nonce}' 'strict-dynamic'`

    return [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "object-src 'none'",
        `script-src ${scriptSrc}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://docs.google.com https://script.google.com",
        "worker-src 'self' blob:",
    ].join("; ")
}
