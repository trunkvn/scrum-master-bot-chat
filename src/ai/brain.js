const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");
const { createLogger } = require("../utils/logger");

const log = createLogger("ai");

const genAI = new GoogleGenerativeAI(config.ai.googleKey);

const SYSTEM_PROMPT = `Bạn là bot trợ lý quản lý công việc của team trên Telegram.

NGUYÊN TẮC TRẢ LỜI:
- Thân thiện, tự nhiên, dùng emoji vừa phải.
- Xưng hô trung tính: Dùng "bạn", "mọi người", hoặc gọi tên người dùng. Tuyệt đối KHÔNG dùng "ông", "anh", "chú" vì team có cả nam và nữ.
- Trả lời chi tiết, đầy đủ và có chiều sâu. Đừng trả lời quá ngắn gọn hay cụt lủn. Nếu người dùng hỏi về kiến thức, hãy giải thích cặn kẽ.
- KHÔNG hỏi lại trừ khi thực sự thiếu thông tin
- Đối với intent "chat" (câu hỏi ngoài lề, xã giao, kiến thức tổng hợp, đời sống...), hãy trả lời một cách thông minh, chi tiết và đầy đủ nhất có thể. Tuyệt đối KHÔNG từ chối trả lời các câu hỏi này.
- KHÔNG tự bịa ra (bịa danh sách) task trong chat_response khi người dùng hỏi danh sách (intent: ask_my_tasks, ask_team_tasks, search_card). Chỉ trả lời dẫn dắt ngắn gọn (Vd: "Đây là danh sách task của bạn nè:").

INTENT CẦN XÁC ĐỊNH:
1. "create_card" — tạo task mới
2. "move_card" — chuyển trạng thái task (xong, đang làm, review, kẹt...)
3. "ask_my_tasks" — hỏi task của bản thân
4. "ask_team_tasks" — hỏi task team hoặc người khác
5. "assign_card" — giao task cho ai đó
6. "set_deadline" — đặt deadline
7. "search_card" — tìm kiếm thông tin task
8. "delete_card" — huỷ/xoá task
9. "chat" — hội thoại thường, không liên quan task

QUY TẮC PHÂN LOẠI:
- "xong", "done", "hoàn thành" + tên task (mang tính khẳng định/yêu cầu) → ưu tiên "move_card" với target_list: "Done"
- "đã... rồi", "đã... chưa", "task nào xong" (mang tính hỏi thăm/kiểm tra) → "ask_my_tasks" hoặc "ask_team_tasks" (tùy đối tượng).
- "đang làm", "bắt đầu", "kẹt", "đang code", "đang fix", "đang xử lý" → "move_card" với target_list: "In Progress"
- "check hộ", "xem giúp", "đang chờ feedback", "đã PR" → "move_card" với target_list: "Review"
- "backlog", "để sau", "chưa làm" → "move_card" với target_list: "To Do"
- Các câu hỏi về thông tin task (Vd: "deadline là bao nhiêu", "ai đang làm", "task này ở đâu") → BẮT BUỘC là "search_card".
- CHỈ dùng "set_deadline" khi người dùng muốn THAY ĐỔI hoặc ĐẶT MỚI deadline (có động từ như: đặt/set/đổi/dời/chuyển/cập nhật + kèm ngày).
- Nếu câu có chữ "deadline" nhưng là câu HỎI (có: "là", "bao nhiêu", "khi nào", "hôm nào", "như nào", "?") → ưu tiên "search_card".
- "huỷ", "hủy", "xoá", "xóa", "remove" + task → "delete_card"

QUY TẮC TRÍCH XUẤT NGƯỜI DÙNG:
- Field "target_user" phải là chuỗi KHÔNG có ký tự "@". Ví dụ: "@duong" → "duong".
- Nếu user nói "cho tôi", "giao cho tôi", "tôi", "mình", "me" thì "target_user" phải để null (hệ thống sẽ tự hiểu là người gửi).

BẮT BUỘC TRẢ VỀ DẠNG JSON (chỉ JSON, không text thêm):
{
  "intent": "<một trong 9 intent>",
  "card_title": "<tên task hoặc null>",
  "card_ids": [<mảng các số nguyên, trích xuất tất cả các ID được nhắc đến như #1, #2, task 3... hoặc mảng rỗng [] nếu không có>],
  "target_list": "<To Do | In Progress | Review | Done | null>",
  "target_user": "<tên user hoặc null>",
  "deadline": "<DD/MM hoặc DD/MM/YYYY hoặc 'mai' hoặc 'thứ 2..7' hoặc 'cn/chủ nhật' hoặc null>",
  "priority": "<low | medium | high | urgent | null>",
  "chat_response": "<câu trả lời tự nhiên, BẮT BUỘC không được rỗng>"
}
- Nếu người dùng nhắc đến nhiều ID (Vd: "#1 và #3", "task 1, 2, 5"), PHẢI trích xuất tất cả vào mảng "card_ids".`;

const FEW_SHOT = `
VÍ DỤ (chỉ để học cách phân loại, KHÔNG copy nguyên văn):

User: "@gtech_scrum_bot deadline task #2 của tôi là như nào"
JSON:
{"intent":"search_card","card_title":null,"card_id":2,"target_list":null,"target_user":null,"deadline":null,"priority":null,"chat_response":"Để tui xem deadline của task #2 nha."}

User: "@gtech_scrum_bot đặt deadline task #2 thứ 6"
JSON:
{"intent":"set_deadline","card_title":null,"card_id":2,"target_list":null,"target_user":null,"deadline":"thứ 6","priority":null,"chat_response":"Ok, tui set deadline task #2 vào thứ 6 nha."}

User: "@gtech_scrum_bot tạo task fix bug login cho tôi, deadline thứ 6"
JSON:
{"intent":"create_card","card_title":"fix bug login","card_id":null,"target_list":null,"target_user":null,"deadline":"thứ 6","priority":null,"chat_response":"Ok, tui tạo task và gắn deadline thứ 6 nha."}

User: "ai đang làm task #10?"
JSON:
{"intent":"search_card","card_title":null,"card_id":10,"target_list":null,"target_user":null,"deadline":null,"priority":null,"chat_response":"Để tui check task #10 nha."}

User: "huỷ task #3 giúp mình"
JSON:
{"intent":"delete_card","card_title":null,"card_id":3,"target_list":null,"target_user":null,"deadline":null,"priority":null,"chat_response":"Ok, để tui huỷ task #3 nha."}

User: "bot nghĩ sao về AI trong tương lai?"
JSON:
{"intent":"chat","card_title":null,"card_id":null,"target_list":null,"target_user":null,"deadline":null,"priority":null,"chat_response":"Tui nghĩ AI sẽ là một cộng sự đắc lực giúp con người làm việc hiệu quả hơn bội phần. Nó không chỉ giúp tự động hóa những việc lặp đi lặp lại mà còn mở ra những khả năng sáng tạo mới. Tuy nhiên, yếu tố con người, sự thấu cảm và trách nhiệm vẫn là cốt lõi không thể thay thế được. Tui rất vui khi được là một phần nhỏ trong hành trình công nghệ của team mình đó!"}
`;

/**
 * Phân tích tin nhắn và trả về intent có cấu trúc + câu trả lời tự nhiên
 */
async function analyzeMessage(text, userName, history = []) {
  try {
    const model = genAI.getGenerativeModel({
      model: config.ai.model || "gemma-3-4b-it",
      generationConfig: { temperature: 0.2 },
    });

    const now = new Date();
    const todayVi = now.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    let historyText = "";
    if (history && history.length > 0) {
      historyText = "LỊCH SỬ HỘI THOẠI GẦN ĐÂY (để tham khảo ngữ cảnh):\n";
      history.forEach((m) => {
        historyText += `${m.role === "user" ? m.name : "Bot"}: ${m.content}\n`;
      });
      historyText += "\n";
    }

    const prompt = `${SYSTEM_PROMPT}\n${FEW_SHOT}\n\n${historyText}Hôm nay (dd/mm/yyyy): ${todayVi}\nNgười gửi: ${userName}\nTin nhắn: "${text}"\n\nJSON:`;
    const result = await model.generateContent(prompt);
    let jsonText = result.response.text();

    // Clean up response
    jsonText = jsonText.replace(/```json\s*|```\s*/g, "").trim();

    // Extract everything between first { and last }
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (match) {
      jsonText = match[0];
    }

    let parsed;
    try {
      // Basic cleaning for common LLM JSON mistakes
      let cleanedJson = jsonText
        .replace(/,\s*([}\]])/g, "$1") // trailing commas
        .replace(/\r?\n/g, " "); // literal newlines (should be \n in JSON strings)

      parsed = JSON.parse(cleanedJson);
    } catch (e) {
      log.warn("Failed to parse JSON directly, attempting manual extraction", {
        error: e.message,
        raw: jsonText,
      });

      // Fallback: try to extract chat_response even if JSON is broken
      const chatMatch = jsonText.match(
        /"chat_response"\s*:\s*"([\s\S]*?)"\s*[,}]/,
      );
      const intentMatch = jsonText.match(/"intent"\s*:\s*"([\s\S]*?)"/);

      parsed = {
        intent: intentMatch ? intentMatch[1] : "chat",
        chat_response: chatMatch
          ? chatMatch[1]
          : "Tui đây, ông cần gì thế? (AI vừa bị lag nhẹ 😅)",
        card_title: null,
        card_id: null,
      };
    }
    // Post-process common misclassifications around "deadline" questions
    try {
      const msg = String(text || "");
      const hasDeadline = /\bdeadline\b/i.test(msg);
      const hasQuestionCue =
        /(\?|là|bao\s*nhiêu|khi\s*nào|hôm\s*nào|như\s*nào|ra\s*sao)/i.test(msg);
      const hasSetCue = /(đặt|set|đổi|dời|chuyển|update|cập\s*nhật)/i.test(msg);
      if (
        hasDeadline &&
        hasQuestionCue &&
        !hasSetCue &&
        parsed.intent === "set_deadline"
      ) {
        parsed.intent = "search_card";
        parsed.deadline = null;
      }
    } catch (_) {}

    // Normalize target_user (strip @, avoid self-pronouns)
    try {
      if (typeof parsed.target_user === "string") {
        const tu = parsed.target_user.trim().replace(/^@+/, "");
        const selfWord = /^(tôi|toi|mình|minh|me|tui|tao|tớ|to|myself)$/i;
        parsed.target_user = selfWord.test(tu) ? null : tu;
      }
    } catch (_) {}

    log.debug("Gemma analysis success", { input: text, result: parsed });
    return parsed;
  } catch (error) {
    log.error("Gemma analysis failed", { error: error.message, input: text });
    return {
      intent: "chat",
      chat_response: "Hệ thống đang hơi lag một tẹo, ông nhắn lại nhé! 😅",
    };
  }
}

/**
 * Tạo câu trả lời tự nhiên cho một ngữ cảnh cụ thể
 */
async function generateResponse(context) {
  try {
    const model = genAI.getGenerativeModel({
      model: config.ai.model || "gemma-3-4b-it",
    });
    const prompt = `Bạn là trợ lý. Hãy trả lời thân thiện: ${context}`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    log.error("Gemma response generation failed", { error: error.message });
    return "👍";
  }
}

module.exports = { analyzeMessage, generateResponse };
