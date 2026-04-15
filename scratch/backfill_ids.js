const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function backfill() {
  console.log("Starting displayId backfill...");
  
  const boards = await prisma.board.findMany();
  console.log(`Found ${boards.length} boards.`);

  for (const board of boards) {
    console.log(`Processing board ${board.id} (${board.name})...`);
    
    const cards = await prisma.card.findMany({
      where: { list: { boardId: board.id } },
      orderBy: { createdAt: "asc" }
    });

    console.log(`  Found ${cards.length} cards.`);
    
    let nextId = 1;
    for (const card of cards) {
      if (card.displayId === null) {
        await prisma.card.update({
          where: { id: card.id },
          data: { displayId: nextId }
        });
        nextId++;
      } else {
         if (card.displayId >= nextId) {
             nextId = card.displayId + 1;
         }
      }
    }
  }

  console.log("Backfill complete.");
  await prisma.$disconnect();
}

backfill().catch(err => {
  console.error(err);
  process.exit(1);
});
