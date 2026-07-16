const TOKEN_KEY = 'finance_token';

// Базовый путь приложения ('' в корне, '/finance' под подпутём). Все запросы к API
// и статике идут относительно него, чтобы работать за reverse-proxy на подпути.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const basePath = BASE;

const USER_KEY = 'finance_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

// Пользователь хранится локально, чтобы приложение открывалось в залогиненном
// состоянии даже без сети (никогда не разлогинивать до явного выхода).
export function getStoredUser(): { id: number; name: string } | null {
  try {
    const v = localStorage.getItem(USER_KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
export function setStoredUser(u: { id: number; name: string } | null) {
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
  else localStorage.removeItem(USER_KEY);
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.body && !(opts.body instanceof FormData)
      ? { 'content-type': 'application/json' }
      : {}),
    ...(opts.headers as Record<string, string>),
  };
  if (auth) {
    const t = getToken();
    if (t) headers.authorization = `Bearer ${t}`;
  }
  // Сетевая ошибка (бэк недоступен) пробрасывается как TypeError — вызывающий код
  // различает её и уходит в офлайн-режим. НЕ разлогиниваем ни при каких ошибках.
  const res = await fetch(BASE + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Ошибка запроса');
  return data as T;
}

export interface User {
  id: number;
  name: string;
}
export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_system: number;
}
export interface Transaction {
  id: number;
  amount: number;
  category_id: number | null;
  note: string | null;
  user_name: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  source: string;
  receipt_path: string | null;
  occurred_at: string;
}
export interface Summary {
  month: string;
  total: number;
  prevMonth: string;
  prevTotal: number;
  byCategory: {
    category_id: number | null;
    name: string | null;
    icon: string | null;
    color: string | null;
    total: number;
  }[];
}
export interface TrendPoint {
  month: string;
  total: number;
}
export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}
export interface UtilityItem {
  type: string;
  label: string;
  volumeRequired: boolean;
  filled: boolean;
  reading: UtilityReading | null;
}
export interface UtilityReading {
  id: number;
  type: string;
  period: string;
  volume: number | null;
  amount: number | null;
  note: string | null;
  diff_volume: number | null;
  diff_amount: number | null;
}
export interface UtilityStatus {
  period: string;
  deadlineDay: number;
  allFilled: boolean;
  overdue: boolean;
  missing: string[];
  items: UtilityItem[];
}
export interface Recurring {
  id: number;
  name: string;
  amount: number;
  category_id: number | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  day_of_month: number;
  active: number;
  auto: number;
  last_applied_period: string | null;
}
export interface AiParse {
  amount: number | null;
  category: string | null;
  note: string;
  confidence: number;
  receiptPath?: string;
}

export const api = {
  users: () => request<User[]>('/api/users', {}, false),
  login: (userId: number, pin: string) =>
    request<{ token: string; user: User }>(
      '/api/login',
      { method: 'POST', body: JSON.stringify({ userId, pin }) },
      false
    ),
  me: () => request<User>('/api/me'),
  changePin: (oldPin: string, newPin: string) =>
    request('/api/change-pin', { method: 'POST', body: JSON.stringify({ oldPin, newPin }) }),

  categories: () => request<Category[]>('/api/categories'),
  addCategory: (name: string, icon: string, color: string) =>
    request<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name, icon, color }),
    }),
  deleteCategory: (id: number) => request(`/api/categories/${id}`, { method: 'DELETE' }),

  transactions: (month?: string, limit?: number) =>
    request<Transaction[]>(
      `/api/transactions?${new URLSearchParams({
        ...(month ? { month } : {}),
        ...(limit ? { limit: String(limit) } : {}),
      })}`
    ),
  addTransaction: (t: {
    amount: number;
    categoryId?: number | null;
    note?: string;
    occurredAt?: string;
    source?: string;
    receiptPath?: string | null;
  }) => request<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(t) }),
  deleteTransaction: (id: number) =>
    request(`/api/transactions/${id}`, { method: 'DELETE' }),
  summary: (month?: string) =>
    request<Summary>(`/api/summary${month ? `?month=${month}` : ''}`),
  trends: (month?: string, months = 6) =>
    request<TrendPoint[]>(
      `/api/trends?months=${months}${month ? `&month=${month}` : ''}`
    ),

  utilityMeta: () =>
    request<{ type: string; label: string; volumeRequired: boolean }[]>(
      '/api/utilities/meta'
    ),
  utilityStatus: (period?: string) =>
    request<UtilityStatus>(`/api/utilities/status${period ? `?period=${period}` : ''}`),
  saveUtility: (r: {
    type: string;
    period: string;
    volume?: number | null;
    amount?: number | null;
    note?: string;
  }) => request<UtilityReading>('/api/utilities', { method: 'POST', body: JSON.stringify(r) }),
  utilityHistory: (type?: string, limit?: number) =>
    request<UtilityReading[]>(
      `/api/utilities/history?${new URLSearchParams({
        ...(type ? { type } : {}),
        ...(limit ? { limit: String(limit) } : {}),
      })}`
    ),

  recurring: () => request<Recurring[]>('/api/recurring'),
  addRecurring: (r: {
    name: string;
    amount: number;
    categoryId?: number | null;
    dayOfMonth: number;
    auto?: boolean;
  }) => request<Recurring>('/api/recurring', { method: 'POST', body: JSON.stringify(r) }),
  updateRecurring: (id: number, patch: Partial<{ auto: boolean; active: boolean }>) =>
    request<Recurring>(`/api/recurring/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  applyRecurring: (id: number) =>
    request(`/api/recurring/${id}/apply`, { method: 'POST' }),
  deleteRecurring: (id: number) => request(`/api/recurring/${id}`, { method: 'DELETE' }),

  aiText: (text: string) =>
    request<AiParse>('/api/ai/text', { method: 'POST', body: JSON.stringify({ text }) }),
  aiReceipt: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<AiParse>('/api/ai/receipt', { method: 'POST', body: fd });
  },
  aiChat: (question: string, history: ChatMsg[]) =>
    request<{ answer: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ question, history }),
    }),
};
