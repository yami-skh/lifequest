// Тема оформления: «как в системе» (по умолчанию), тёмная или светлая. Выбор — на устройстве (localStorage),
// чтобы тема применялась до загрузки базы. Цвета светлой темы — src/styles/base.css, [data-theme='light'].
import { useEffect, useState } from 'preact/hooks';

export type ThemePref = 'system' | 'dark' | 'light';
const KEY = 'lq.theme';
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
const listeners = new Set<(p: ThemePref) => void>();

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref: ThemePref) {
  const theme = pref === 'system' ? (media?.matches ? 'light' : 'dark') : pref;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F4F2ED' : '#0E1015');
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* не критично: тема просто не запомнится */
  }
  apply(pref);
  listeners.forEach((l) => l(pref));
}

export function initTheme() {
  apply(getThemePref());
  media?.addEventListener('change', () => getThemePref() === 'system' && apply('system'));
}

export function useThemePref() {
  const [pref, set] = useState(getThemePref);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return pref;
}

/** Цвет направления с подменой для светлой темы: --a-7AA7FF и т. п. в base.css. */
export const ac = (c?: string) => (c ? `var(--a-${c.replace('#', '').toUpperCase()}, ${c})` : undefined);
