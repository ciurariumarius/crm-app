
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
    console.log('--- User Model Fields ---')
    try {
        const user = await prisma.user.findFirst()
        console.log('Keys on User object:', user ? Object.keys(user) : 'No user found')
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error"
        console.log('Error searching for user:', message)
    }
}
main()
