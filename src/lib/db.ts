import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Global database client singleton declaration.
 * In development mode, Next.js clears the Node.js module cache upon hot reload,
 * which would instantiate duplicate PrismaClient connections without this global cache.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Instantiates a new PrismaClient configured with the Prisma 7 LibSQL driver adapter.
 * Connects directly to the local SQLite database file (`dev.db`).
 */
function createPrismaClient(): PrismaClient {
  const dbPath = path.resolve(process.cwd(), "dev.db");
  const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
  return new PrismaClient({ adapter });
}

/**
 * Exported singleton instance of the PrismaClient.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Preserve connection across hot module reloads in non-production environments
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

