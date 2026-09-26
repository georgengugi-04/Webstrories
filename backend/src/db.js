const { PrismaClient } = require("@prisma/client");

// Reuse a single Prisma instance across the app (and across hot reloads in dev).
const prisma = global.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") global.__prisma = prisma;

module.exports = prisma;
