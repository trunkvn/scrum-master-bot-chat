const prisma = require("./prisma");

const commentRepo = {
  async create(cardId, authorId, content) {
    return prisma.comment.create({
      data: { cardId, authorId, content },
      include: { author: true },
    });
  },

  async findByCard(cardId, limit = 10) {
    return prisma.comment.findMany({
      where: { cardId },
      include: { author: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};

module.exports = commentRepo;
