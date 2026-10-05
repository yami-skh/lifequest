// Настройки: персонаж, тема, недельные квесты, резервная копия, о приложении, стереть данные.
// Макет: холст, страница «Настройки и обновления». Карточка обновления на главном — UpdateCard.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { useWorld } from '../db/world';
import { db } from '../db/db';
import { resetAll, setAiCode, setName, toggleExperiment, toggleWeeklyTemplate } from '../db/actions';
import { EXPERIMENTS } from '../engine/experiments';
import { getChannel, setChannel, type Channel } from '../lib/channel';
import { toast } from '../lib/toast';
import { AiError, fetchQuota } from '../lib/ai';
import { ReminderSettings, SoundSettings } from '../components/Reminders';
import { WEEKLY_TEMPLATES } from '../engine/quests';
import { humanDate, localDate } from '../engine/dates';
import { type ThemePref, setThemePref, useThemePref } from '../lib/theme';
import { checkForUpdate, installApk, useUpdate } from '../lib/update';
import { Icon } from '../components/Icon';
import { Confirm, ProgressBar, SectionLabel, Sheet, TopBar } from '../components/ui';
import { logError } from '../lib/errorlog';
import { clearErrors, shareReport, useErrors } from '../lib/errorlog';

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'Как в системе' },
  { id: 'dark', label: 'Тёмная' },
  { id: 'light', label: 'Светлая' },
];

export function Toggle({ on, title, sub, onClick }: { on: boolean; title: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" class="menu-row" role="switch" aria-checked={on} onClick={onClick}>
      <span class="menu-row-text"><span class="strong">{title}</span>{sub && <span class="muted small">{sub}</span>}</span>
      <span class={on ? 'switch on' : 'switch'}><span /></span>
    </button>
  );
}

function Group({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <section class="stack-8">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  );
}

export function Settings() {
  const w = useWorld();
  const p = w.profile;
  const [name, setNameDraft] = useState(p?.name ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  const theme = useThemePref();
  const off = new Set(p?.weeklyOff ?? []);
  const reminder = p?.backupReminder !== false;
  // Скрытый раздел «Эксперименты»: 5 тапов по номеру версии. Видимость запоминается на устройстве.
  const [dev, setDevState] = useState(() => {
    try {
      return localStorage.getItem('lq.dev') === '1';
    } catch {
      return false;
    }
  });
  const setDev = (on: boolean) => {
    setDevState(on);
    try {
      localStorage.setItem('lq.dev', on ? '1' : '0');
    } catch {
      /* не критично */
    }
  };

  return (
    <div class="page">
      <TopBar crumbs="Ещё" title="Настройки" />

      <Group label="Персонаж">
        <form class="input-row" onSubmit={(e) => { e.preventDefault(); setName(name); }}>
          <input id="profile-name" class="input" value={name} onInput={(e) => setNameDraft(e.currentTarget.value)} aria-label="Имя персонажа" />
          <button type="submit" class="btn ghost" disabled={name.trim() === (p?.name ?? '')}>Сохранить</button>
        </form>
      </Group>

      <Group label="Оформление">
        <div class="theme-grid" role="radiogroup" aria-label="Тема">
          {THEMES.map((t) => (
            <button type="button" role="radio" aria-checked={theme === t.id} class={theme === t.id ? 'theme-card on' : 'theme-card'} onClick={() => setThemePref(t.id)} key={t.id}>
              <span class={`theme-swatch ${t.id}`}><span /></span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <span class="muted small">Другие темы появятся позже.</span>
      </Group>

      <Group label="Недельные квесты">
        <div class="menu-list">
          {WEEKLY_TEMPLATES.map((t) => <Toggle key={t.id} on={!off.has(t.id)} title={t.title} sub={`+${t.reward} XP`} onClick={() => toggleWeeklyTemplate(t.id)} />)}
        </div>
      </Group>

      <Group label="Резервная копия">
        <div class="menu-list">
          <Toggle on={reminder} title="Напоминать раз в неделю" sub={p?.lastBackupAt ? `последняя копия: ${humanDate(p.lastBackupAt.slice(0, 10)).toLowerCase()}` : 'копий ещё не было'} onClick={() => db.profile.update('me', { backupReminder: !reminder })} />
          <a class="menu-row" href="#/backup"><span class="menu-row-text"><span class="strong">Сделать копию или восстановить</span></span><Icon name="right" size={16} stroke={2.4} /></a>
        </div>
      </Group>

      <Group label="AI-помощник">
        <AiBlock />
      </Group>

      <Group label="Звуки">
        <SoundSettings />
      </Group>

      <Group label="Напоминания">
        <ReminderSettings />
      </Group>

      <Group label="О приложении">
        <div class="menu-list">
          <AboutRow onSecret={() => setDev(true)} />
          <ErrorLogRow />
          <a class="menu-row" href="#/changelog"><span class="menu-row-text"><span class="strong">Что нового</span></span><Icon name="right" size={16} stroke={2.4} /></a>
        </div>
      </Group>

      {dev && (
        <Group label="Эксперименты">
          <div class="menu-list">
            {EXPERIMENTS.map((e) => (
              <Toggle key={e.id} on={w.hasExp(e.id)} title={e.title} sub={e.sub} onClick={() => toggleExperiment(e.id)} />
            ))}
          </div>
          <span class="muted small">Незаконченные функции. Включаются только на этом устройстве, у других всё как было.</span>
          <ChannelPicker />
          <button type="button" class="link small muted" onClick={() => setDev(false)}>Скрыть раздел</button>
        </Group>
      )}

      <button type="button" class="btn ghost danger-text" onClick={() => setConfirmReset(true)}>Стереть все данные</button>
      <p class="muted small center">Всё хранится только на этом устройстве.</p>

      <Confirm
        open={confirmReset}
        title="Стереть все данные?"
        text="Пропадут все действия, фото, XP и изменения в дереве. Отменить нельзя."
        action="Стереть"
        onConfirm={resetAll}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}

function AboutRow({ onSecret }: { onSecret: () => void }) {
  const u = useUpdate();
  const [taps, setTaps] = useState<number[]>([]);
  const tapVersion = () => {
    const now = Date.now();
    const recent = [...taps.filter((t) => now - t < 3000), now];
    setTaps(recent);
    if (recent.length >= 5) {
      setTaps([]);
      onSecret();
      toast({ kind: 'info', title: 'Открыт раздел «Эксперименты»' });
    }
  };
  const native = Capacitor.isNativePlatform();
  const sub =
    !native ? 'сайт обновляется сам'
      : u.kind === 'checking' ? 'проверяю…'
        : u.kind === 'web' ? `${u.version} скачана — включится при следующем запуске`
          : u.kind === 'apk' || u.kind === 'downloading' || u.kind === 'error' ? 'нужно обновить приложение — карточка на главном'
            : u.kind === 'latest' ? 'последняя · обновляется сама'
              : 'обновляется сама';
  return (
    <div class="menu-row">
      <span class="menu-row-text"><button type="button" class="version-tap strong" onClick={tapVersion}>Версия {__APP_VERSION__}</button><span class={u.kind === 'latest' || !native ? 'small ok-text' : 'muted small'}>{sub}</span></span>
      {native && <button type="button" class="link small" onClick={() => checkForUpdate(true)} disabled={u.kind === 'checking' || u.kind === 'downloading'}>Проверить</button>}
    </div>
  );
}

/** Главный экран: «Доступна версия» — только когда нужен новый APK. Иначе показывает fallback. */
let hiddenThisSession = false;
export function UpdateCard({ fallback }: { fallback?: ComponentChildren }) {
  const u = useUpdate();
  const [hidden, setHidden] = useState(hiddenThisSession);
  if (hidden || (u.kind !== 'apk' && u.kind !== 'downloading' && u.kind !== 'error')) return <>{fallback}</>;
  const v = u.remote?.version ?? '';
  if (u.kind === 'downloading') {
    return (
      <section class="update-card">
        <span class="spread"><span class="strong">Скачиваю версию {v}…</span><span class="ok-text strong">{u.pct}%</span></span>
        <ProgressBar pct={u.pct} color="var(--green)" height={8} />
        <span class="muted small">Потом Android спросит, можно ли установить. Первый раз — разреши установку для LifeQuest.</span>
      </section>
    );
  }
  return (
    <section class="update-card">
      <div class="update-head">
        <span class="update-icon"><Icon name="download" size={22} stroke={2.4} /></span>
        <span class="stack-4">
          <span class="strong">{u.kind === 'error' ? 'Не получилось скачать' : `Доступна версия ${v}`}</span>
          <span class="muted small">{u.kind === 'error' ? 'Проверь интернет и попробуй ещё раз.' : 'Нужно обновить приложение — это минута, данные останутся.'}</span>
        </span>
      </div>
      <button type="button" class="btn update-btn" onClick={() => installApk()}>{u.kind === 'error' ? 'Попробовать ещё раз' : 'Скачать и установить'}</button>
      <span class="spread small strong">
        <a class="ok-text" href="https://github.com/yami-skh/lifequest/releases/latest" target="_blank" rel="noopener">Что в ней нового →</a>
        <button type="button" class="link small muted" onClick={() => { hiddenThisSession = true; setHidden(true); }}>позже</button>
      </span>
    </section>
  );
}

/** Код доступа к AI-помощнику: сохранить → проверить на сервере. */
function AiBlock() {
  const w = useWorld();
  const saved = w.profile?.aiCode ?? '';
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(!saved);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    const code = draft.trim();
    if (!code) {
      await setAiCode('');
      setStatus(null);
      return;
    }
    setStatus({ ok: true, text: 'проверяю…' });
    try {
      const q = await fetchQuota(code);
      await setAiCode(code);
      setEditing(false);
      setStatus({ ok: true, text: `подключено · сегодня осталось ${q.remaining}` });
    } catch (e) {
      setStatus({ ok: false, text: e instanceof AiError ? e.message : 'Не удалось проверить код' });
    }
  };

  return (
    <div class="menu-list ai-box">
      <div class="menu-row">
        <span class="ai-icon"><Icon name="spark" size={18} /></span>
        <span class="menu-row-text"><span class="strong">Цели от Claude</span><span class="muted small">Кнопка «Предложить цели» на странице навыка. Нужен код доступа.</span></span>
        {saved && !editing && <span class="small ok-text">подключено</span>}
      </div>
      <form class="input-row ai-code" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {editing ? (
          <input id="ai-code" class="input" type="password" autoComplete="off" placeholder="Код доступа" value={draft} onInput={(e) => setDraft(e.currentTarget.value)} aria-label="Код доступа к AI-помощнику" />
        ) : (
          <span class="input ai-dots">••••••••</span>
        )}
        {editing
          ? <button type="submit" class="btn ghost" disabled={!draft.trim() && !saved}>{draft.trim() || !saved ? 'Сохранить' : 'Убрать'}</button>
          : <button type="button" class="btn ghost" onClick={() => { setEditing(true); setDraft(saved); }}>Изменить</button>}
      </form>
      {status && <span class={status.ok ? 'small ok-text ai-status' : 'small danger-text ai-status'}>{status.text}</span>}
      {!saved && <span class="muted small ai-status">Без кода кнопки нет — приложение работает как раньше.</span>}
    </div>
  );
}

/** Канал обновлений: APK — переключатель; сайт — ссылка на другой адрес (у сайтов общие данные). */
function ChannelPicker() {
  const [ch, setCh] = useState<Channel>(getChannel);
  const [busy, setBusy] = useState(false);
  if (!Capacitor.isNativePlatform()) {
    const beta = ch === 'beta';
    return (
      <div class="menu-list">
        <a class="menu-row" href={beta ? '../' : 'beta/'}>
          <span class="menu-row-text"><span class="strong">Канал: {beta ? 'бета' : 'стабильная'}</span><span class="muted small">{beta ? 'перейти на стабильный сайт' : 'открыть сайт беты — каждая новая сборка'}</span></span>
          <Icon name="right" size={16} stroke={2.4} />
        </a>
      </div>
    );
  }
  const pick = async (next: Channel) => {
    if (next === ch || busy) return;
    setBusy(true);
    try {
      if (next === 'beta') {
        await setChannel('beta');
        setCh('beta');
        toast({ kind: 'info', title: 'Канал: бета', sub: 'Обновления придут при следующей проверке' });
        checkForUpdate(true);
      } else {
        // Снимок данных, скачать стабильную и сразу включить — приложение перезапустится уже на ней.
        toast({ kind: 'info', title: 'Переходим на стабильную', sub: 'Скачиваю сборку, приложение перезапустится' });
        await setChannel('stable');
      }
    } catch (e) {
      logError(e, 'Смена канала');
      toast({ kind: 'info', title: 'Не удалось сменить канал', sub: e instanceof Error ? e.message : undefined });
    }
    setBusy(false);
  };
  return (
    <div class="stack-8">
      <span class="small strong">Канал обновлений</span>
      <div class="segmented" role="radiogroup" aria-label="Канал обновлений">
        <button type="button" role="radio" aria-checked={ch === 'stable'} class={ch === 'stable' ? 'on' : ''} disabled={busy} onClick={() => pick('stable')}>Стабильная</button>
        <button type="button" role="radio" aria-checked={ch === 'beta'} class={ch === 'beta' ? 'on' : ''} disabled={busy} onClick={() => pick('beta')}>Бета</button>
      </div>
      <span class="muted small">Бета — каждая новая сборка, может ломаться. Возврат на стабильную сначала сохраняет снимок данных.</span>
    </div>
  );
}

/** «Журнал ошибок»: строка видна, только если ошибки есть. Макет: холст, «Фаза 0». */
function ErrorLogRow() {
  const errors = useErrors();
  const [open, setOpen] = useState(false);
  if (!errors.length) return null;
  const weekAgo = Date.now() - 7 * 86400_000;
  const week = errors.filter((e) => Date.parse(e.at) > weekAgo).length;
  const when = (iso: string) => `${humanDate(localDate(new Date(iso))).toLowerCase()} ${new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  const send = async () => {
    const r = await shareReport();
    if (r === 'copied') toast({ kind: 'info', title: 'Отчёт скопирован', sub: 'Вставь его в сообщение' });
  };
  return (
    <>
      <button type="button" class="menu-row" onClick={() => setOpen(true)}>
        <span class="menu-row-text"><span class="strong">Журнал ошибок</span></span>
        <span class="err-count">{errors.length}</span>
        <Icon name="right" size={16} stroke={2.4} />
      </button>
      {open && (
        <Sheet open onClose={() => setOpen(false)} title="Журнал ошибок">
          <span class="muted small err-sub">{week} за последние 7 дней · хранится на телефоне</span>
          <div class="stack-8 err-list">
            {errors.map((e, i) => (
              <div class="err-item" key={i}>
                <span class="spread small muted"><span>{e.where || '—'}</span><span>{when(e.at)}</span></span>
                <span class="err-msg">{e.message}</span>
              </div>
            ))}
          </div>
          <div class="ai-privacy"><span>В отчёте — версия, канал, устройство и тексты ошибок. Действия, фото и заметки не попадают.</span></div>
          <button type="button" class="btn primary" onClick={send}>Отправить отчёт</button>
          <button type="button" class="link small muted err-clear" onClick={() => { clearErrors(); setOpen(false); }}>Очистить журнал</button>
        </Sheet>
      )}
    </>
  );
}
