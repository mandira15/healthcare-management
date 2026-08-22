import { PrismaClient } from '@prisma/client';

// Singleton pattern: reuse the Prisma client across hot-reloads in Next.js dev mode.
// In production, module cache is stable so this effectively creates one client.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
