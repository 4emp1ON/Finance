import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';

export default async function recurringRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/recurring', async () => {
    return db
      .prepare(
        `SELECT r.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
         FROM recurring_payments r
         LEFT JOIN categories c ON c.id = r.category_id
         ORDER BY r.day_of_month`
      )
      .all();
  });

  app.post('/api/recurring', async (req, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      amount: z.number().positive(),
      categoryId: z.number().int().nullable().optional(),
      dayOfMonth: z.number().int().min(1).max(31).default(1),
      active: z.boolean().default(true),
      auto: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Неверные данные' });
    const d = parsed.data;
    const info = db
      .prepare(
        `INSERT INTO recurring_payments (name, amount, category_id, day_of_month, active, auto)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(d.name, d.amount, d.categoryId ?? null, d.dayOfMonth, d.active ? 1 : 0, d.auto ? 1 : 0);
    return db.prepare('SELECT * FROM recurring_payments WHERE id = ?').get(info.lastInsertRowid);
  });

  app.patch('/api/recurring/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const schema = z.object({
      name: z.string().min(1).optional(),
      amount: z.number().positive().optional(),
      categoryId: z.number().int().nullable().optional(),
      dayOfMonth: z.number().int().min(1).max(31).optional(),
      active: z.boolean().optional(),
      auto: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Неверные данные' });
    const d = parsed.data;
    const existing = db.prepare('SELECT * FROM recurring_payments WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Не найдено' });
    db.prepare(
      `UPDATE recurring_payments
       SET name = COALESCE(?, name), amount = COALESCE(?, amount),
           category_id = COALESCE(?, category_id), day_of_month = COALESCE(?, day_of_month),
           active = COALESCE(?, active), auto = COALESCE(?, auto)
       WHERE id = ?`
    ).run(
      d.name ?? null,
      d.amount ?? null,
      d.categoryId ?? null,
      d.dayOfMonth ?? null,
      d.active === undefined ? null : d.active ? 1 : 0,
      d.auto === undefined ? null : d.auto ? 1 : 0,
      id
    );
    return db.prepare('SELECT * FROM recurring_payments WHERE id = ?').get(id);
  });

  app.delete('/api/recurring/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    db.prepare('DELETE FROM recurring_payments WHERE id = ?').run(id);
    return { ok: true };
  });

  // Провести ежемесячный платёж как транзакцию за текущий месяц
  app.post('/api/recurring/:id/apply', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const uid = (req.user as { id: number }).id;
    const r = db.prepare('SELECT * FROM recurring_payments WHERE id = ?').get(id) as
      | { name: string; amount: number; category_id: number | null }
      | undefined;
    if (!r) return reply.code(404).send({ error: 'Не найдено' });
    const info = db
      .prepare(
        `INSERT INTO transactions (amount, category_id, note, user_id, source)
         VALUES (?, ?, ?, ?, 'recurring')`
      )
      .run(r.amount, r.category_id, r.name, uid);
    // Помечаем период проведённым, чтобы авто-проведение не создало дубль
    db.prepare("UPDATE recurring_payments SET last_applied_period = strftime('%Y-%m','now') WHERE id = ?").run(id);
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);
  });
}
