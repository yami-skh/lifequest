// Строка навыка в дереве (макет: холст, «Дерево: читаемость»). Главный счёт — этап:
// «этап 2 из 4», полоска — цели текущего этапа, последняя строка — что делать или почему закрыт.
// Уровень по XP в строке не показываем (он внутри навыка и у персонажа) — один язык прогресса.

export type RowState = 'locked' | 'new' | 'mastered' | 'rust' | 'active' | 'final' | 'normal';

export interface RowInput {
  /** Названия навыков, которые надо подкачать, чтобы открыть этот. */
  lockedBy: string[];
  explored: boolean;
  /** Дней без действий, если навык заржавел; иначе null. */
  rustDays: number | null;
  focus: boolean;
  /** Этапы по порядку: сколько целей и сколько закрыто. */
  stages: { done: number; total: number }[];
  /** Первая незакрытая цель текущего этапа. */
  nextGoal?: string;
  /** Первая цель навыка — подсказка «начни с…» для не начатого. */
  firstGoal?: string;
}

export interface RowView {
  state: RowState;
  /** Номер текущего этапа для плитки; null — значок (замок, ?, корона). */
  stage: number | null;
  /** Справа от названия: «этап 2 из 4», «закрыт», «не начат», «освоен». */
  right: string;
  /** Полоска целей текущего этапа. */
  bar?: { done: number; total: number };
  line: string;
}

const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

const list = (names: string[]) => (names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`);

export function skillRow(x: RowInput): RowView {
  const total = x.stages.length;
  const idx = x.stages.findIndex((s) => s.done < s.total);
  const allDone = total > 0 && idx === -1;

  // У закрытого и не начатого справа пусто: плитка (замок, «?») и строка уже всё говорят, а длинному названию нужно место.
  if (x.lockedBy.length) return { state: 'locked', stage: null, right: '', line: `закрыт · откроется, когда подкачаешь ${list(x.lockedBy)}` };
  if (allDone) return { state: 'mastered', stage: null, right: 'освоен', line: 'все этапы пройдены' };
  if (!x.explored) {
    const n = total ? `${total} ${plural(total, 'этап', 'этапа', 'этапов')}` : 'целей пока нет';
    return { state: 'new', stage: null, right: '', line: x.firstGoal ? `не начат · ${n} · начни с «${x.firstGoal}»` : `не начат · ${n}` };
  }
  if (!total) return { state: x.rustDays !== null ? 'rust' : 'normal', stage: null, right: '', line: 'добавь цели, чтобы появились этапы' };

  const cur = x.stages[idx];
  const base = { stage: idx + 1, right: `этап ${idx + 1} из ${total}`, bar: { done: cur.done, total: cur.total } };
  if (x.rustDays !== null) return { ...base, state: 'rust', line: `давно не занимался (${x.rustDays} ${plural(x.rustDays, 'день', 'дня', 'дней')}) — вернись` };
  const next = x.nextGoal ? `дальше: ${x.nextGoal}` : '';
  if (total > 1 && idx === total - 1) return { ...base, state: 'final', line: x.nextGoal ? `финальный этап: ${x.nextGoal}` : 'финальный этап' };
  if (x.focus) return { ...base, state: 'active', line: next };
  return { ...base, state: 'normal', line: next };
}

/** Итог направления: «2 в работе · 1 освоен · ближе всего: Бег». */
export function areaSummary(rows: { title: string; view: RowView }[]): string {
  const work = rows.filter((r) => ['active', 'final', 'normal', 'rust'].includes(r.view.state) && r.view.stage !== null);
  const mastered = rows.filter((r) => r.view.state === 'mastered').length;
  const parts: string[] = [];
  if (work.length) parts.push(`${work.length} в работе`);
  if (mastered) parts.push(`${mastered} ${plural(mastered, 'освоен', 'освоено', 'освоено')}`);
  // Ближе всего к следующему этапу — больше всего закрытых целей текущего этапа (доля).
  const best = work.filter((r) => r.view.bar && r.view.bar.total > 0)
    .sort((a, b) => b.view.bar!.done / b.view.bar!.total - a.view.bar!.done / a.view.bar!.total)[0];
  if (best && best.view.bar!.done > 0) parts.push(`ближе всего: ${best.title}`);
  if (!parts.length) return rows.length ? `${rows.length} ${plural(rows.length, 'навык', 'навыка', 'навыков')} · пока не начаты` : 'пусто';
  return parts.join(' · ');
}
