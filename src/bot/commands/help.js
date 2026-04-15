const { createLogger } = require("../../utils/logger");

const log = createLogger("help");

function registerHelpCommands(bot) {
  bot.start((ctx) => {
    const name = ctx.from.first_name || "bạn";
    ctx.reply(
      `Chào ${name}! 👋 Tui là bot quản lý task của team.\n\n` +
        `Bạn có thể chat thoải mái với tui, hoặc dùng lệnh:\n\n` +
        `📌 *Quản lý Task:*\n` +
        `/add [tên task] — Tạo task mới\n` +
        `/my — Xem task của mình\n` +
        `/done [#id] — Đánh dấu hoàn thành\n` +
        `/move [#id] [list] — Chuyển task\n` +
        `/assign [#id] [@user] — Giao task\n` +
        `/deadline [#id] [ngày] — Set deadline\n\n` +
        `📊 *Xem tổng quan:*\n` +
        `/board — Xem board hiện tại\n` +
        `/stats — Thống kê\n` +
        `/report — Báo cáo ngày\n\n` +
        `💡 Hoặc cứ nhắn tự nhiên, tui hiểu!`,
      { parse_mode: "Markdown" },
    );
  });

  bot.command("help", (ctx) => {
    ctx.reply(
      `🤖 *Danh sách lệnh:*\n\n` +
        `/add [tên] — Tạo task\n` +
        `/my — Task của tui\n` +
        `/done [#id] — Xong task\n` +
        `/move [#id] [list] — Chuyển list\n` +
        `/assign [#id] [@user] — Giao task\n` +
        `/deadline [#id] [ngày] — Set hạn\n` +
        `/label [#id] [tên] [màu] — Gắn label\n` +
        `/board — Xem board\n` +
        `/boards — Tất cả boards\n` +
        `/stats — Thống kê\n` +
        `/report — Báo cáo ngày\n` +
        `/weekly — Báo cáo tuần\n` +
        `/del [#id] — Xoá task\n\n` +
        `💡 *Tips:* Cứ nhắn tự nhiên kiểu "tạo task fix bug cho tôi, deadline thứ 6" — tui tự hiểu!`,
      { parse_mode: "Markdown" },
    );
  });
}

module.exports = { registerHelpCommands };
