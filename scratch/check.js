const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const boards = await prisma.board.findMany();
  console.dir(boards.map(x => ({id: x.id, chatId: x.chatId, topicId: x.topicId, isActive: x.isActive})), {depth: null});
}
main().finally(() => prisma.$disconnect());
