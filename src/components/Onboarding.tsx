// Первый запуск: «Кем хочешь стать?» — выбор готовых путей вместо общего стартового дерева.
// Макет: холст, «Пресеты и первый запуск». Показывается, пока profile.onboarding (db/seed.ts).
import { useMemo, useState } from 'preact/hooks';
import { finishOnboarding } from '../db/actions';
import { TEMPLATES } from '../data/templates';
import { planImportMany, templateStats } from '../engine/templates';
import { ac } from '../lib/theme';
import { go } from '../lib/router';
import { logError } from '../lib/errorlog';
import { Check } from './ui';
import { plural } from '../screens/Character';

const SHOWN = 5;

export function Onboarding() {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(['start']));
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');

  const chosen = TEMPLATES.filter((t) => picked.has(t.id));
  // Совпадающие навыки разных путей не дублируются: «Старт» + «Сильное тело» = 11, а не 12.
  const skills = useMemo(() => {
    let n = 0;
    return planImportMany(chosen, { nodes: [], goals: [], metrics: [] }, () => `n${++n}`).reduce((s, p) => s + p.skills.filter((x) => x.isNew).length, 0);
  }, [picked]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const start = async (list: typeof TEMPLATES) => {
    setBusy(true);
    try {
      await finishOnboarding(list, name);
      // На главный: там «Следующее действие» сразу говорит, что делать (выбрать активные навыки). В дереве новичок терялся.
      go('');
    } catch (e) {
      logError(e, 'Первый запуск');
      setBusy(false);
    }
  };

  const list = all ? TEMPLATES : TEMPLATES.slice(0, SHOWN);
  return (
    <div class="page onb">
      <span class="onb-brand">LifeQuest</span>
      <label class="stack-4" for="onb-name">
        <span class="section-label">Как тебя зовут?</span>
        <input id="onb-name" class="input onb-name" maxLength={40} autoComplete="nickname" placeholder="Герой" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <span class="muted small">Имя персонажа. Можно пропустить — будет «Герой», поменять — в Настройках.</span>
      </label>
      <h1 class="display onb-title">Кем хочешь стать?</h1>
      <p class="muted">Выбери один или несколько путей: навыки, цели по этапам и замеры уже расписаны. Потом можно добавить ещё или собрать своё.</p>
      <div class="stack-8">
        {list.map((t) => {
          const s = templateStats(t);
          const on = picked.has(t.id);
          return (
            <button type="button" key={t.id} class={on ? 'onb-card on' : 'onb-card'} aria-pressed={on} onClick={() => toggle(t.id)}>
              <Check done={on} />
              <span class="tpl-card-body">
                <span class="tpl-card-title">{t.title}</span>
                {t.description && <span class="tpl-desc">{t.description}</span>}
                <span class="tpl-chips">
                  {t.areas.map((a) => {
                    const c = ac(a.color) ?? 'var(--muted)';
                    return <span key={a.title} class="tpl-chip" style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}>{a.title}</span>;
                  })}
                </span>
                <span class="t-sub">{s.skills} {plural(s.skills, 'навык', 'навыка', 'навыков')} · {s.goals} {plural(s.goals, 'цель', 'цели', 'целей')}{t.campaign ? ' · кампания' : ''}</span>
              </span>
            </button>
          );
        })}
        {!all && TEMPLATES.length > SHOWN && (
          <button type="button" class="link small muted onb-more" onClick={() => setAll(true)}>
            ещё {TEMPLATES.length - SHOWN} {plural(TEMPLATES.length - SHOWN, 'путь', 'пути', 'путей')} ▾
          </button>
        )}
      </div>
      <div class="onb-actions">
        <button type="button" class="btn primary" disabled={busy || chosen.length === 0} onClick={() => start(chosen)}>
          {chosen.length ? `Начать · ${skills} ${plural(skills, 'навык', 'навыка', 'навыков')}` : 'Выбери хотя бы один путь'}
        </button>
        <button type="button" class="link small onb-empty" disabled={busy} onClick={() => start([])}>Начать с пустого дерева</button>
        <a class="link small muted onb-empty" href="#/backup">Есть резервная копия? Восстановить</a>
      </div>
    </div>
  );
}
