import { db } from './db.js';
import { currentPeriod } from './period.js';

interface Recurring {
  id: number;
  name: string;
  amount: number;
  category_id: number | null;
  day_of_month: number;
  last_applied_period: string | null;
}

// Проводит все активные авто-платежи, у которых наступил день месяца и которые
// ещё не проведены в текущем периоде. Идемпотентно (защита от повторов и простоев).
function applyDue(logger: { info: (o: unknown, m?: string) => void; error: (o: unknown) => void }) {
  try {
    const period = currentPeriod();
    const now = new Date();
    const today = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const due = db
      .prepare(
        `SELECT id, name, amount, category_id, day_of_month, last_applied_period
         FROM recurring_payments
         WHERE active = 1 AND auto = 1
           AND (last_applied_period IS NULL OR last_applied_period != ?)`
      )
      .all(period) as Recurring[];

    const insert = db.prepare(
      `INSERT INTO transactions (amount, category_id, note, user_id, source, occurred_at)
       VALUES (?, ?, ?, NULL, 'recurring', date('now'))`
    );
    const mark = db.prepare('UPDATE recurring_payments SET last_applied_period = ? WHERE id = ?');

    let applied = 0;
    const tx = db.transaction((rows: Recurring[]) => {
      for (const r of rows) {
        const effectiveDay = Math.min(r.day_of_month, daysInMonth);
        if (today >= effectiveDay) {
          insert.run(r.amount, r.category_id, r.name);
          mark.run(period, r.id);
          applied++;
        }
      }
    });
    tx(due);

    if (applied > 0) logger.info({ applied, period }, 'Авто-проведение ежемесячных платежей');
  } catch (e) {
    logger.error(e);
  }
}

// Запускается при старте (догоняет пропущенные из-за простоя) и раз в 6 часов.
export function scheduleRecurringAuto(logger: {
  info: (o: unknown, m?: string) => void;
  error: (o: unknown) => void;
}) {
  applyDue(logger);
  setInterval(() => applyDue(logger), 6 * 3600_000);
  logger.info({}, 'Авто-проведение платежей активно');
}
