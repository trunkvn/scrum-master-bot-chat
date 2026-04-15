const prisma = require("./prisma");

const listRepo = {
  async findByBoardId(boardId) {
    return prisma.list.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
      include: {
        cards: {
          orderBy: { position: "asc" },
          include: { assignee: true, labels: { include: { label: true } } },
        },
      },
    });
  },

  async findByName(boardId, name) {
    return prisma.list.findFirst({
      where: {
        boardId,
        name: { equals: name },
      },
    });
  },

  /**
   * Fuzzy match list name — useful for AI-parsed list names
   */
  async findByFuzzyName(boardId, name) {
    const lists = await prisma.list.findMany({ where: { boardId } });
    const lower = name.toLowerCase().trim();

    // Exact match first
    const exact = lists.find((l) => l.name.toLowerCase() === lower);
    if (exact) return exact;

    // Contains match
    const partial = lists.find(
      (l) =>
        l.name.toLowerCase().includes(lower) ||
        lower.includes(l.name.toLowerCase()),
    );
    if (partial) return partial;

    // Common aliases
    const aliases = {
      todo: "To Do",
      "to do": "To Do",
      "cần làm": "To Do",
      doing: "In Progress",
      "đang làm": "In Progress",
      review: "Review",
      "kiểm tra": "Review",
      done: "Done",
      xong: "Done",
      "hoàn thành": "Done",
    };
    const aliasName = aliases[lower];
    if (aliasName) return lists.find((l) => l.name === aliasName) || null;

    return null;
  },

  async create(boardId, name, position) {
    return prisma.list.create({
      data: { name, position, boardId },
    });
  },
};

module.exports = listRepo;
