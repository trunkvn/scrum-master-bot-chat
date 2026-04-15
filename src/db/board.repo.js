const prisma = require("./prisma");
const config = require("../config");

const boardRepo = {
  async create(name, ownerId, chatId = null, topicId = null, description = null) {
    // Create board with default lists
    return prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          name,
          description,
          chatId: chatId?.toString(),
          topicId: topicId?.toString(),
          ownerId,
        },
      });

      // Create default lists with positions
      const defaultLists = config.app.defaultLists;
      for (let i = 0; i < defaultLists.length; i++) {
        await tx.list.create({
          data: {
            name: defaultLists[i],
            position: i,
            boardId: board.id,
          },
        });
      }

      return board;
    });
  },

  async updateTopicId(boardId, topicId) {
    return prisma.board.update({
      where: { id: boardId },
      data: { topicId: topicId?.toString() },
    });
  },

  async findByChatId(chatId) {
    return prisma.board.findFirst({
      where: { chatId: chatId.toString(), isActive: true },
      include: {
        lists: { orderBy: { position: "asc" }, include: { cards: true } },
      },
    });
  },

  async findById(id) {
    return prisma.board.findUnique({
      where: { id },
      include: {
        lists: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
              include: { assignee: true, labels: { include: { label: true } } },
            },
          },
        },
        labels: true,
      },
    });
  },

  async findByOwner(ownerId) {
    return prisma.board.findMany({
      where: { ownerId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
  },

  async findAll() {
    return prisma.board.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
  },

  /**
   * Get or create default board for a chat
   */
  async getOrCreateForChat(chatId, chatTitle, ownerId, topicId = null) {
    let board = await this.findByChatId(chatId);
    if (!board) {
      board = await this.create(
        chatTitle || "Main Board",
        ownerId,
        chatId,
        topicId
      );
      // Re-fetch with full relations
      board = await this.findById(board.id);
    } else if (topicId && board.topicId !== topicId.toString()) {
      // Sync topicId if provided and different
      board = await this.updateTopicId(board.id, topicId);
    }
    return board;
  },
};

module.exports = boardRepo;
