const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up database...');
  
  // The order of deletion matters because of foreign key constraints if onDelete is not Cascade
  // In the schema, many are onDelete: Cascade, but let's be safe.
  
  await prisma.comment.deleteMany({});
  await prisma.cardLabel.deleteMany({});
  await prisma.card.deleteMany({});
  await prisma.label.deleteMany({});
  await prisma.list.deleteMany({});
  await prisma.board.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Database cleaned successfully!');
}

main()
  .catch((e) => {
    console.error('Error cleaning database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
