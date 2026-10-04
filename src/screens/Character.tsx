import { useWorld } from '../db/world';
import { Icon } from '../components/Icon';
import { AreaTile, ProgressBar, SectionLabel, pctText } from '../components/ui';
import { EntryCard } from '../components/EntryCard';
import { InstallCard } from '../components/InstallCard';
import { FocusBlock, HintsBlock } from '../components/FocusAndHints';

export function Character({ onAdd }: { onAdd: () => void }) {
  const w = useWorld();
  const lvl = w.level;
  const strongest = [...w.areas].sort((a, b) => (w.xpByNode.get(b.id) ?? 0) - (w.xpByNode.get(a.id) ?? 0))[0];
  const hasXp = w.totalXp > 0;

  return (
    <div class="page">
      <header class="char-head">
        <div class="stack-4">
          <div class="muted small strong">Персонаж</div>
          <h1 class="display">{w.profile?.name ?? 'mildyan'}</h1>
          <div class="gold small strong">{hasXp && strongest ? `Сильнее всего: ${strongest.title}` : 'Путь только начинается'}</div>
        </div>
        <div class={w.streak > 0 ? 'streak on' : 'streak'} title="Дней подряд с записью">
          <Icon name="flame" size={18} />
          <span>{w.streak} {plural(w.streak, 'день', 'дня', 'дней')}</span>
        </div>
      </header>

      <section class="card stack-12">
        <div class="lvl-row">
          <div class="lvl-box">
            <span class="lvl-cap">LVL</span>
            <span class="lvl-num">{lvl.level}</span>
          </div>
          <div class="stack-4">
            <div class="strong">Уровень {lvl.level}</div>
            <div class="muted small">до {lvl.level + 1} уровня ещё {lvl.left} XP</div>
          </div>
        </div>
        <ProgressBar pct={lvl.pct} color="var(--gold)" height={10} />
        <div class="spread muted small strong">
          <span>{lvl.into} / {lvl.needed} XP</span>
          <span>всего {w.totalXp} XP</span>
        </div>
      </section>

      <InstallCard />

      <FocusBlock />

      <HintsBlock />

      <section class="stack-10">
        <SectionLabel>Направления</SectionLabel>
        {w.areas.map((a) => {
          const p = w.progress.get(a.id);
          return (
            <a class="area-row" href={`#/tree/${a.id}`} key={a.id}>
              <AreaTile node={a} />
              <span class="area-body">
                <span class="spread strong"><span>{a.title}</span><span class="muted">{pctText(p)}</span></span>
                <ProgressBar pct={p ?? 0} color={a.color} height={6} />
              </span>
            </a>
          );
        })}
      </section>

      <section class="stack-10">
        <SectionLabel right={w.entries.length > 3 && <a href="#/journal" class="link small">Весь журнал</a>}>Последние записи</SectionLabel>
        {w.entries.length === 0 ? (
          <button type="button" class="empty" onClick={onAdd}>
            <Icon name="plus" size={28} stroke={2.4} />
            <span class="strong">Сделай первую запись</span>
            <span class="muted small">Что сегодня изучил или сделал? Выбери навык и получи XP.</span>
          </button>
        ) : (
          w.entries.slice(0, 3).map((e) => <EntryCard entry={e} key={e.id} />)
        )}
      </section>
    </div>
  );
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
