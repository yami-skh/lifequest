// «Следующее действие» на главном (мастер-план §3, фаза 2, флаг next-action).
// Макет: холст, «Следующее действие». Логика — engine/nextAction.ts.
import { useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { toggleFocus } from '../db/actions';
import { agoText } from '../engine/nextAction';
import { localDate } from '../engine/dates';
import { ac } from '../lib/theme';
import { go } from '../lib/router';
import { toast } from '../lib/toast';
import type { EntryPreset } from '../screens/EntrySheet';
import { Icon } from './Icon';
import { plural } from '../screens/Character';

export function NextActionCard({ onAdd }: { onAdd: (p: EntryPreset) => void }) {
  const w = useWorld();
  const list = w.nextActions();
  const [i, setI] = useState(0);

  if (list.length === 0) return <ChoosePath />;
  const a = list[i % list.length];
  const node = w.nodeById.get(a.skillId)!;
  const color = ac(w.areaOf(a.skillId)?.color) ?? 'var(--gold)';

  return (
    <section class="na-card" aria-label="Следующее действие">
      <div class="spread">
        <span class="na-label">Следующее действие</span>
        {list.length > 1 && (
          <button type="button" class="na-other" onClick={() => setI(i + 1)}>Другое · {(i % list.length) + 1} из {list.length}<Icon name="right" size={16} stroke={2.4} /></button>
        )}
      </div>
      {a.kind === 'goal' ? (
        <>
          <div class="stack-4">
            <span class="na-skill" style={{ color }}>{node.title} · ступень {a.stage} «{a.stageName}»</span>
            <span class="na-goal">{a.goal.title}</span>
            <span class="na-sub">
              {a.goal.kind === 'theory' ? 'теория' : 'практика'} · {a.left === 1 ? 'последняя цель ступени → +100 XP' : `до ступени ещё ${a.left} ${plural(a.left, 'цель', 'цели', 'целей')}`}
            </span>
            <span class={a.steps ? 'na-steps on' : 'na-steps'}>
              {a.steps
                ? `${a.steps} ${plural(a.steps, 'действие', 'действия', 'действий')} по этой цели · последнее ${agoText(a.lastDate!, localDate())}`
                : 'действий по этой цели пока нет'}
            </span>
          </div>
          <div class="row-2">
            <button type="button" class="btn primary" onClick={() => onAdd({ skillId: a.skillId, goalId: a.goal.id })}>
              {a.goal.kind === 'theory' ? 'Изучал' : 'Сделал шаг'}
            </button>
            <button type="button" class="btn na-done" onClick={() => onAdd({ skillId: a.skillId, goalId: a.goal.id, closeGoal: true })}>
              {a.goal.kind === 'theory' ? 'Разобрался ✓' : 'Цель выполнена ✓'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div class="stack-4">
            <span class="na-skill" style={{ color }}>{node.title} · уровень {w.skillLevelOf(a.skillId).level}</span>
            <span class="na-goal">{a.hasGoals ? 'Все ступени пройдены. Что дальше?' : 'У навыка пока нет целей'}</span>
            <span class="na-sub">Добавь следующую ступень — из готовых путей или своими целями</span>
          </div>
          <button type="button" class="btn primary" onClick={() => go(`skill/${a.skillId}`)}>+ Цели</button>
        </>
      )}
    </section>
  );
}

/** Нет активных путей: предложить навыки, где ближе всего к следующей ступени. */
function ChoosePath() {
  const w = useWorld();
  const list = w.suggestPaths();
  const pick = async (id: string) => {
    if (!(await toggleFocus(id))) toast({ kind: 'info', title: 'Активных навыков уже три' });
  };
  return (
    <section class="na-card na-empty" aria-label="Следующее действие">
      <span class="na-label">Следующее действие</span>
      <span class="na-goal">Выбери навыки, над которыми работаешь сейчас</span>
      <span class="na-sub">До трёх навыков. По ним будет подсказка, что делать дальше, и ×1.2 XP.</span>
      {list.length > 0 ? (
        <div class="stack-4">
          {list.map((s) => {
            const n = w.nodeById.get(s.skillId)!;
            return (
              <div class="na-path" key={s.skillId}>
                <span class="dot" style={{ background: ac(w.areaOf(s.skillId)?.color) ?? 'var(--muted)' }} />
                <span class="strong na-path-title">{n.title}</span>
                <span class="muted small">ступень {s.stage} · {Math.round(s.ratio * 100)}%</span>
                <button type="button" class="link small" onClick={() => pick(s.skillId)}>Выбрать</button>
              </div>
            );
          })}
        </div>
      ) : (
        <span class="muted small">Сначала добавь навык с целями в «Дереве».</span>
      )}
      <a class="link small na-all" href="#/tree">Навыки, где ты ближе всего к следующей ступени · Всё дерево →</a>
    </section>
  );
}
