import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { parseExpense } from '../ai/parse.js';

const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || './data/uploads');
// Максимальная сторона сжатого изображения (px) и качество JPEG
const MAX_DIMENSION = Number(process.env.IMAGE_MAX_DIMENSION || 1600);
const JPEG_QUALITY = Number(process.env.IMAGE_JPEG_QUALITY || 70);

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
    const filename = `${randomUUID()}.jpg`;
    const filepath = join(UPLOAD_DIR, filename);

    // Сжимаем перед сохранением на диск: авто-поворот по EXIF, ресайз до MAX_DIMENSION
    // по большей стороне (без увеличения), перекодирование в JPEG. Экономит место на VPS.
    try {
      const input = await data.toBuffer();
      await sharp(input)
        .rotate()
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toFile(filepath);
    } catch (e) {
      app.log.error(e);
      return reply.code(400).send({ error: 'Не удалось обработать изображение' });
    }

    try {
      const result = await parseExpense({ imagePath: filepath });
      return { ...result, receiptPath: `uploads/${filename}` };
    } catch (e) {
      app.log.error(e);
      return reply.code(502).send({ error: 'Не удалось обработать чек через Claude', detail: String(e) });
    }
  });
}
