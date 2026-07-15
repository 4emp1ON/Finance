import { query } from '@anthropic-ai/claude-agent-sdk';
import { db } from '../db.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildContext(): string {
  // Транзакции за последние 12 месяцев (компактный CSV)
  const txs = db
    .prepare(
      `SELECT t.occurred_at AS d, t.amount AS a,
              COALESCE(c.name,'—') AS cat, COALESCE(t.note,'') AS note,
              COALESCE(u.name,'') AS usr, t.source AS src
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.occurred_at >= date('now','-12 months')
       ORDER BY t.occurred_at
       LIMIT 2000`
    )
    .all() as {
    d: string;
    a: number;
    cat: string;
    note: string;
    usr: string;
    src: string;
  }[];

  const utils = db
    .prepare(
      `SELECT type, period, volume, amount, diff_volume, diff_amount
       FROM utility_readings
       WHERE period >= strftime('%Y-%m', date('now','-12 months'))
       ORDER BY period, type`
    )
    .all() as Record<string, unknown>[];

  const recurring = db
    .prepare(
      `SELECT r.name, r.amount, r.day_of_month AS day, COALESCE(c.name,'—') AS cat,
              r.active, r.auto
       FROM recurring_payments r LEFT JOIN categories c ON c.id = r.category_id`
    )
    .all() as Record<string, unknown>[];

  const cats = (db.prepare('SELECT name FROM categories ORDER BY name').all() as {
    name: string;
  }[]).map((c) => c.name);

  const lines: string[] = [];
  lines.push(`Сегодня: ${new Date().toISOString().slice(0, 10)}. Валюта — рубли (₽).`);
  lines.push(`Категории: ${cats.join(', ')}.`);
  lines.push('');
  lines.push('РАСХОДЫ (CSV: дата,сумма,категория,заметка,кто,источник):');
  lines.push('дата,сумма,категория,заметка,кто,источник');
  for (const t of txs) {
    lines.push(
      `${t.d},${t.a},${t.cat},${(t.note || '').replace(/[\n,]/g, ' ')},${t.usr},${t.src}`
    );
  }
  lines.push('');
  lines.push('КОММУНАЛКА (тип,период,объём,сумма,разница_объём,разница_сумма):');
  for (const u of utils) {
    lines.push(
      `${u.type},${u.period},${u.volume ?? ''},${u.amount ?? ''},${u.diff_volume ?? ''},${u.diff_amount ?? ''}`
    );
  }
  lines.push('');
  lines.push('ЕЖЕМЕСЯЧНЫЕ ПЛАТЕЖИ (название,сумма,день,категория,активен,авто):');
  for (const r of recurring) {
    lines.push(`${r.name},${r.amount},${r.day},${r.cat},${r.active},${r.auto}`);
  }
  return lines.join('\n');
}

export async function chatAboutFinances(
  question: string,
  history: ChatMessage[]
): Promise<string> {
  const context = buildContext();

  const parts: string[] = [];
  parts.push(
    'Ты — финансовый помощник семьи. Отвечай кратко, по делу, на русском языке. ' +
      'Суммы указывай в рублях. Считай по приведённым данным; если данных не хватает — ' +
      'честно скажи об этом. Не выдумывай цифры. Можешь делать выводы и давать короткие советы, ' +
      'если уместно. Не используй инструменты — данные уже даны ниже.'
  );
  parts.push('=== ДАННЫЕ СЕМЕЙНОГО БЮДЖЕТА ===\n' + context);
  if (history.length) {
    parts.push('=== ПРЕДЫДУЩИЙ ДИАЛОГ ===');
    for (const m of history.slice(-6)) {
      parts.push(`${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.content}`);
    }
  }
  parts.push('=== ВОПРОС ===\n' + question);

  const result = query({
    prompt: parts.join('\n\n'),
    options: { model: MODEL, maxTurns: 1 },
  });

  let answer = '';
  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') {
      answer = message.result ?? answer;
    }
  }
  return answer.trim();
}
