const prisma = require("./prisma");

const userRepo = {
  /**
   * Find or create user from Telegram context
   */
  async upsert(telegramId, data) {
    return prisma.user.upsert({
      where: { telegramId: telegramId.toString() },
      update: { username: data.username, firstName: data.firstName },
      create: {
        telegramId: telegramId.toString(),
        username: data.username,
        firstName: data.firstName,
      },
    });
  },

  async findByTelegramId(telegramId) {
    return prisma.user.findUnique({
      where: { telegramId: telegramId.toString() },
    });
  },

  async findByUsername(username) {
    return prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: username } },
          { firstName: { contains: username } },
        ],
      },
    });
  },

  async findAll() {
    return prisma.user.findMany({ orderBy: { firstName: "asc" } });
  },
};

module.exports = userRepo;
