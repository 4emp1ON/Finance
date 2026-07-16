import { api, getToken } from './api';

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
    await api.addTransaction({
      amount: tx.amount,
      categoryId: tx.categoryId,
      note: tx.note,
      occurredAt: tx.occurredAt,
      source: 'manual',
    });
    return { queued: false };
  } catch (e) {
    if (e instanceof TypeError) {
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
        await api.addTransaction({
          amount: p.amount,
          categoryId: p.category_id,
          note: p.note || undefined,
          occurredAt: p.occurred_at,
          source: 'manual',
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
