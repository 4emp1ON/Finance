export type ThemePref = 'dark' | 'light' | 'system';
const KEY = 'finance_theme';

export function getThemePref(): ThemePref {
  return (localStorage.getItem(KEY) as ThemePref) || 'dark'; // по умолчанию тёмная
}

export function setThemePref(p: ThemePref) {
  localStorage.setItem(KEY, p);
  applyTheme();
}

function isDark(p: ThemePref): boolean {
  if (p === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches;
  return p === 'dark';
}

export function applyTheme() {
  document.documentElement.classList.toggle('ion-palette-dark', isDark(getThemePref()));
}

// Реакция на смену системной темы, когда выбран режим "system"
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getThemePref() === 'system') applyTheme();
});
