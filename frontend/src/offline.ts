import {
  api,
  ApiError,
  getToken,
  getStoredUser,
  type Summary,
  type Transaction,
  type TrendPoint,
} from './api';
import { getCache, setCache } from './cache';

// Трата, добавленная офлайн и ожидающая синхронизации с сервером.
export interface PendingTx {
  tempId: string;
  amount: number;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  note: string;
  occurred_at: string; // YYYY-MM-DD
  created_at: string;
}

const KEY = 'finance_pending_tx';
const listeners = new Set<() => void>();

export function onPendingChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit() {
  listeners.forEach((cb) => cb());
}

export function getPending(): PendingTx[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
function save(list: PendingTx[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  emit();
}

function enqueue(tx: Omit<PendingTx, 'tempId' | 'created_at'>): PendingTx {
  const item: PendingTx = {
    ...tx,
    tempId: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  save([...getPending(), item]);
  return item;
}
function removePending(tempId: string) {
  save(getPending().filter((p) => p.tempId !== tempId));
}

// Удалить офлайн-трату из очереди (до синхронизации)
export function discardPending(tempId: string) {
  removePending(tempId);
}

// Недоступность бэка: fetch кидает TypeError, срабатывание таймаута —
// AbortError/TimeoutError, лежащий за прокси бэк — 502/503/504 от nginx.
function isNetworkError(e: unknown): boolean {
  return (
    e instanceof TypeError ||
    (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError')) ||
    (e instanceof ApiError && [502, 503, 504].includes(e.status))
  );
}

// После успешного сохранения на сервере вписывает трату в localStorage-кэши Home
// и удаляет затронутые GET-ответы из кэша service worker. Без этого при медленной
// сети NetworkFirst может отдать устаревший список, где новой траты ещё нет, и она
// «исчезает» с главной до следующего удачного обновления. Никогда не бросает.
export async function cacheSavedTransaction(tx: Omit<Transaction, 'user_name'>) {
  try {
    const row: Transaction = { ...tx, user_name: getStoredUser()?.name ?? null };
    const p = row.occurred_at.slice(0, 7);
    const txs = getCache<Transaction[]>(`txs_${p}`);
    if (txs && !txs.some((t) => t.id === row.id)) setCache(`txs_${p}`, [row, ...txs]);
    const s = getCache<Summary>(`summary_${p}`);
    if (s) {
      s.total += row.amount;
      if (Number(row.occurred_at.slice(8, 10)) <= s.day) s.currentToDate += row.amount;
      const c = s.byCategory.find((c) => c.category_id === row.category_id);
      if (c) c.total += row.amount;
      else
        s.byCategory.push({
          category_id: row.category_id,
          name: row.category_name,
          icon: row.category_icon,
          color: row.category_color,
          total: row.amount,
        });
      setCache(`summary_${p}`, s);
    }
    const tr = getCache<TrendPoint[]>(`trends_${p}`);
    const pt = tr?.find((t) => t.month === p);
    if (tr && pt) {
      pt.total += row.amount;
      setCache(`trends_${p}`, tr);
    }
    const swCache = await caches.open('finance-api');
    for (const req of await swCache.keys())
      if (/\/api\/(transactions|summary|trends)/.test(req.url)) await swCache.delete(req);
  } catch {
    /* кэширование best-effort — сохранение уже прошло */
  }
}

// Отправляет трату на сервер; при недоступности бэка (сетевая ошибка) — кладёт в очередь.
// Ошибки валидации/сервера пробрасываются наверх (не уходят в очередь).
export async function submitExpense(tx: {
  amount: number;
  categoryId: number | null;
  note?: string;
  occurredAt?: string;
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
}): Promise<{ queued: boolean }> {
  try {
    const created = await api.addTransaction(
      {
        amount: tx.amount,
        categoryId: tx.categoryId,
        note: tx.note,
        occurredAt: tx.occurredAt,
        source: 'manual',
      },
      { timeoutMs: 12000 }
    );
    await cacheSavedTransaction({
      ...created,
      category_name: tx.categoryName ?? null,
      category_icon: tx.categoryIcon ?? null,
      category_color: tx.categoryColor ?? null,
    });
    return { queued: false };
  } catch (e) {
    if (isNetworkError(e)) {
      // бэк недоступен → офлайн-очередь
      enqueue({
        amount: tx.amount,
        category_id: tx.categoryId ?? null,
        category_name: tx.categoryName ?? null,
        category_color: tx.categoryColor ?? null,
        category_icon: tx.categoryIcon ?? null,
        note: tx.note ?? '',
        occurred_at: tx.occurredAt || new Date().toISOString().slice(0, 10),
      });
      return { queued: true };
    }
    throw e;
  }
}

let syncing = false;

// Отправляет накопленную очередь. Возвращает число синхронизированных трат.
// Никогда не теряет данные: при любой ошибке останавливается и повторит позже.
export async function syncPending(): Promise<number> {
  if (syncing || !getToken()) return 0;
  syncing = true;
  let synced = 0;
  try {
    for (const p of getPending()) {
      try {
        const created = await api.addTransaction(
          {
            amount: p.amount,
            categoryId: p.category_id,
            note: p.note || undefined,
            occurredAt: p.occurred_at,
            source: 'manual',
          },
          { timeoutMs: 15000 }
        );
        await cacheSavedTransaction({
          ...created,
          category_name: p.category_name,
          category_icon: p.category_icon,
          category_color: p.category_color,
        });
        removePending(p.tempId);
        synced++;
      } catch {
        break; // бэк недоступен или временная ошибка — повторим при следующем триггере
      }
    }
  } finally {
    syncing = false;
  }
  return synced;
}

// Автосинхронизация при появлении сети
window.addEventListener('online', () => {
  syncPending();
});
