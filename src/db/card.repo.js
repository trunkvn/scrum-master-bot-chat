const prisma = require("./prisma");

const cardRepo = {
  async create(data) {
    return prisma.card.create({
      data: {
        title: data.title,
        description: data.description || null,
        priority: data.priority || "medium",
        dueDate: data.dueDate || null,
        displayId: data.displayId || null,
        listId: data.listId,
        assigneeId: data.assigneeId || null,
        position: data.position || 0,
      },
      include: { list: true, assignee: true },
    });
  },

  async findById(id) {
    return prisma.card.findUnique({
      where: { id },
      include: {
        list: { include: { board: true } },
        assignee: true,
        labels: { include: { label: true } },
        comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
      },
    });
  },

  async findByDisplayId(boardId, displayId) {
    return prisma.card.findFirst({
      where: {
        displayId,
        list: { boardId },
      },
      include: {
        list: { include: { board: true } },
        assignee: true,
        labels: { include: { label: true } },
        comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
      },
    });
  },

  async findMaxDisplayId(boardId) {
    const result = await prisma.card.aggregate({
      where: { list: { boardId } },
      _max: { displayId: true },
    });
    return result._max.displayId || 0;
  },

  async moveToList(cardId, listId) {
    return prisma.card.update({
      where: { id: cardId },
      data: { listId },
      include: { list: true, assignee: true },
    });
  },

  async findIdsByDisplayIds(boardId, displayIds) {
    if (!displayIds || displayIds.length === 0) return [];
    const rows = await prisma.card.findMany({
      where: {
        displayId: { in: displayIds },
        list: { boardId },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },

  async findIdsByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const rows = await prisma.card.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },

  async moveManyToList(cardIds, listId) {
    if (!cardIds || cardIds.length === 0) return { count: 0 };
    return prisma.card.updateMany({
      where: { id: { in: cardIds } },
      data: { listId },
    });
  },

  async assign(cardId, assigneeId) {
    return prisma.card.update({
      where: { id: cardId },
      data: { assigneeId },
      include: { list: true, assignee: true },
    });
  },

  async setDueDate(cardId, dueDate) {
    return prisma.card.update({
      where: { id: cardId },
      data: { dueDate },
      include: { list: true, assignee: true },
    });
  },

  async setPriority(cardId, priority) {
    return prisma.card.update({
      where: { id: cardId },
      data: { priority },
      include: { list: true, assignee: true },
    });
  },

  async updateTitle(cardId, title) {
    return prisma.card.update({
      where: { id: cardId },
      data: { title },
    });
  },

  async delete(cardId) {
    return prisma.card.delete({ where: { id: cardId } });
  },

  async deleteMany(cardIds) {
    if (!cardIds || cardIds.length === 0) return { count: 0 };
    return prisma.card.deleteMany({ where: { id: { in: cardIds } } });
  },

  async findByAssignee(assigneeId, filter = "active") {
    const where = { assigneeId };
    
    if (filter === "active") {
      where.list = { name: { not: "Done" } };
    } else if (filter === "done") {
      where.list = { name: "Done" };
    }
    // if filter === "all", no list filter is applied

    return prisma.card.findMany({
      where,
      include: { list: true, labels: { include: { label: true } } },
      orderBy: { updatedAt: "desc" },
    });
  },

  async findByBoard(boardId) {
    return prisma.card.findMany({
      where: { list: { boardId } },
      include: { list: true, assignee: true, labels: { include: { label: true } } },
      orderBy: { updatedAt: "desc" },
    });
  },

  async findOverdue(boardId) {
    return prisma.card.findMany({
      where: {
        list: { boardId, name: { not: "Done" } },
        dueDate: { lt: new Date() },
      },
      include: { list: true, assignee: true },
    });
  },

  /**
   * Search cards by title (fuzzy)
   */
  async search(boardId, query) {
    return prisma.card.findMany({
      where: {
        list: { boardId },
        title: { contains: query },
      },
      include: { list: true, assignee: true },
      take: 10,
    });
  },

  async countByBoard(boardId) {
    const cards = await prisma.card.findMany({
      where: { list: { boardId } },
      include: { list: true },
    });

    const byList = {};
    let overdue = 0;
    const now = new Date();

    for (const card of cards) {
      const listName = card.list.name;
      byList[listName] = (byList[listName] || 0) + 1;
      if (card.dueDate && card.dueDate < now && listName !== "Done") {
        overdue++;
      }
    }

    return { total: cards.length, byList, overdue };
  },
};

module.exports = cardRepo;
