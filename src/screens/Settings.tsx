// Настройки: персонаж, тема, недельные квесты, резервная копия, о приложении, стереть данные.
// Макет: холст, страница «Настройки и обновления». Карточка обновления на главном — UpdateCard.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { useWorld } from '../db/world';
import { db } from '../db/db';
import { resetAll, setName, toggleWeeklyTemplate } from '../db/actions';
import { WEEKLY_TEMPLATES } from '../engine/quests';
import { humanDate } from '../engine/dates';
import { type ThemePref, setThemePref, useThemePref } from '../lib/theme';
import { checkForUpdate, installApk, useUpdate } from '../lib/update';
import { Icon } from '../components/Icon';
import { Confirm, ProgressBar, SectionLabel, TopBar } from '../components/ui';

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'Как в системе' },
  { id: 'dark', label: 'Тёмная' },
  { id: 'light', label: 'Светлая' },
];

function Toggle({ on, title, sub, onClick }: { on: boolean; title: string; sub?: string; onClick: () => void }) {
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

      <Group label="Звуки и напоминания">
        <div class="menu-list soon-box"><div class="menu-row"><span class="menu-row-text">Звуки за XP, напоминание записать день</span><span class="soon-tag">скоро</span></div></div>
      </Group>

      <Group label="О приложении">
        <div class="menu-list">
          <AboutRow />
          <a class="menu-row" href="#/changelog"><span class="menu-row-text"><span class="strong">Что нового</span></span><Icon name="right" size={16} stroke={2.4} /></a>
        </div>
      </Group>

      <button type="button" class="btn ghost danger-text" onClick={() => setConfirmReset(true)}>Стереть все данные</button>
      <p class="muted small center">Всё хранится только на этом устройстве.</p>

      <Confirm
        open={confirmReset}
        title="Стереть все данные?"
        text="Пропадут все записи, фото, XP и изменения в дереве. Отменить нельзя."
        action="Стереть"
        onConfirm={resetAll}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}

function AboutRow() {
  const u = useUpdate();
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
      <span class="menu-row-text"><span class="strong">Версия {__APP_VERSION__}</span><span class={u.kind === 'latest' || !native ? 'small ok-text' : 'muted small'}>{sub}</span></span>
      {native && <button type="button" class="link small" onClick={() => checkForUpdate()} disabled={u.kind === 'checking' || u.kind === 'downloading'}>Проверить</button>}
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
          <span class="muted small">{u.kind === 'error' ? 'Проверь интернет и попробуй ещё раз.' : 'Нужно обновить приложение — это минута, записи останутся.'}</span>
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
