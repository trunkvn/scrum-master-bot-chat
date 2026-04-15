const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function clearData() {
  console.log("⚠️ Starting data clear...");
  
  try {
    // Delete in order to satisfy foreign key constraints
    const deleteComments = prisma.comment.deleteMany();
    const deleteCards = prisma.card.deleteMany();
    const deleteLabels = prisma.label.deleteMany();
    const deleteLists = prisma.list.deleteMany();
    const deleteBoards = prisma.board.deleteMany();
    const deleteUsers = prisma.user.deleteMany();

    await prisma.$transaction([
      deleteComments,
      deleteCards,
      deleteLabels,
      deleteLists,
      deleteBoards,
      deleteUsers,
    ]);

    console.log("✅ All data cleared successfully.");
  } catch (err) {
    console.error("❌ Clear failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

clearData();
