// Журнал ошибок: 50 последних сбоев на устройстве. Наружу — только по кнопке «Отправить отчёт»,
// и только версия, канал, устройство и тексты ошибок (без записей, фото и заметок). Макет: холст, «Фаза 0».
import { useEffect, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { getChannel } from './channel';

export interface LoggedError { at: string; where: string; message: string; stack?: string; version: string }
const KEY = 'lq.errors';
const MAX = 50;
const listeners = new Set<(l: LoggedError[]) => void>();

export function getErrors(): LoggedError[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(list: LoggedError[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* журнал не должен ломать приложение */
  }
  listeners.forEach((l) => l(list));
}

/** Записать ошибку. where — где случилось, понятно человеку: «Запись», «Обновление»… */
export function logError(e: unknown, where = '') {
  console.error(where, e);
  const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : JSON.stringify(e));
  const item: LoggedError = {
    at: new Date().toISOString(),
    where,
    message: `${err.name}: ${err.message}`.slice(0, 300),
    stack: err.stack?.split('\n').slice(1, 6).join('\n').slice(0, 800),
    version: __APP_VERSION__,
  };
  save([item, ...getErrors()].slice(0, MAX));
}

export const clearErrors = () => save([]);

export function useErrors() {
  const [list, set] = useState(getErrors);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return list;
}

/** Ловить необработанные ошибки. */
export function initErrorLog() {
  addEventListener('error', (e) => logError(e.error ?? e.message, 'Без обработки'));
  addEventListener('unhandledrejection', (e) => logError(e.reason, 'Без обработки (async)'));
}

export function buildReport(list = getErrors()) {
  const head = [
    `LifeQuest ${__APP_VERSION__} · канал: ${getChannel() === 'beta' ? 'бета' : 'стабильная'} · ${Capacitor.isNativePlatform() ? 'APK' : 'сайт'}`,
    navigator.userAgent,
    `Ошибок: ${list.length}`,
    '',
  ];
  const body = list.map((e) => `[${e.at}] ${e.where || '—'} (v${e.version})\n${e.message}${e.stack ? `\n${e.stack}` : ''}`);
  return [...head, ...body].join('\n');
}

/** Отправить отчёт через «Поделиться»; если нельзя — скопировать в буфер. */
export async function shareReport(): Promise<'shared' | 'copied' | 'cancelled'> {
  const text = buildReport();
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title: 'Отчёт об ошибках LifeQuest', text });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title: 'Отчёт об ошибках LifeQuest', text });
      return 'shared';
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError' || /cancel/i.test(String((e as Error)?.message))) return 'cancelled';
  }
  await navigator.clipboard?.writeText(text);
  return 'copied';
}
