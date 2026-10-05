// Главный экран — всё важное примерно в один экран. Макет: холст, страница «Упрощение», экран 1.
import { useWorld } from '../db/world';
import { Icon } from '../components/Icon';
import { AreaTile, ProgressBar, Ring, SectionLabel, pctText } from '../components/ui';
import { EntryCard } from '../components/EntryCard';
import { InstallCard } from '../components/InstallCard';
import { BackupReminder } from './Backup';
import { UpdateCard } from './Settings';
import { ReminderPrompt } from '../components/Reminders';
import { weekStart } from '../engine/quests';
import { localDate } from '../engine/dates';
import { ac } from '../lib/theme';

export function Character({ onAdd }: { onAdd: () => void }) {
  const w = useWorld();
  const lvl = w.level;
  const strongest = w.totalXp > 0 ? [...w.areas].sort((a, b) => (w.xpByNode.get(b.id) ?? 0) - (w.xpByNode.get(a.id) ?? 0))[0] : undefined;
  const last = w.entries.find((e) => e.type !== 'bonus');

  return (
    <div class="page">
      <header class="char-head compact">
        <div class="char-id">
          <span class="lvl-box small"><span class="lvl-cap">LVL</span><span class="lvl-num">{lvl.level}</span></span>
          <span class="stack-4">
            <h1 class="display char-name">{w.profile?.name ?? 'mildyan'}</h1>
            <span class="char-xp">
              <span class="char-xp-bar"><ProgressBar pct={lvl.pct} color="var(--gold)" height={6} /></span>
              <span class="muted small strong">{lvl.into}/{lvl.needed}</span>
            </span>
          </span>
        </div>
        <div class={w.streak > 0 ? 'streak on' : 'streak'} title="Дней подряд с записью">
          <Icon name="flame" size={16} />
          <span>{w.streak}</span>
        </div>
      </header>

      {/* Один баннер за раз: обновление, потом «Установи», потом напоминание о копии. */}
      <UpdateCard fallback={<InstallCard fallback={<BackupReminder />} />} />

      <TodayCard onAdd={onAdd} />
      <ReminderPrompt />

      <section class="stack-8">
        <SectionLabel right={strongest && <span class="muted small strong">сильнее: {strongest.title}</span>}>Направления</SectionLabel>
        <div class="area-grid">
          {w.areas.map((a) => {
            const p = w.progress.get(a.id);
            return (
              <a class="area-cell" href={`#/tree/${a.id}`} key={a.id} style={{ '--c': ac(a.color) ?? 'var(--muted)' }}>
                <span class="spread area-cell-top">
                  <span class="area-cell-name">{a.icon ? <Icon name={a.icon} size={16} stroke={2.2} /> : <AreaTile node={a} size={16} />}{a.title}</span>
                  <span class="muted">{pctText(p)}</span>
                </span>
                <ProgressBar pct={p ?? 0} color={ac(a.color)} height={5} />
              </a>
            );
          })}
          <a class="area-cell more" href="#/tree">Всё дерево →</a>
        </div>
      </section>

      {last ? (
        <section class="stack-8">
          <SectionLabel right={<a href="#/journal" class="link small">Журнал →</a>}>Последняя запись</SectionLabel>
          <EntryCard entry={last} />
        </section>
      ) : (
        <button type="button" class="empty" onClick={onAdd}>
          <Icon name="plus" size={28} stroke={2.4} />
          <span class="strong">Сделай первую запись</span>
          <span class="muted small">Что сегодня изучил или сделал? Выбери навык и получи XP.</span>
        </button>
      )}
    </div>
  );
}

const WEEK_SHORT: Record<string, string> = { w_workouts: 'тренировки', w_photo: 'фото', w_areas: 'направления' };

/** «Сегодня»: фокус, лучшая подсказка, главный квест и недельные — одной карточкой. */
function TodayCard({ onAdd }: { onAdd: () => void }) {
  const w = useWorld();
  const hint = w.hints()[0];
  const week = weekStart(localDate());
  const mainQ = w.quests.find((q) => q.status === 'active' && q.kind === 'main') ?? w.quests.find((q) => q.status === 'active' && q.kind === 'side');
  const weekly = w.quests.filter((q) => q.kind === 'weekly' && q.week === week && (q.status === 'active' || q.status === 'done'));

  let hintView: { href: string; icon: string; text: string } | undefined;
  if (hint?.kind === 'level') hintView = { href: `#/skill/${hint.node.id}`, icon: 'star', text: `${hint.node.title}: ещё ${hint.left} XP до ${hint.next} ур.` };
  else if (hint?.kind === 'goal') hintView = { href: `#/skill/${hint.node.id}`, icon: 'target', text: `«${hint.goal.title}» → ${hint.area.title} +${Math.max(1, Math.round(hint.delta))}%` };
  else if (hint?.kind === 'unlock') hintView = { href: `#/skill/${hint.reason.node.id}`, icon: 'lock', text: `${hint.node.title} скоро откроется: ${hint.reason.have} из ${hint.reason.need}` };
  else if (hint) hintView = { href: `#/skill/${hint.node.id}`, icon: 'web', text: `${hint.node.title}: ${hint.days} дн. без записей, вернись +50%` };

  return (
    <section class="today">
      <div class="spread">
        <span class="today-label">Сегодня</span>
        {w.focusSkills.length > 0 ? <span class="muted small strong">фокус ×1.2 XP</span> : <a class="link small" href="#/tree">выбрать фокус</a>}
      </div>
      {w.focusSkills.length > 0 && (
        <div class="focus-pills">
          {w.focusSkills.map((n) => {
            const lv = w.skillLevelOf(n.id);
            const fresh = !w.explored(n.id);
            return (
              <a class="focus-pill" href={`#/skill/${n.id}`} key={n.id} style={{ '--c': ac(w.areaOf(n.id)?.color) ?? 'var(--gold)' }}>
                <Ring pct={fresh ? 0 : lv.pct} size={28} stroke={3} color="var(--c)"><span class="pill-lvl">{fresh ? 0 : lv.level}</span></Ring>
                <span class="pill-title">{n.title}</span>
              </a>
            );
          })}
        </div>
      )}
      {hintView ? (
        <a class="today-hint" href={hintView.href}><Icon name={hintView.icon} size={18} stroke={2.2} /><span>{hintView.text}</span><Icon name="right" size={16} stroke={2.4} /></a>
      ) : (
        <button type="button" class="today-hint" onClick={onAdd}><Icon name="plus" size={18} stroke={2.4} /><span>Запиши, что сделал сегодня</span></button>
      )}
      {mainQ && (() => {
        const p = w.questProgress(mainQ);
        return (
          <a class="today-quest" href={`#/quests/${mainQ.id}`}>
            <span class="spread small strong"><span>{mainQ.title}</span><span class="muted">{p.done}/{p.total} · +{mainQ.rewardXp}</span></span>
            <ProgressBar pct={p.pct} color="var(--gold)" height={6} />
          </a>
        );
      })()}
      {weekly.length > 0 && (
        <a class="week-chips" href="#/quests">
          <span class="week-chip">Неделя:</span>
          {weekly.map((q) => {
            const s = w.questProgress(q).steps[0];
            const done = q.status === 'done';
            return <span class={done ? 'week-chip done' : 'week-chip'} key={q.id}>{WEEK_SHORT[q.template ?? ''] ?? q.title} {done ? '✓' : `${s?.have ?? 0}/${s?.target ?? 1}`}</span>;
          })}
        </a>
      )}
    </section>
  );
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
