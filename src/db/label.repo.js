const prisma = require("./prisma");

const labelRepo = {
  async create(boardId, name, color = "blue") {
    return prisma.label.create({
      data: { name, color, boardId },
    });
  },

  async findByBoard(boardId) {
    return prisma.label.findMany({
      where: { boardId },
      orderBy: { name: "asc" },
    });
  },

  async addToCard(cardId, labelId) {
    return prisma.cardLabel.upsert({
      where: { cardId_labelId: { cardId, labelId } },
      create: { cardId, labelId },
      update: {},
    });
  },

  async removeFromCard(cardId, labelId) {
    return prisma.cardLabel.delete({
      where: { cardId_labelId: { cardId, labelId } },
    }).catch(() => null); // Ignore if not exists
  },

  async findOrCreate(boardId, name, color = "blue") {
    let label = await prisma.label.findFirst({
      where: { boardId, name: { equals: name } },
    });
    if (!label) {
      label = await this.create(boardId, name, color);
    }
    return label;
  },
};

module.exports = labelRepo;
