const { createLogger } = require("../../utils/logger");

const log = createLogger("help");

function registerHelpCommands(bot) {
  bot.start((ctx) => {
    const name = ctx.from.first_name || "bạn";
    ctx.reply(
      `Chào ${name}! 👋 Tui là trợ lý ảo của nhóm.\n\n` +
        `Bạn có thể chat thoải mái với tui về bất kỳ chủ đề gì, hoặc dùng các lệnh chuyên môn:\n\n` +
        `📌 *Quản lý Task:*\n` +
        `/add [tên] — Tạo task mới\n` +
        `/done [#id] — Hoàn thành\n` +
        `/assign [#id] [@user] — Giao việc\n` +
        `/deadline [#id] [ngày] — Hạn chót\n\n` +
        `📊 *Xem tổng quan:*\n` +
        `/my — Task được giao cho bạn\n` +
        `/stats — Thống kê hiện tại\n` +
        `/report — Tổng kết ngày\n\n` +
        `💡 *Mẹo:* Cứ nhắn tự nhiên và @mention tui, tui sẽ hiểu ngữ cảnh và nhớ những gì tụi mình đã chat đó!`,
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
