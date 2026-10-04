// «Что нового»: окно один раз после обновления и история версий в «Ещё». Макет: холст, страница «Что нового».
import { useEffect, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { setSeenVersion } from '../db/actions';
import { CHANGELOG, SEEN_BEFORE_CHANGELOG, type Change, type ChangeKind, type Release } from '../data/changelog';
import { cmpVersion, unseenReleases } from '../engine/version';
import { go } from '../lib/router';
import { Icon } from '../components/Icon';
import { Sheet, TopBar } from '../components/ui';

const KIND: Record<ChangeKind, { label: string; mark: string; icon: string }> = {
  new: { label: 'Новое', mark: '+', icon: 'plus' },
  fix: { label: 'Исправлено', mark: '✓', icon: 'check' },
  better: { label: 'Улучшено', mark: '↑', icon: 'up' },
};
const ORDER: ChangeKind[] = ['new', 'fix', 'better'];

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
const changesWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'изменение' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'изменения' : 'изменений');

/** Окно после обновления. Монтируется в App, показывается само, если есть непросмотренные версии. */
export function WhatsNew() {
  const w = useWorld();
  const p = w.profile;
  const hasData = w.entries.length > 0;
  // Новая установка — показывать нечего; данные были до этой функции — считаем, что видели до 0.5.0.
  const seen = p?.seenVersion ?? (hasData ? SEEN_BEFORE_CHANGELOG : undefined);
  const releases = seen ? unseenReleases(CHANGELOG, seen, __APP_VERSION__) : [];

  useEffect(() => {
    if (p && !p.seenVersion && !hasData) setSeenVersion(__APP_VERSION__);
  }, [p, hasData]);

  if (!p || releases.length === 0) return null;
  const close = () => setSeenVersion(__APP_VERSION__);
  const all = releases.flatMap((r) => r.changes);

  return (
    <Sheet open onClose={close} title={`Обновление ${__APP_VERSION__}`}>
      <p class="muted small whatsnew-sub">было {seen} · вот что изменилось</p>
      {ORDER.map((k) => {
        const list = all.filter((c) => c.kind === k);
        if (!list.length) return null;
        return (
          <section class={`stack-8 wn-group ${k}`} key={k}>
            <span class="wn-label">{KIND[k].label}</span>
            {list.map((c, i) => <ChangeRow c={c} key={i} />)}
          </section>
        );
      })}
      <p class="muted small center">
        Показывается один раз.{' '}
        <button type="button" class="link small" onClick={() => { close(); go('changelog'); }}>Все версии →</button>
      </p>
      <button type="button" class="btn primary" onClick={close}>Понятно</button>
    </Sheet>
  );
}

function ChangeRow({ c }: { c: Change }) {
  return (
    <div class={`wn-row ${c.kind}`}>
      <span class="wn-icon"><Icon name={KIND[c.kind].icon} size={20} stroke={2.6} /></span>
      <span class="stack-4"><span class="strong">{c.title}</span>{c.sub && <span class="muted small">{c.sub}</span>}</span>
    </div>
  );
}

/** Ещё → Что нового: история версий. */
export function Changelog() {
  // Версии, которые ещё не выпущены (записаны заранее), не показываем.
  const list = CHANGELOG.filter((r) => cmpVersion(r.version, __APP_VERSION__) <= 0);
  const [open, setOpen] = useState<string>(list[0]?.version);
  return (
    <div class="page">
      <TopBar crumbs="Ещё" title="Что нового" />
      {list.map((r) => <ReleaseCard r={r} open={open === r.version} onToggle={() => setOpen(open === r.version ? '' : r.version)} key={r.version} />)}
      <p class="wn-legend muted small">
        {ORDER.map((k) => <span key={k}><b class={`wn-mark ${k}`}>{KIND[k].mark}</b> {KIND[k].label.toLowerCase()}</span>)}
      </p>
    </div>
  );
}

function ReleaseCard({ r, open, onToggle }: { r: Release; open: boolean; onToggle: () => void }) {
  const current = r.version === __APP_VERSION__;
  const name = r.title ? `${r.version} · ${r.title}` : r.version;
  return (
    <section class={current ? 'release current' : 'release'}>
      <button type="button" class="release-head" onClick={onToggle} aria-expanded={open}>
        <span class="stack-4">
          <span class="release-name">{name}</span>
          <span class="muted small">{fmtDate(r.date)}{open ? '' : ` · ${r.changes.length} ${changesWord(r.changes.length)}`}</span>
        </span>
        {current ? <span class="release-now">сейчас</span> : <Icon name={open ? 'up' : 'down'} size={18} stroke={2.4} />}
      </button>
      {open && (
        <div class="stack-8">
          {r.changes.map((c, i) => (
            <div class="release-item" key={i}><b class={`wn-mark ${c.kind}`}>{KIND[c.kind].mark}</b><span>{c.title}</span></div>
          ))}
        </div>
      )}
    </section>
  );
}
