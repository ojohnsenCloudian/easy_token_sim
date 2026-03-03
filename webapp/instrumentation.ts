export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("./lib/prisma");

    // Create tables if they don't exist (idempotent migration for Docker startup)
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Customer" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "folderName" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Run" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "customerId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'running',
        "output" TEXT,
        "outputDir" TEXT,
        "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" DATETIME,
        CONSTRAINT "Run_customerId_fkey" FOREIGN KEY ("customerId")
          REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;

    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "Customer_folderName_key"
        ON "Customer"("folderName")
    `;
  }
}
