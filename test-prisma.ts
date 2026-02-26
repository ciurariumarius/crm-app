import { PrismaClient } from '@prisma/client'; new PrismaClient({ datasources: { db: { url: 'file:./dev.db' } } });
