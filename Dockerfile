# ---------- 1. Сборка фронтенда (PWA) ----------
FROM node:20-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- 2. Сборка бэкенда ----------
FROM node:20-bookworm-slim AS backend
WORKDIR /app/backend
# better-sqlite3 — нативный модуль, нужны инструменты сборки
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# ---------- 3. Финальный образ ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# git нужен некоторым инструментам Claude Agent SDK
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git && rm -rf /var/lib/apt/lists/*

# Бэкенд: собранный код + прод-зависимости
COPY --from=backend /app/backend/dist ./backend/dist
COPY --from=backend /app/backend/node_modules ./backend/node_modules
COPY --from=backend /app/backend/package.json ./backend/package.json

# Фронтенд: статическая сборка
COPY --from=frontend /app/frontend/dist ./frontend/dist

WORKDIR /app/backend
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/data/finance.db
ENV UPLOAD_DIR=/data/uploads
ENV FRONTEND_DIR=/app/frontend/dist

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "dist/index.js"]
