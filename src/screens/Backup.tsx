// «Ещё» → «Резервная копия». Макет: холст, страница «Резервная копия».
import { useRef, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { db } from '../db/db';
import { currentSummary, exportBackup, readBackup, restoreBackup, type BackupSummary, type ParsedBackup } from '../lib/backup';
import { daysBetween, humanDate, localDate } from '../engine/dates';
import { toast } from '../lib/toast';
import { go } from '../lib/router';
import { Icon } from '../components/Icon';
import { Sheet, TopBar } from '../components/ui';
import { plural } from './Character';

export function Backup() {
  const w = useWorld();
  const last = w.profile?.lastBackupAt;
  const reminder = w.profile?.backupReminder !== false;
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [current, setCurrent] = useState<BackupSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const realEntries = w.entries.filter((e) => e.type !== 'bonus');
  const sinceLast = last ? realEntries.filter((e) => e.createdAt > last).length : realEntries.length;

  const save = async () => {
    setBusy(true);
    try {
      const r = await exportBackup();
      if (r === 'shared') toast({ kind: 'info', title: 'Копия сохранена' });
      if (r === 'downloaded') toast({ kind: 'info', title: 'Копия скачана', sub: 'Файл в «Загрузках»' });
    } catch (e) {
      console.error(e);
      toast({ kind: 'info', title: 'Не удалось сохранить копию', sub: 'Попробуй ещё раз' });
    }
    setBusy(false);
  };

  const pick = async (files: FileList | null) => {
    const file = files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    try {
      const [p, cur] = await Promise.all([readBackup(file), currentSummary()]);
      setParsed(p);
      setCurrent(cur);
    } catch (e) {
      toast({ kind: 'info', title: 'Не получилось открыть копию', sub: (e as Error).message });
    }
  };

  const restore = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      await restoreBackup(parsed);
      setParsed(null);
      toast({ kind: 'info', title: 'Данные восстановлены' });
      go('');
    } catch (e) {
      console.error(e);
      toast({ kind: 'info', title: 'Не удалось восстановить', sub: 'Текущие данные не тронуты' });
    }
    setBusy(false);
  };

  return (
    <div class="page">
      <TopBar title="Резервная копия" />

      <section class="card stack-12">
        <div class="backup-head">
          <span class="backup-icon ok"><Icon name="shield" size={22} stroke={2.2} /></span>
          <span class="stack-4">
            <span class="strong">{last ? `Последняя копия: ${agoText(last)}` : 'Копии ещё не было'}</span>
            <span class="muted small">
              {last ? `${humanDate(last.slice(0, 10))} · с тех пор ${sinceLast} ${plural(sinceLast, 'запись', 'записи', 'записей')}` : `${realEntries.length} ${plural(realEntries.length, 'запись', 'записи', 'записей')} · ${w.entries.reduce((n, e) => n + e.photoIds.length, 0)} фото`}
            </span>
          </span>
        </div>
        <p class="small fg-2">Все записи, дерево, цели, заметки и фото — в одном файле <b>.zip</b>. Отправь его себе в Telegram «Избранное» или на Google Диск.</p>
        <button type="button" class="btn primary" disabled={busy} onClick={save}>
          <Icon name="download" size={20} stroke={2.4} />{busy ? 'Готовлю файл…' : 'Сохранить копию'}
        </button>
        <span class="muted small center">Откроется меню «Поделиться» — выбери, куда отправить</span>
      </section>

      <section class="card stack-12">
        <div class="backup-head">
          <span class="backup-icon blue"><Icon name="upload" size={22} stroke={2.2} /></span>
          <span class="stack-4">
            <span class="strong">Восстановить из копии</span>
            <span class="muted small">Перенос на новый телефон или в приложение</span>
          </span>
        </div>
        <button type="button" class="btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}>Выбрать файл .zip</button>
        <input ref={fileRef} id="backup-file" type="file" accept=".zip,application/zip" hidden onChange={(e) => pick(e.currentTarget.files)} />
      </section>

      <section class="stack-8">
        <span class="section-label">Напоминание</span>
        <button type="button" class="toggle-row" role="switch" aria-checked={reminder} onClick={() => db.profile.update('me', { backupReminder: !reminder })}>
          <span class="strong">Напоминать раз в неделю</span>
          <span class={reminder ? 'switch on' : 'switch'}><span /></span>
        </button>
      </section>

      <div class="notice warn">
        <Icon name="alert" size={18} stroke={2.4} />
        <span class="small">Данные хранятся только на этом телефоне. Если удалить приложение без копии — записи пропадут.</span>
      </div>

      {parsed && current && (
        <Sheet open onClose={() => setParsed(null)} title="Восстановить?">
          <span class="muted small">{parsed.fileName}</span>
          <div class="row-2">
            <div class="compare">
              <span class="section-label">Сейчас</span>
              <span class="compare-lvl">ур. {current.level}</span>
              <span class="small fg-2">{current.entries} {plural(current.entries, 'запись', 'записи', 'записей')}<br />{current.photos} фото</span>
            </div>
            <div class="compare new">
              <span class="section-label ok-text">В копии · {parsed.summary.date ? humanDate(parsed.summary.date) : ''}</span>
              <span class="compare-lvl">ур. {parsed.summary.level}</span>
              <span class="small fg-2">{parsed.summary.entries} {plural(parsed.summary.entries, 'запись', 'записи', 'записей')}<br />{parsed.summary.photos} фото</span>
            </div>
          </div>
          <div class="notice error">
            <Icon name="alert" size={18} stroke={2.4} />
            <span class="small">Текущие данные на этом телефоне <b>заменятся</b> данными из копии. Отменить нельзя.</span>
          </div>
          <div class="stack-8">
            <button type="button" class="btn primary" disabled={busy} onClick={restore}>{busy ? 'Восстанавливаю…' : 'Заменить и восстановить'}</button>
            <button type="button" class="btn ghost" onClick={() => setParsed(null)}>Отмена</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function agoText(iso: string) {
  const d = daysBetween(iso.slice(0, 10), localDate());
  if (d <= 0) return 'сегодня';
  if (d === 1) return 'вчера';
  return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
}

/** Напоминание на главном: копии не было 7+ дней и есть новые записи. Крестик — до завтра. */
export function BackupReminder() {
  const w = useWorld();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('lq.backupSnooze') === localDate();
    } catch {
      return false;
    }
  });
  if (hidden || w.profile?.backupReminder === false) return null;
  const last = w.profile?.lastBackupAt;
  const real = w.entries.filter((e) => e.type !== 'bonus');
  const fresh = last ? real.filter((e) => e.createdAt > last) : real;
  if (fresh.length === 0) return null;
  const days = last ? daysBetween(last.slice(0, 10), localDate()) : daysBetween(real[real.length - 1].date, localDate());
  if (days < 7) return null;
  const photos = fresh.reduce((n, e) => n + e.photoIds.length, 0);

  const snooze = () => {
    setHidden(true);
    try {
      localStorage.setItem('lq.backupSnooze', localDate());
    } catch {
      /* не критично */
    }
  };

  return (
    <section class="card backup-reminder stack-10">
      <div class="backup-head">
        <span class="backup-icon gold"><Icon name="shield" size={20} stroke={2.2} /></span>
        <span class="stack-4" style={{ flex: '1' }}>
          <span class="strong">{last ? `Копии не было ${days} ${plural(days, 'день', 'дня', 'дней')}` : 'Копии ещё не было'}</span>
          <span class="muted small">С тех пор {fresh.length} {plural(fresh.length, 'новая запись', 'новые записи', 'новых записей')}{photos ? ` и ${photos} фото` : ''}</span>
        </span>
        <button type="button" class="icon-btn" aria-label="Скрыть до завтра" onClick={snooze}><Icon name="x" size={16} stroke={2.4} /></button>
      </div>
      <a class="btn primary small" href="#/backup">Сохранить копию</a>
    </section>
  );
}
