import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';

export default async function transactionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Список транзакций (по умолчанию за текущий месяц)
  app.get('/api/transactions', async (req) => {
    const q = req.query as { month?: string; limit?: string };
    const month = q.month; // YYYY-MM
    let sql = `
      SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
             u.name AS user_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN users u ON u.id = t.user_id
    `;
    const params: unknown[] = [];
    if (month) {
      sql += ` WHERE strftime('%Y-%m', t.occurred_at) = ?`;
      params.push(month);
    }
    sql += ' ORDER BY t.occurred_at DESC, t.id DESC';
    if (q.limit) {
      sql += ' LIMIT ?';
      params.push(Number(q.limit));
    }
    return db.prepare(sql).all(...params);
  });

  app.post('/api/transactions', async (req, reply) => {
    const schema = z.object({
      amount: z.number().positive(),
      categoryId: z.number().int().nullable().optional(),
      note: z.string().optional(),
      occurredAt: z.string().optional(), // YYYY-MM-DD
      source: z.enum(['manual', 'ai', 'recurring']).default('manual'),
      receiptPath: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Неверные данные' });

    const uid = (req.user as { id: number }).id;
    const d = parsed.data;
    const info = db
      .prepare(
        `INSERT INTO transactions (amount, category_id, note, user_id, source, receipt_path, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, date('now')))`
      )
      .run(
        d.amount,
        d.categoryId ?? null,
        d.note ?? null,
        uid,
        d.source,
        d.receiptPath ?? null,
        d.occurredAt ?? null
      );
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);
  });

  app.delete('/api/transactions/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return { ok: true };
  });

  // Сводка за месяц: сумма всего и по категориям
  app.get('/api/summary', async (req) => {
    const q = req.query as { month?: string };
    const month = q.month || new Date().toISOString().slice(0, 7);
    const total = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM transactions WHERE strftime('%Y-%m', occurred_at) = ?`
      )
      .get(month) as { total: number };
    const byCategory = db
      .prepare(
        `SELECT c.id AS category_id, c.name, c.icon, c.color,
                COALESCE(SUM(t.amount), 0) AS total
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE strftime('%Y-%m', t.occurred_at) = ?
         GROUP BY t.category_id
         ORDER BY total DESC`
      )
      .all(month);
    return { month, total: total.total, byCategory };
  });
}
