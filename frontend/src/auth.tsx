import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, getStoredUser, setStoredUser, type User } from './api';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (userId: number, pin: string) => Promise<void>;
  logout: () => void;
}

// Достаёт {id, name} из полезной нагрузки JWT без обращения к серверу.
function decodeUserFromToken(token: string | null): User | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const p = JSON.parse(json);
    if (typeof p.id === 'number' && typeof p.name === 'string') return { id: p.id, name: p.name };
    return null;
  } catch {
    return null;
  }
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    // Уже входили — показываем приложение сразу, без ожидания сети.
    // Пользователь берётся из localStorage, а если его там ещё нет (старая
    // установка) — декодируется прямо из JWT-токена. Так вход переживает офлайн.
    const stored = getStoredUser() ?? decodeUserFromToken(getToken());
    if (stored) {
      setUser(stored);
      setStoredUser(stored);
    }
    setLoading(false);
    // Фоново обновляем данные пользователя. Любая ошибка (нет сети / бэк лежит) —
    // игнорируется: НЕ разлогиниваем никогда (только по кнопке «Выйти»).
    api
      .me()
      .then((u) => {
        setUser(u);
        setStoredUser(u);
      })
      .catch(() => {
        /* оставляем текущего пользователя как есть */
      });
  }, []);

  const login = async (userId: number, pin: string) => {
    const { token, user } = await api.login(userId, pin);
    setToken(token);
    setStoredUser(user);
    setUser(user);
  };

  const logout = () => {
    setToken(null);
    setStoredUser(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
