FROM node:20-bookworm-slim

RUN apt-get update -y && apt-get install -y openssl ffmpeg python3 python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install --break-system-packages notebooklm-py

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
COPY .notebooklm/storage_state.json /root/.notebooklm/storage_state.json
RUN npm run build

EXPOSE 3333

CMD ["node", "--max-old-space-size=768", "dist/boot.js"]
