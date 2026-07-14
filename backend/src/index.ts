import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import './db.js'; // инициализация схемы + сид
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import transactionRoutes from './routes/transactions.js';
import recurringRoutes from './routes/recurring.js';
import utilityRoutes from './routes/utilities.js';
import aiRoutes from './routes/ai.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || './data/uploads');
const FRONTEND_DIR = resolve(process.env.FRONTEND_DIR || '../frontend/dist');

const app = Fastify({ logger: true, bodyLimit: 15 * 1024 * 1024 });

await app.register(fastifyJwt, { secret: JWT_SECRET });
await app.register(fastifyMultipart, {
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.decorate('authenticate', async function (req, reply) {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'Требуется авторизация' });
  }
});

// Загруженные чеки (для просмотра в приложении)
if (existsSync(UPLOAD_DIR)) {
  await app.register(fastifyStatic, {
    root: UPLOAD_DIR,
    prefix: '/uploads/',
    decorateReply: false,
  });
}

// API-маршруты
await app.register(authRoutes);
await app.register(categoryRoutes);
await app.register(transactionRoutes);
await app.register(recurringRoutes);
await app.register(utilityRoutes);
await app.register(aiRoutes);

app.get('/api/health', async () => ({ ok: true }));

// Статика фронтенда (PWA) + SPA fallback
if (existsSync(FRONTEND_DIR)) {
  await app.register(fastifyStatic, { root: FRONTEND_DIR, prefix: '/' });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
} else {
  app.log.warn(`Фронтенд не найден в ${FRONTEND_DIR} — отдаётся только API`);
}

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
