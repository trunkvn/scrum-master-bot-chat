# Sử dụng node bản ổn định
FROM node:20-alpine

# Tạo thư mục làm việc
WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY src ./src/

# Run bot
CMD ["node", "src/index.js"]
