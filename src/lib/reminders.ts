// Напоминания (только APK, плагин @capacitor/local-notifications). Фонового кода нет, поэтому
// уведомления заранее планируются на 7 дней и пересчитываются при каждом изменении данных:
// есть запись за сегодня → сегодняшнее «Записать день» снимается.
import { useEffect, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Derived } from '../db/world';
import { addDays, localDate } from '../engine/dates';
import { weekStart } from '../engine/quests';

export interface ReminderPrefs { day: boolean; time: string; streak: boolean; weekly: boolean; backup: boolean; asked: boolean }
const KEY = 'lq.reminders';
const DEFAULTS: ReminderPrefs = { day: true, time: '21:00', streak: true, weekly: true, backup: false, asked: false };
const listeners = new Set<(p: ReminderPrefs) => void>();
export const remindersSupported = () => Capacitor.isNativePlatform();

export function getReminderPrefs(): ReminderPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function setReminderPrefs(patch: Partial<ReminderPrefs>) {
  const next = { ...getReminderPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* не критично */
  }
  listeners.forEach((l) => l(next));
}

export function useReminderPrefs() {
  const [p, set] = useState(getReminderPrefs);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return p;
}

/** Есть ли разрешение; ask — спросить у Android, если ещё не спрашивали. */
export async function notificationsAllowed(ask = false) {
  if (!remindersSupported()) return false;
  let p = await LocalNotifications.checkPermissions();
  if (p.display !== 'granted' && ask) p = await LocalNotifications.requestPermissions();
  return p.display === 'granted';
}

const at = (date: string, time: string) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
};

const IDS = { day: 100, streak: 110, weekly: 120, backup: 130 };
let channelReady = false;

/** Пересчитать все напоминания по текущим данным. */
export async function rescheduleReminders(w: Derived) {
  if (!(await notificationsAllowed())) return;
  if (!channelReady) {
    await LocalNotifications.createChannel({ id: 'reminders', name: 'Напоминания', description: 'Записать день, серия, недельные квесты', importance: 4 }).catch(() => {});
    channelReady = true;
  }
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });

  const p = getReminderPrefs();
  const now = new Date();
  const today = localDate();
  const hasToday = w.entries.some((e) => e.type !== 'bonus' && e.date === today);
  const streak = w.streak;
  const list: { id: number; title: string; body: string; when: Date }[] = [];

  // Серия под угрозой: сегодня в 21:00, если серия от 3 дней и записи ещё нет.
  const streakToday = p.streak && !hasToday && streak >= 3 && at(today, '21:00') > now;
  if (streakToday) list.push({ id: IDS.streak, title: `Серия ${streak} дней под угрозой`, body: 'Осталось 3 часа. Хватит одной короткой записи.', when: at(today, '21:00') });

  // Записать день: на 7 дней вперёд; сегодня — только если записи нет (и не совпадает с «серией»).
  if (p.day) {
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const when = at(date, p.time);
      if (when <= now) continue;
      if (i === 0 && (hasToday || (streakToday && p.time === '21:00'))) continue;
      list.push({ id: IDS.day + i, title: 'Сегодня ещё без записей', body: 'Что получилось за день? Одна запись — и серия продолжится.', when });
    }
  }

  // Недельные квесты: ближайшее воскресенье 18:00, если что-то не закрыто.
  if (p.weekly) {
    const week = weekStart(today);
    const open = w.quests.filter((q) => q.kind === 'weekly' && q.week === week && q.status === 'active');
    const sunday = addDays(week, 6);
    if (open.length && at(sunday, '18:00') > now) {
      const s = w.questProgress(open[0]).steps[0];
      const what = `«${open[0].title}»${s?.target ? ` (${s.have ?? 0} из ${s.target})` : ''}`;
      list.push({ id: IDS.weekly, title: 'Неделя почти прошла', body: `Не закрыто: ${what}${open.length > 1 ? ` и ещё ${open.length - 1}` : ''}.`, when: at(sunday, '18:00') });
    }
  }

  // Резервная копия: если не было больше недели — сегодня или завтра в 19:00.
  if (p.backup) {
    const last = w.profile?.lastBackupAt?.slice(0, 10);
    if (!last || last <= addDays(today, -7)) {
      const when = at(today, '19:00') > now ? at(today, '19:00') : at(addDays(today, 1), '19:00');
      list.push({ id: IDS.backup, title: 'Сохрани резервную копию', body: 'Копии не было больше недели. Ещё → Резервная копия.', when });
    }
  }

  if (list.length) {
    await LocalNotifications.schedule({
      // Неточные будильники: минута туда-сюда не важна, а точные на Android 14+ требуют отдельного разрешения.
      notifications: list.map((n) => ({ id: n.id, title: n.title, body: n.body, channelId: 'reminders', isExactNotification: false, schedule: { at: n.when, allowWhileIdle: true } })),
    });
  }
}
