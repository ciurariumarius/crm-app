import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Sign In | Pixelist',
    description: 'Login to access the Pixelist CRM',
}

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {children}
        </div>
    )
}
