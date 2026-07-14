import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { db } from '../db.js';

export interface ParseResult {
  amount: number | null;
  category: string | null;
  note: string;
  confidence: number;
  raw?: string;
}

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

function availableCategories(): string[] {
  const rows = db.prepare('SELECT name FROM categories ORDER BY name').all() as {
    name: string;
  }[];
  return rows.map((r) => r.name);
}

function buildPrompt(opts: { text?: string; hasImage?: boolean }): string {
  const cats = availableCategories();
  const parts: string[] = [];

  parts.push(
    'Ты — помощник для учёта семейных расходов. Определи сумму траты и подходящую категорию.'
  );
  parts.push(`Доступные категории (выбирай ТОЛЬКО из этого списка): ${cats.join(', ')}.`);
  parts.push(
    'Если ни одна категория не подходит идеально — выбери ближайшую по смыслу или "Прочее".'
  );

  if (opts.hasImage) {
    parts.push(
      'На изображении — чек. Определи итоговую сумму к оплате ' +
        '(обычно "Итого"/"К оплате"/"Total") и что было куплено.'
    );
  }
  if (opts.text) {
    parts.push(`Сообщение пользователя: "${opts.text}"`);
  }

  parts.push(
    'Ответь СТРОГО одним JSON-объектом без markdown и пояснений, в формате: ' +
      '{"amount": число_в_рублях_или_null, "category": "точное_название_категории_из_списка", ' +
      '"note": "краткое описание покупки", "confidence": число_от_0_до_1}'
  );

  return parts.join('\n\n');
}

function mediaType(path: string): string {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.heic':
    case '.heif':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

function extractJson(text: string): ParseResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return { amount: null, category: null, note: '', confidence: 0, raw: text };
  }
  try {
    const obj = JSON.parse(match[0]);
    const cats = availableCategories();
    let category: string | null =
      typeof obj.category === 'string' ? obj.category : null;
    // нормализуем категорию к существующей
    if (category && !cats.includes(category)) {
      const lower = category.toLowerCase();
      category = cats.find((c) => c.toLowerCase() === lower) ?? null;
    }
    return {
      amount:
        typeof obj.amount === 'number'
          ? obj.amount
          : obj.amount != null && !isNaN(Number(obj.amount))
            ? Number(obj.amount)
            : null,
      category,
      note: typeof obj.note === 'string' ? obj.note : '',
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
      raw: text,
    };
  } catch {
    return { amount: null, category: null, note: '', confidence: 0, raw: text };
  }
}

// Изображение передаём напрямую как image-блок (vision), без инструмента Read —
// это надёжнее и быстрее (один заход модели).
async function imageInput(imagePath: string, promptText: string) {
  const data = (await readFile(imagePath)).toString('base64');
  const media = mediaType(imagePath);
  async function* gen() {
    yield {
      type: 'user' as const,
      session_id: '',
      parent_tool_use_id: null,
      message: {
        role: 'user' as const,
        content: [
          { type: 'image', source: { type: 'base64', media_type: media, data } },
          { type: 'text', text: promptText },
        ],
      },
    };
  }
  return gen();
}

export async function parseExpense(opts: {
  text?: string;
  imagePath?: string;
}): Promise<ParseResult> {
  const promptText = buildPrompt({ text: opts.text, hasImage: !!opts.imagePath });

  const result = query({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prompt: opts.imagePath ? ((await imageInput(opts.imagePath, promptText)) as any) : promptText,
    options: {
      model: MODEL,
      maxTurns: 1,
    },
  });

  let finalText = '';
  for await (const message of result) {
    if (message.type === 'result' && message.subtype === 'success') {
      finalText = message.result ?? finalText;
    }
  }

  return extractJson(finalText);
}
