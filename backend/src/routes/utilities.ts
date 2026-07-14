import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  db,
  UTILITY_TYPES,
  UTILITY_VOLUME_REQUIRED,
  UTILITY_LABELS,
  utilityCategoryId,
  type UtilityType,
} from '../db.js';

function prevPeriod(period: string): string {
  // period: YYYY-MM
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function utilityRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Метаданные о типах коммунальных платежей
  app.get('/api/utilities/meta', async () => {
    return UTILITY_TYPES.map((t) => ({
      type: t,
      label: UTILITY_LABELS[t],
      volumeRequired: UTILITY_VOLUME_REQUIRED[t],
    }));
  });

  // Статус за период: какие из 4 платежей заполнены, дедлайн (20 число)
  app.get('/api/utilities/status', async (req) => {
    const q = req.query as { period?: string };
    const period = q.period || new Date().toISOString().slice(0, 7);
    const rows = db
      .prepare('SELECT * FROM utility_readings WHERE period = ?')
      .all(period) as Record<string, unknown>[];
    const byType = new Map(rows.map((r) => [r.type as string, r]));

    const now = new Date();
    const currentPeriod = now.toISOString().slice(0, 7);
    const dayOfMonth = now.getDate();

    const items = UTILITY_TYPES.map((t) => ({
      type: t,
      label: UTILITY_LABELS[t],
      volumeRequired: UTILITY_VOLUME_REQUIRED[t],
      reading: byType.get(t) ?? null,
      filled: byType.has(t),
    }));

    const allFilled = items.every((i) => i.filled);
    // Просрочка только для текущего периода после 20 числа
    const overdue = period === currentPeriod && dayOfMonth > 20 && !allFilled;

    return {
      period,
      deadlineDay: 20,
      allFilled,
      overdue,
      missing: items.filter((i) => !i.filled).map((i) => i.type),
      items,
    };
  });

  // Сохранить/обновить показание. Считает разницу с прошлым периодом.
  app.post('/api/utilities', async (req, reply) => {
    const schema = z.object({
      type: z.enum(UTILITY_TYPES),
      period: z.string().regex(/^\d{4}-\d{2}$/),
      volume: z.number().nullable().optional(),
      amount: z.number().nullable().optional(),
      note: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Неверные данные' });

    const d = parsed.data;
    const type = d.type as UtilityType;

    if (UTILITY_VOLUME_REQUIRED[type] && (d.volume === null || d.volume === undefined)) {
      return reply
        .code(400)
        .send({ error: `Для "${UTILITY_LABELS[type]}" объём обязателен` });
    }

    // Показание за предыдущий период того же типа
    const prev = db
      .prepare('SELECT volume, amount FROM utility_readings WHERE type = ? AND period = ?')
      .get(type, prevPeriod(d.period)) as
      | { volume: number | null; amount: number | null }
      | undefined;

    const prevVolume = prev?.volume ?? null;
    const prevAmount = prev?.amount ?? null;
    const diffVolume =
      d.volume != null && prevVolume != null ? d.volume - prevVolume : null;
    const diffAmount =
      d.amount != null && prevAmount != null ? d.amount - prevAmount : null;

    const uid = (req.user as { id: number }).id;

    db.prepare(
      `INSERT INTO utility_readings
         (type, period, volume, amount, note, prev_volume, prev_amount, diff_volume, diff_amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(type, period) DO UPDATE SET
         volume = excluded.volume,
         amount = excluded.amount,
         note = excluded.note,
         prev_volume = excluded.prev_volume,
         prev_amount = excluded.prev_amount,
         diff_volume = excluded.diff_volume,
         diff_amount = excluded.diff_amount,
         created_by = excluded.created_by`
    ).run(
      type,
      d.period,
      d.volume ?? null,
      d.amount ?? null,
      d.note ?? null,
      prevVolume,
      prevAmount,
      diffVolume,
      diffAmount,
      uid
    );

    // Дублируем сумму в транзакции категории "Коммуналка" (одна запись на тип/период)
    if (d.amount != null) {
      const catId = utilityCategoryId();
      const label = UTILITY_LABELS[type];
      const occurredAt = `${d.period}-20`;
      const existingTx = db
        .prepare(
          `SELECT id FROM transactions
           WHERE source = 'utility' AND note = ? AND strftime('%Y-%m', occurred_at) = ?`
        )
        .get(label, d.period) as { id: number } | undefined;
      if (existingTx) {
        db.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(d.amount, existingTx.id);
      } else {
        db.prepare(
          `INSERT INTO transactions (amount, category_id, note, user_id, source, occurred_at)
           VALUES (?, ?, ?, ?, 'utility', ?)`
        ).run(d.amount, catId || null, label, uid, occurredAt);
      }
    }

    return db
      .prepare('SELECT * FROM utility_readings WHERE type = ? AND period = ?')
      .get(type, d.period);
  });

  // История по типу
  app.get('/api/utilities/history', async (req) => {
    const q = req.query as { type?: string; limit?: string };
    let sql = 'SELECT * FROM utility_readings';
    const params: unknown[] = [];
    if (q.type) {
      sql += ' WHERE type = ?';
      params.push(q.type);
    }
    sql += ' ORDER BY period DESC, type';
    if (q.limit) {
      sql += ' LIMIT ?';
      params.push(Number(q.limit));
    }
    return db.prepare(sql).all(...params);
  });
}
