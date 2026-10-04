import { useWorld } from '../db/world';
import { evaluateAchievements } from '../engine/achievements';
import { Icon } from '../components/Icon';
import { ProgressBar, SectionLabel, TopBar } from '../components/ui';

export function Achievements() {
  const w = useWorld();
  // Полученное достижение не пропадает, даже если запись потом удалили.
  const have = new Set(w.unlocked.map((u) => u.achievementId));
  const all = evaluateAchievements(w.stats()).map((a) => ({ ...a, done: a.done || have.has(a.def.id) }));
  const done = all.filter((a) => a.done);
  const inProgress = all.filter((a) => !a.done && !a.def.hidden);
  const hidden = all.filter((a) => !a.done && a.def.hidden);

  return (
    <div class="page">
      <TopBar title="Достижения" right={<span class="muted strong">{done.length} из {all.length}</span>} />

      {done.length > 0 && (
        <section class="stack-10">
          <SectionLabel>Получено</SectionLabel>
          <div class="ach-grid">
            {done.map(({ def }) => (
              <div class="ach got" key={def.id}>
                <span class="ach-icon"><Icon name={def.icon} size={22} stroke={2.2} /></span>
                <span class="strong">{def.title}</span>
                <span class="small ach-desc">{def.desc}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section class="stack-10">
        <SectionLabel>В процессе</SectionLabel>
        {inProgress.map(({ def, value }) => (
          <div class="ach-row" key={def.id}>
            <span class="ach-icon dim"><Icon name={def.icon} size={20} /></span>
            <span class="area-body">
              <span class="spread strong"><span>{def.title}</span><span class="muted">{value} / {def.target}{def.unit ? ` ${def.unit}` : ''}</span></span>
              <ProgressBar pct={(value / def.target) * 100} color="var(--gold)" height={5} />
              <span class="muted small">{def.desc}</span>
            </span>
          </div>
        ))}
      </section>

      {hidden.length > 0 && (
        <section class="stack-10">
          <SectionLabel>Скрытые</SectionLabel>
          <div class="ach-grid">
            {hidden.map(({ def }) => (
              <div class="ach hidden-ach" key={def.id}><span class="q">?</span>Скрытое</div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
