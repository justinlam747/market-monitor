import { PrismaClient } from "@prisma/client";

// Single shared Prisma client. Lazily constructed so importing modules in
// fixture/test mode (no DATABASE_URL) doesn't fail at import time.
let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
