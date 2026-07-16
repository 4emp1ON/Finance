// Простое кэширование ответов сервера в localStorage — чтобы показывать
// последние известные данные, когда бэк недоступен.

export function setCache(key: string, data: unknown) {
  try {
    localStorage.setItem('cache_' + key, JSON.stringify(data));
  } catch {
    /* переполнение хранилища — не критично */
  }
}

export function getCache<T>(key: string): T | null {
  try {
    const v = localStorage.getItem('cache_' + key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
