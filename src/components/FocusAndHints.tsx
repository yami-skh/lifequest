// Главный экран: «В фокусе» и «Ближайшее». ARCHITECTURE.md §16, идеи 1 и 5.
import { useWorld } from '../db/world';
import { Icon } from './Icon';
import { Ring, SectionLabel } from './ui';

export function FocusBlock() {
  const w = useWorld();
  const list = w.focusSkills;
  return (
    <section class="stack-10">
      <SectionLabel right={<a class="link small" href="#/tree">{list.length ? 'Изменить' : 'Выбрать'}</a>}>В фокусе · ×1.2 XP</SectionLabel>
      {list.length === 0 ? (
        <p class="muted small">Отметь до трёх навыков звёздочкой на их странице — они будут здесь и дадут больше XP.</p>
      ) : (
        <div class="focus-grid">
          {list.map((n) => {
            const lv = w.skillLevelOf(n.id);
            const color = w.areaOf(n.id)?.color;
            const fresh = !w.explored(n.id);
            return (
              <a class="focus-card" href={`#/skill/${n.id}`} key={n.id} style={{ '--c': color }}>
                <Ring pct={fresh ? 0 : lv.pct} size={48} stroke={4} color="var(--c)">
                  <span class={fresh ? 't-lvl muted' : 't-lvl'}>{fresh ? '0' : lv.level}</span>
                </Ring>
                <span class="focus-title">{n.title}</span>
                <span class="focus-sub">{fresh ? 'первая запись ×1.5' : lv.level >= 10 ? 'максимум' : `до ур. ${lv.level + 1} — ${lv.left} XP`}</span>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function HintsBlock() {
  const w = useWorld();
  const hints = w.hints();
  if (hints.length === 0) return null;
  return (
    <section class="stack-8">
      <SectionLabel>Ближайшее</SectionLabel>
      {hints.map((h) => {
        if (h.kind === 'level') {
          return (
            <a class="hint" href={`#/skill/${h.node.id}`} key="level">
              <span class="hint-icon gold"><Icon name="star" size={18} stroke={2.2} /></span>
              <span class="hint-text"><span class="strong">{h.node.title} почти на {h.next} уровне</span><span class="muted small">ещё {h.left} XP</span></span>
            </a>
          );
        }
        if (h.kind === 'goal') {
          return (
            <a class="hint" href={`#/skill/${h.node.id}`} key="goal">
              <span class="hint-icon green"><Icon name="target" size={18} stroke={2.2} /></span>
              <span class="hint-text"><span class="strong">«{h.goal.title}»</span><span class="muted small">{h.node.title} · закроешь — {h.area.title} +{Math.max(1, Math.round(h.delta))}%</span></span>
            </a>
          );
        }
        if (h.kind === 'unlock') {
          return (
            <a class="hint" href={`#/skill/${h.reason.node.id}`} key="unlock">
              <span class="hint-icon"><Icon name="lock" size={18} stroke={2.2} /></span>
              <span class="hint-text"><span class="strong">{h.node.title} скоро откроется</span><span class="muted small">{h.reason.node.title}: {h.reason.have} из {h.reason.need}</span></span>
            </a>
          );
        }
        return (
          <a class="hint rust" href={`#/skill/${h.node.id}`} key="rust">
            <span class="hint-icon"><Icon name="web" size={18} stroke={1.8} /></span>
            <span class="hint-text"><span class="strong">{h.node.title} зарос паутиной</span><span class="muted small">{h.days} дней без записей · вернись: +50% XP</span></span>
          </a>
        );
      })}
    </section>
  );
}
