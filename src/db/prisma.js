const { PrismaClient } = require("@prisma/client");

// Singleton pattern — avoid creating multiple Prisma instances
let prisma;

if (!global.__prisma) {
  global.__prisma = new PrismaClient({
    log: process.env.LOG_LEVEL === "debug" ? ["query", "warn", "error"] : ["warn", "error"],
  });
}
prisma = global.__prisma;

module.exports = prisma;
