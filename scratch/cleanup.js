const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting DB cleanup for duplicate boards...");
  
  // Find all boards grouped by chatId where count > 1
  const duplicateGroups = await prisma.board.groupBy({
    by: ['chatId'],
    _count: { id: true },
    having: {
      id: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  if (duplicateGroups.length === 0) {
    console.log("No duplicate boards found. DB is clean.");
    return;
  }

  for (const group of duplicateGroups) {
    if (!group.chatId) continue;
    
    // Get all boards for this chatId, ordered by createdAt ascending
    const boards = await prisma.board.findMany({
      where: { chatId: group.chatId },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${boards.length} boards for chatId ${group.chatId}`);

    // Keep the first one (oldest) and delete the rest
    const boardsToDelete = boards.slice(1);
    const deleteIds = boardsToDelete.map(b => b.id);
    
    console.log(`Keeping Board ID ${boards[0].id}, deleting IDs: ${deleteIds.join(', ')}`);
    
    const deleteResult = await prisma.board.deleteMany({
      where: {
        id: { in: deleteIds }
      }
    });
    
    console.log(`Deleted ${deleteResult.count} duplicate boards for chatId ${group.chatId}`);
  }
  
  console.log("Cleanup completed.");
}

main()
  .catch(e => {
    console.error("Error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
