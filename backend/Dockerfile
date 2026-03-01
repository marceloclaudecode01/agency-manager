FROM node:20-bookworm-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3333

CMD ["sh", "-c", "npx prisma db push && echo '[Boot] Starting node...' && node --max-old-space-size=512 dist/server.js"]
