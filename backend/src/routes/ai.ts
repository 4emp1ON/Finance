import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { join, resolve, extname } from 'node:path';
import { parseExpense } from '../ai/parse.js';

const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || './data/uploads');

export default async function aiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Разбор произвольного текстового сообщения
  app.post('/api/ai/text', async (req, reply) => {
    const schema = z.object({ text: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Нужен текст' });
    try {
      const result = await parseExpense({ text: parsed.data.text });
      return result;
    } catch (e) {
      app.log.error(e);
      return reply.code(502).send({ error: 'Не удалось обработать через Claude', detail: String(e) });
    }
  });

  // Разбор фото чека (multipart/form-data, поле "file")
  app.post('/api/ai/receipt', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'Нужен файл изображения' });

    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = extname(data.filename) || '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const filepath = join(UPLOAD_DIR, filename);
    await pipeline(data.file, createWriteStream(filepath));

    try {
      const result = await parseExpense({ imagePath: filepath });
      return { ...result, receiptPath: `uploads/${filename}` };
    } catch (e) {
      app.log.error(e);
      return reply.code(502).send({ error: 'Не удалось обработать чек через Claude', detail: String(e) });
    }
  });
}
