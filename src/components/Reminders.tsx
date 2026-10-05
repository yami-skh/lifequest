// Звуки и напоминания: блок настроек, окно «Включить напоминания?» и синхронизация расписания.
// Макет: холст, страница «Созвездие и напоминания».
import { useEffect, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { getReminderPrefs, notificationsAllowed, remindersSupported, rescheduleReminders, setReminderPrefs, useReminderPrefs, type ReminderPrefs } from '../lib/reminders';
import { play, setSoundPrefs, useSoundPrefs } from '../lib/sound';
import { Sheet } from './ui';

function Switch({ on, title, sub, onClick, children }: { on: boolean; title: string; sub: string; onClick: () => void; children?: preact.ComponentChildren }) {
  return (
    <div class="menu-row">
      <span class="menu-row-text"><span class="strong">{title}</span><span class="muted small">{sub}</span></span>
      {children}
      <button type="button" class={on ? 'switch on' : 'switch'} role="switch" aria-checked={on} aria-label={title} onClick={onClick}><span /></button>
    </div>
  );
}

export function SoundSettings() {
  const s = useSoundPrefs();
  return (
    <div class="menu-list">
      <Switch on={s.sound} title="Звуки" sub="XP, новый уровень, рекорд, рубеж" onClick={() => setSoundPrefs({ sound: !s.sound })} />
      <Switch on={s.vibrate} title="Вибрация" sub="короткий отклик на награды" onClick={() => setSoundPrefs({ vibrate: !s.vibrate })} />
      <div class="menu-row">
        <span class="menu-row-text"><span class="strong">Громкость</span></span>
        <input class="volume" type="range" min="0" max="1" step="0.1" value={s.volume} disabled={!s.sound} aria-label="Громкость"
          onInput={(e) => setSoundPrefs({ volume: Number(e.currentTarget.value) })} />
        <button type="button" class="link small ok-text" disabled={!s.sound} onClick={() => play('level')}>▶ проба</button>
      </div>
    </div>
  );
}

export function ReminderSettings() {
  const p = useReminderPrefs();
  const [denied, setDenied] = useState(false);
  if (!remindersSupported()) return <span class="muted small">Напоминания работают в приложении для Android. На сайте — только звуки.</span>;

  // Включаем — сначала разрешение Android.
  const toggle = async (key: keyof ReminderPrefs) => {
    const turningOn = !p[key];
    if (turningOn && !(await notificationsAllowed(true))) {
      setDenied(true);
      return;
    }
    setDenied(false);
    setReminderPrefs({ [key]: turningOn, asked: true });
  };

  return (
    <>
      <div class="menu-list">
        <Switch on={p.day} title="Записать день" sub="если сегодня ещё нет записей" onClick={() => toggle('day')}>
          <input class="time-chip" type="time" value={p.time} disabled={!p.day} aria-label="Время напоминания" onChange={(e) => e.currentTarget.value && setReminderPrefs({ time: e.currentTarget.value })} />
        </Switch>
        <Switch on={p.streak} title="Серия под угрозой" sub="в 21:00, если серия от 3 дней" onClick={() => toggle('streak')} />
        <Switch on={p.weekly} title="Недельные квесты" sub="в воскресенье, если что-то не закрыто" onClick={() => toggle('weekly')} />
        <Switch on={p.backup} title="Резервная копия" sub="раз в неделю, если копии давно не было" onClick={() => toggle('backup')} />
      </div>
      {denied && <span class="small danger-text">Android не разрешил уведомления. Включи их в настройках телефона: Приложения → LifeQuest → Уведомления.</span>}
    </>
  );
}

/** Один раз в APK, после первой записи: объяснить и спросить разрешение. */
export function ReminderPrompt() {
  const w = useWorld();
  const p = useReminderPrefs();
  const hasEntries = w.entries.some((e) => e.type !== 'bonus');
  if (!remindersSupported() || p.asked || !hasEntries) return null;
  const close = () => setReminderPrefs({ asked: true });
  const enable = async () => {
    const ok = await notificationsAllowed(true);
    setReminderPrefs(ok ? { asked: true } : { asked: true, day: false, streak: false, weekly: false, backup: false });
  };
  return (
    <Sheet open onClose={close} title="Включить напоминания?">
      <p class="muted">Раз в вечер, только если за день нет записей, и в воскресенье — если недельный квест не закрыт. Android сейчас спросит разрешение — нажми «Разрешить».</p>
      <button type="button" class="btn primary" onClick={enable}>Включить</button>
      <button type="button" class="link small muted center" onClick={close}>Не сейчас</button>
    </Sheet>
  );
}

/** Пересчитывает расписание при изменении данных или настроек (с задержкой, чтобы не дёргать на каждый клик). */
export function ReminderSync() {
  const w = useWorld();
  const p = useReminderPrefs();
  useEffect(() => {
    if (!remindersSupported() || !getReminderPrefs().asked) return;
    const t = setTimeout(() => rescheduleReminders(w).catch((e) => console.error('reminders', e)), 1500);
    return () => clearTimeout(t);
  }, [w, p]);
  return null;
}
