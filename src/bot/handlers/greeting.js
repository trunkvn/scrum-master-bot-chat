const boardService = require("../../services/board.service");
const { createLogger } = require("../../utils/logger");

const log = createLogger("greeting");

function registerGreetingHandler(bot) {
  bot.on("new_chat_members", async (ctx) => {
    const newMembers = ctx.message.new_chat_members;
    const botInfo = await bot.telegram.getMe();

    // Check if the bot itself was added to the group
    const botWasAdded = newMembers.some((m) => m.id === botInfo.id);
    if (!botWasAdded) return;

    const groupName = ctx.chat.title || "nhóm";
    const topicId = ctx.message?.message_thread_id;

    log.info("Bot added to group", {
      chatId: ctx.chat.id,
      groupName,
      topicId,
    });

    // Auto-create a board for this group
    try {
      const user = ctx.state?.user;
      if (user) {
        await boardService.createBoard(
          groupName,
          user.id,
          ctx.chat.id.toString(),
          topicId,
        );
      }
    } catch (err) {
      log.warn("Auto-create board on join failed", { error: err.message });
    }

    // Send introduction
    await ctx.reply(
      `Chào cả nhà *${groupName}*! 👋\n\n` +
        `Tui là bot quản lý công việc của team ngay trên Telegram.\n\n` +
        `⌨️ *Lệnh nhanh:*\n` +
        `/add \`tên task\` — Tạo task\n` +
        `/my — Xem task của mình\n` +
        `/done \`#id\` — Đánh dấu xong\n` +
        `/move \`#id\` \`list\` — Chuyển trạng thái\n` +
        `/assign \`#id\` \`@user\` — Giao task\n` +
        `/deadline \`#id\` \`ngày\` — Set deadline\n` +
        `/board — Xem toàn bộ board\n` +
        `/stats — Thống kê nhanh\n` +
        `/report — Báo cáo ngày\n` +
        `/help — Xem đầy đủ hướng dẫn\n\n` +
        `💡 *Mẹo:* Cứ nhắn tự nhiên rồi @mention tui là được, không cần nhớ lệnh!\n\n` +
        `Ví dụ: *"@${botInfo.username} tạo task fix bug login cho tôi, deadline thứ 6"*\n\n` +
        `⚠️ *Lưu ý để dùng tốt nhất:*\n` +
        `1️⃣ Tui sẽ tự động nhận diện mọi người ngay khi mọi người chat trong group này.\n` +
        `2️⃣ Dùng kèm mã *#ID* (Vd: #123 xong) để tui xử lý chính xác nhất.\n` +
        `3️⃣ Tui sẽ gửi mọi báo cáo và nhắc nhở trực tiếp vào đây để cả team cùng theo dõi.\n\n` +
        `🛠 *Lưu ý:* Tui vẫn đang trong giai đoạn phát triển nên có thể có sai sót, mong cả nhà thông cảm và góp ý để tui hoàn thiện hơn nhé! 🙏\n\n` +
        `Sẵn sàng phục vụ! 🫡`,
      {
        parse_mode: "Markdown",
        message_thread_id: topicId,
      },
    );
  });
}

module.exports = { registerGreetingHandler };
