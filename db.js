const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Ví dụ mẫu trong db.js
async function saveTask(analysis) {
  return await prisma.task.create({
    data: {
      taskName: analysis.task_name,
      status: analysis.status,
      assignee: analysis.assignee, // Thêm dòng này
      telegramId: analysis.telegramId, // Thêm dòng này
    },
  });
}

async function updateTaskStatus(id, status) {
  return await prisma.task.update({
    where: { id: parseInt(id) },
    data: { status: status },
  });
}

// Xóa task (khi tạo nhầm)
async function deleteTask(id) {
  return await prisma.task.delete({
    where: { id: parseInt(id) },
  });
}

// Lấy thống kê tổng quan
async function getStats() {
  const all = await prisma.task.findMany();
  return {
    total: all.length,
    done: all.filter((t) => t.status === "Done").length,
    blocked: all.filter((t) => t.status === "Blocked").length,
    doing: all.filter((t) => t.status === "In Progress").length,
  };
}

// db.js
async function getTasks(filter = {}) {
  return await prisma.task.findMany({
    where: filter,
    orderBy: { updatedAt: "desc" },
  });
}
module.exports = { saveTask, getTasks, updateTaskStatus, deleteTask, getStats };
