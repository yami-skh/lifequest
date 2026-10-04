import { useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { humanDate } from '../engine/dates';
import { EntryCard } from '../components/EntryCard';
import { SectionLabel, TopBar } from '../components/ui';

export function Journal() {
  const w = useWorld();
  const [area, setArea] = useState<string | null>(null);
  const [onlyFails, setOnlyFails] = useState(false);

  const list = w.entries.filter((e) => {
    if (onlyFails && e.outcome !== 'fail') return false;
    if (!area) return true;
    return (w.skillsOfEntry.get(e.id) ?? []).some((s) => w.areaOf(s.skillId)?.id === area);
  });

  const groups: [string, typeof list][] = [];
  for (const e of list) {
    const last = groups[groups.length - 1];
    if (last && last[0] === e.date) last[1].push(e);
    else groups.push([e.date, [e]]);
  }

  return (
    <div class="page">
      <TopBar title="Журнал" />
      <div class="chips scroll-x">
        <button type="button" class={!area && !onlyFails ? 'chip big primary' : 'chip big'} onClick={() => { setArea(null); setOnlyFails(false); }}>Все</button>
        {w.areas.map((a) => (
          <button type="button" key={a.id} class={area === a.id ? 'chip big primary' : 'chip big'} onClick={() => setArea(area === a.id ? null : a.id)}>{a.title}</button>
        ))}
        <button type="button" class={onlyFails ? 'chip big primary' : 'chip big'} onClick={() => setOnlyFails(!onlyFails)}>Ошибки</button>
      </div>
      {groups.length === 0 && <p class="muted">Записей пока нет. Нажми ＋ внизу, чтобы добавить первую.</p>}
      {groups.map(([date, entries]) => (
        <section class="stack-10" key={date}>
          <SectionLabel right={<span class="muted small strong">+{entries.reduce((s, e) => s + (w.skillsOfEntry.get(e.id)?.find((x) => x.role === 'primary')?.xp ?? e.rewardXp ?? 0), 0)} XP</span>}>{humanDate(date)}</SectionLabel>
          {entries.map((e) => <EntryCard entry={e} key={e.id} showDate={false} />)}
        </section>
      ))}
    </div>
  );
}
