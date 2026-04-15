const cardRepo = require("../db/card.repo");
const boardRepo = require("../db/board.repo");
const { formatMyCards, formatStats, formatCardsByList } = require("../utils/formatter");

const reportService = {
  /**
   * Generate board stats summary
   */
  async getBoardStats(boardId) {
    const board = await boardRepo.findById(boardId);
    const counts = await cardRepo.countByBoard(boardId);

    return formatStats({
      boardName: board.name,
      ...counts,
    });
  },

  /**
   * Generate daily report for a board (Grouped by person)
   */
  async getDailyReport(boardId) {
    const board = await boardRepo.findById(boardId);
    if (!board) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allCards = await cardRepo.findByBoard(boardId);
    const todayCards = allCards.filter(
      (c) => new Date(c.updatedAt) >= today,
    );

    if (todayCards.length === 0) {
      return `📊 *Tổng kết ngày — ${board.name}*\n\nHôm nay chưa có hoạt động nào.`;
    }

    let report = `📊 *TỔNG KẾT NGÀY — ${board.name}*\n\n`;
    report += this._formatByAssignee(todayCards);

    // Overdue warning stays at the bottom
    const overdue = await cardRepo.findOverdue(boardId);
    if (overdue.length > 0) {
      report += `\n🔴 *Quá hạn (${overdue.length}):*\n`;
      overdue.forEach((c) => {
        const who = c.assignee ? ` → @${c.assignee.firstName}` : "";
        report += `  • #${c.displayId || c.id} ${c.title}${who}\n`;
      });
    }

    return report;
  },

  /**
   * Generate weekly report for a board (Grouped by person)
   */
  async getWeeklyReport(boardId) {
    const board = await boardRepo.findById(boardId);
    if (!board) return null;

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    lastWeek.setHours(0, 0, 0, 0);

    const allCards = await cardRepo.findByBoard(boardId);
    const weeklyCards = allCards.filter(
      (c) => new Date(c.updatedAt) >= lastWeek,
    );

    if (weeklyCards.length === 0) {
      return `📅 *Tổng kết tuần — ${board.name}*\n\nTuần này chưa có hoạt động nào nổi bật.`;
    }

    let report = `📅 *TỔNG KẾT TUẦN — ${board.name}*\n`;
    report += `_(Từ ${lastWeek.toLocaleDateString("vi-VN")} đến nay)_\n\n`;
    report += this._formatByAssignee(weeklyCards);

    return report;
  },

  /**
   * Helper to format cards grouped by assignee
   */
  _formatByAssignee(cards) {
    const groups = {};

    cards.forEach((card) => {
      const name = card.assignee ? card.assignee.firstName : "Chưa bộ phận";
      if (!groups[name]) {
        groups[name] = { done: [], inProgress: [], todo: [], other: [] };
      }

      const listName = card.list.name;
      if (listName === "Done") {
        groups[name].done.push(card);
      } else if (listName === "In Progress") {
        groups[name].inProgress.push(card);
      } else if (listName === "To Do") {
        groups[name].todo.push(card);
      } else {
        groups[name].other.push(card);
      }
    });

    let output = "";
    for (const [name, tasks] of Object.entries(groups)) {
      output += `👤 *${name}:*\n`;

      if (tasks.done.length > 0) {
        output += `  ✅ *Đã xong:* ${tasks.done.map((t) => t.title).join(", ")}\n`;
      }

      if (tasks.inProgress.length > 0) {
        output += `  🚧 *Đang làm:* ${tasks.inProgress.map((t) => t.title).join(", ")}\n`;
      }

      if (tasks.todo.length > 0) {
        output += `  📝 *Cần làm:* ${tasks.todo.map((t) => t.title).join(", ")}\n`;
      }

      if (tasks.other.length > 0) {
        output += `  📎 *Khác:* ${tasks.other.map((t) => t.title).join(", ")}\n`;
      }

      output += "\n";
    }

    return output;
  },

  /**
   * Generate a user's task summary
   */
  async getUserReport(userId) {
    const cards = await cardRepo.findByAssignee(userId, true);
    return formatMyCards(cards);
  },
};

module.exports = reportService;
