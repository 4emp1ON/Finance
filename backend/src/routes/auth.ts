import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';

const loginSchema = z.object({
  userId: z.number().int(),
  pin: z.string().min(3),
});

export default async function authRoutes(app: FastifyInstance) {
  // Список пользователей для экрана входа (без секретов)
  app.get('/api/users', async () => {
    return db.prepare('SELECT id, name FROM users ORDER BY id').all();
  });

  app.post('/api/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Неверные данные' });

    const { userId, pin } = parsed.data;
    const user = db
      .prepare('SELECT id, name, pin_hash FROM users WHERE id = ?')
      .get(userId) as { id: number; name: string; pin_hash: string } | undefined;

    if (!user || !bcrypt.compareSync(pin, user.pin_hash)) {
      return reply.code(401).send({ error: 'Неверный PIN' });
    }

    const token = app.jwt.sign({ id: user.id, name: user.name });
    return { token, user: { id: user.id, name: user.name } };
  });

  app.get('/api/me', { preHandler: [app.authenticate] }, async (req) => {
    return req.user;
  });

  // Смена PIN
  app.post('/api/change-pin', { preHandler: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({ oldPin: z.string(), newPin: z.string().min(3) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Неверные данные' });

    const uid = (req.user as { id: number }).id;
    const user = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(uid) as
      | { pin_hash: string }
      | undefined;
    if (!user || !bcrypt.compareSync(parsed.data.oldPin, user.pin_hash)) {
      return reply.code(401).send({ error: 'Старый PIN неверен' });
    }
    const hash = bcrypt.hashSync(parsed.data.newPin, 10);
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hash, uid);
    return { ok: true };
  });
}
