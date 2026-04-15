# G-Tech Scrum Master Bot 🤖✨

**G-Tech Scrum Master Bot** là một trợ lý ảo thông minh tích hợp trên Telegram, giúp các đội ngũ công nghệ quản lý công việc (tasks) một cách hiệu quả thông qua ngôn ngữ tự nhiên. Bot được tích hợp sức mạnh AI từ Google Gemini mang lại trải nghiệm tương tác mượt mà và thông minh.

## 🚀 Tính năng nổi bật

- 📝 **Quản lý Task bằng ngôn ngữ tự nhiên**: Bạn chỉ cần nhắn tin như "Tạo task fix lỗi giao diện cho @duong deadline thứ 6", bot sẽ tự động hiểu và lưu vào hệ thống.
- 👥 **Gán việc thông minh**: Hỗ trợ gán việc trực tiếp cho thành viên trong nhóm bằng cách `@mention`.
- ⏰ **Nhắc nhở tự động**: Bot tự động quét các task sắp đến hạn hoặc quá hạn và gửi thông báo vào nhóm lúc 9:00 sáng hàng ngày.
- 📊 **Báo cáo tình trạng**: Xem danh sách task của bản thân hoặc của cả đội ngũ chỉ với một câu hỏi.
- 🆔 **Hệ thống ID theo nhóm**: Mỗi nhóm/topic có một hệ thống đánh số task riêng biệt (#1, #2, ...) giúp dễ nhớ và dễ quản lý.
- 💬 **Hỗ trợ hội thoại**: Ngoài quản lý công việc, bot có thể trò chuyện và giải đáp các thắc mắc chung.

## 🛠 Công nghệ sử dụng

- **Runtime**: Node.js
- **Bot Framework**: Telegraf (Telegram Bot API)
- **AI Engine**: Google Generative AI 
- **Database**: MySQL / SQLite (via Prisma ORM)
- **Scheduling**: Node-cron

## 📦 Hướng dẫn cài đặt

### 1. Yêu cầu hệ thống
- Node.js v18 trở lên
- Một database MySQL hoặc SQLite

### 2. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 3. Cấu hình môi trường
Tạo file `.env` tại thư mục gốc và cấu hình các thông số sau:
```env
BOT_TOKEN=your_telegram_bot_token
GOOGLE_API_KEY=your_gemini_api_key
DATABASE_URL="mysql://user:password@localhost:3306/gtech_bot"
```

### 4. Khởi tạo Database
```bash
npx prisma db push
npx prisma generate
```

## 🚀 Khởi chạy

**Chế độ phát triển:**
```bash
npm run dev
```

**Chế độ Production:**
```bash
npm start
```

## 📖 Hướng dẫn sử dụng nhanh

| Hành động | Ví dụ câu lệnh |
| :--- | :--- |
| **Tạo task** | "@bot tạo task viết tài liệu hướng dẫn cho @lyhn22" |
| **Đặt deadline** | "Đặt deadline cho task #5 là ngày mai" |
| **Hoàn thành task** | "Xong task #1 nhé bot" |
| **Xem task cá nhân** | "Tôi có những việc gì cần làm?" |
| **Xem task cả team** | "Show task của team mình đi" |
| **Xoá task** | "Xoá task #10" |

---
*Phát triển bởi G-Tech Team với 💙*
