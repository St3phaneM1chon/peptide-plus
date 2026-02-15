/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.AZURE_DATABASE_URL } },
});
async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, emailVerified: true }
  });
  console.log("Users in Azure DB:", users.length);
  for (const u of users) {
    const verified = u.emailVerified ? "YES" : "NO";
    console.log("  " + u.role + " | " + u.email + " | " + (u.name || "no name") + " | verified: " + verified);
  }
}
main().then(() => prisma.$disconnect());
