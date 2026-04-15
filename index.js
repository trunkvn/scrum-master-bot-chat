require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const { analyzeTask } = require("./brain");
const { saveTask, getTasks } = require("./db");
const cron = require("node-cron");

const bot = new Telegraf(process.env.BOT_TOKEN);
const GROUP_CHAT_ID = "5639940375";

// 1. Khởi động
bot.start((ctx) =>
  ctx.reply(
    "🤖 AI Scrum Master đã sẵn sàng!\n- Báo cáo: 'Xong task UI rồi'\n- Kiểm tra: 'Tôi còn việc gì không?'\n- Danh sách: /list",
  ),
);

bot.command("list", async (ctx) => {
  const payload = ctx.payload.trim().toLowerCase(); // Lấy phần chữ sau chữ /list
  const userId = ctx.from.id.toString();
  const firstName = ctx.from.first_name;

  try {
    let filter = {};
    let title = "📋 **DANH SÁCH CÔNG VIỆC TỔNG HỢP**";

    // Phân loại dựa trên tham số người dùng nhập
    if (payload === "me") {
      filter = { telegramId: userId, status: { not: "Done" } };
      title = `📋 **TASK DANG DỞ CỦA ${firstName.toUpperCase()}**`;
    } else if (payload.startsWith("@")) {
      const targetUser = payload.replace("@", "");
      filter = { assignee: { contains: targetUser }, status: { not: "Done" } };
      title = `📋 **TASK DANG DỞ CỦA ${payload.toUpperCase()}**`;
    } else {
      // Mặc định hiện tất cả task chưa xong của cả team
      filter = { status: { not: "Done" } };
    }

    const tasks = await getTasks(filter);

    if (tasks.length === 0) {
      return ctx.reply(
        `${title}\n\nHiện tại không có task nào khớp với yêu cầu.`,
      );
    }

    let response = `${title}\n\n`;

    // Nếu xem danh sách tổng (không phải 'me'), hãy nhóm theo Assignee cho dễ nhìn
    if (!payload || payload !== "me") {
      const grouped = tasks.reduce((acc, task) => {
        const name = task.assignee || "Chưa phân công";
        if (!acc[name]) acc[name] = [];
        acc[name].push(task);
        return acc;
      }, {});

      for (const [name, userTasks] of Object.entries(grouped)) {
        response += `👤 **${name}**:\n`;
        userTasks.forEach((t) => {
          const icon = t.status === "Blocked" ? "🚨" : "🚧";
          response += `  ${icon} ${t.taskName}\n`;
        });
        response += `\n`;
      }
    } else {
      // Nếu xem riêng 'me', hiển thị danh sách đơn giản
      tasks.forEach((t, index) => {
        const icon = t.status === "Blocked" ? "🚨" : "🚧";
        response += `${index + 1}. ${icon} ${t.taskName} - *${t.status}*\n`;
      });
    }

    return ctx.replyWithMarkdown(response);
  } catch (err) {
    console.error(err);
    return ctx.reply("❌ Lỗi khi truy vấn danh sách công việc.");
  }
});
bot.command("done", async (ctx) => {
  const taskId = ctx.payload.trim();
  if (!taskId) return ctx.reply("⚠️ Vui lòng nhập ID task. Ví dụ: /done 12");

  try {
    const updated = await updateTaskStatus(taskId, "Done");
    ctx.reply(
      `✅ Chúc mừng! Task #${updated.id} của ${updated.assignee} đã hoàn thành!`,
    );
  } catch (err) {
    ctx.reply("❌ Không tìm thấy Task ID này.");
  }
});

// 3. Xử lý tin nhắn văn bản
bot.on("text", async (ctx) => {
  const userMessage = ctx.message.text;
  const userId = ctx.from.id;
  const username = ctx.from.first_name || ctx.from.username;

  // Lọc nhiễu: Chỉ xử lý nếu nhắn trong nhóm và có từ khoá hoặc là tin nhắn riêng
  const isPrivate = ctx.chat.type === "private";
  const keywords = ["xong", "task", "việc", "bot", "đang", "kẹt", "làm"];
  const hasKeyword = keywords.some((word) =>
    userMessage.toLowerCase().includes(word),
  );

  if (!isPrivate && !hasKeyword) return;

  await ctx.sendChatAction("typing");

  try {
    const analysis = await analyzeTask(userMessage);

    // TRƯỜNG HỢP 1: HỎI TIẾN ĐỘ ("Tôi còn việc gì không?")
    if (analysis.intent === "ASK_PROGRESS") {
      const allTasks = await getTask();
      // Lọc task của riêng người hỏi dựa trên tên hoặc telegramId (nếu db đã update)
      const myTasks = allTasks.filter(
        (t) =>
          (t.telegramId === userId.toString() || t.assignee === username) &&
          t.status !== "Done",
      );

      if (myTasks.length === 0)
        return ctx.reply(
          `🎉 Chúc mừng ${username}, ông không còn task nào dang dở!`,
        );

      let response = `📋 **TASK CỦA ${username.toUpperCase()}:**\n`;
      myTasks.forEach((t, i) => {
        const icon = t.status === "Blocked" ? "🚨" : "🚧";
        response += `${i + 1}. ${icon} ${t.taskName} - *${t.status}*\n`;
      });
      return ctx.replyWithMarkdown(response);
    }

    // TRƯỜNG HỢP 2: CẬP NHẬT HOẶC TẠO MỚI (Dùng nút xác nhận cho chuyên nghiệp)
    if (
      analysis.intent === "UPDATE_PROGRESS" ||
      analysis.intent === "CREATE_TASK"
    ) {
      const action = analysis.intent === "CREATE_TASK" ? "TẠO MỚI" : "CẬP NHẬT";

      // Gửi tin nhắn xác nhận kèm nút bấm (Inline Keyboard)
      return ctx.reply(
        `🤖 **XÁC NHẬN ${action}:**\n📌 Task: ${analysis.task_name}\n📊 Trạng thái: ${analysis.status}\n👤 Người làm: ${username}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "✅ Xác nhận lưu",
              `confirm:${analysis.intent}:${analysis.status}:${analysis.task_name.substring(0, 20)}`,
            ),
            Markup.button.callback("❌ Huỷ", "cancel"),
          ],
        ]),
      );
    }
  } catch (error) {
    console.error("Lỗi xử lý:", error);
  }
});

// 4. Xử lý khi bấm nút xác nhận
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const username = ctx.from.first_name || ctx.from.username;

  if (callbackData === "cancel") {
    return ctx.editMessageText("👌 Đã huỷ bỏ yêu cầu.");
  }

  if (callbackData.startsWith("confirm:")) {
    const [_, intent, status, taskNameShort] = callbackData.split(":");

    try {
      // Lưu vào DB (Lưu ý: Bạn nên update hàm saveTask để nhận thêm userId/username)
      await saveTask({
        task_name: taskNameShort,
        status: status,
        assignee: username,
        telegramId: userId.toString(),
      });

      await ctx.answerCbQuery("Đã lưu vào hệ thống!");
      return ctx.editMessageText(
        `✅ Đã ghi nhận thành công cho ${username}!\n📌 Task: ${taskNameShort}\n📊 Trạng thái: ${status}`,
      );
    } catch (err) {
      return ctx.reply("Lỗi khi lưu vào Database.");
    }
  }
});

// 5. Lập lịch (Cron Job)
// Daily Standup 9:00 AM
cron.schedule(
  "0 9 * * 1-5",
  () => {
    bot.telegram.sendMessage(
      GROUP_CHAT_ID,
      "☀️ **DAILY STANDUP!**\nChào anh em, hôm nay định làm gì thì báo tôi nhé!",
    );
  },
  { timezone: "Asia/Ho_Chi_Minh" },
);

// Summary 17:30 PM
cron.schedule(
  "30 17 * * 1-5",
  async () => {
    const tasks = await getTasks();
    const today = new Date().toDateString();
    const todayTasks = tasks.filter(
      (t) => new Date(t.updatedAt).toDateString() === today,
    );

    if (todayTasks.length > 0) {
      let report = "📊 **TỔNG KẾT NGÀY HÔM NAY:**\n\n";
      todayTasks.forEach((t) => {
        const icon = t.status === "Done" ? "✅" : "🚧";
        report += `${icon} ${t.taskName} (@${t.assignee})\n`;
      });
      bot.telegram.sendMessage(GROUP_CHAT_ID, report);
    }
  },
  { timezone: "Asia/Ho_Chi_Minh" },
);

// 6. Chạy Bot
bot.launch().then(() => console.log("🚀 AI Scrum Master 2.0 is Online!"));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
