// Шаблон пути — единый JSON-формат для готовых шаблонов, ответа «любой нейросети» и будущего AI /path
// (мастер-план §6, §12). Импорт только добавляет: существующее (по названию в том же месте) не трогается и не дублируется.

export type TplGoalKind = 'theory' | 'practice';
/** Способ проверки цели (мастер-план §15): A — внешние данные, B — доказательство в приложении, C — подтверждение людей. */
export type TplCheck = 'A' | 'B' | 'C';

export interface TplGoal { title: string; kind: TplGoalKind; check?: TplCheck }
export interface TplStage { stage: number; goals: TplGoal[]; boss?: boolean }
export interface TplMetric { title: string; unit: string; better: 'up' | 'down'; hasReps?: boolean }
export interface TplSkill {
  /** Ключ внутри шаблона: для requires и шагов кампании. */
  key: string;
  title: string;
  stages: TplStage[];
  /** Открывается после этих навыков шаблона. */
  requires?: { skill: string; minProgress?: number; minLevel?: number }[];
  metric?: TplMetric;
}
export interface TplBranch { title: string; skills?: TplSkill[]; branches?: TplBranch[] }
export interface TplArea { title: string; color?: string; icon?: string; branches: TplBranch[] }
export interface TplCampaign { title: string; rewardXp?: number; steps: { skill: string; stage: number }[] }
export interface Template {
  format: 1;
  id: string;
  title: string;
  description?: string;
  areas: TplArea[];
  campaign?: TplCampaign;
}

// ---------- проверка (для шаблонов из файлов и ответов нейросети) ----------

const isStr = (x: unknown, max = 120): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= max;

export function validateTemplate(x: unknown): { ok: true; template: Template } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const t = x as Template;
  if (!t || typeof t !== 'object') return { ok: false, errors: ['Не объект'] };
  if (t.format !== 1) errors.push('format должен быть 1');
  if (!isStr(t.id, 60)) errors.push('Нет id');
  if (!isStr(t.title, 80)) errors.push('Нет title');
  if (!Array.isArray(t.areas) || t.areas.length === 0) errors.push('Нет направлений (areas)');
  const keys = new Set<string>();
  const skills: TplSkill[] = [];
  const walkBranch = (b: TplBranch, path: string) => {
    if (!isStr(b?.title, 80)) errors.push(`${path}: у ветки нет названия`);
    for (const s of b?.skills ?? []) {
      const p = `${path} › ${s?.title ?? '?'}`;
      if (!isStr(s?.key, 60) || !isStr(s?.title, 80)) errors.push(`${p}: у навыка нет key или title`);
      else if (keys.has(s.key)) errors.push(`${p}: повтор key «${s.key}»`);
      else keys.add(s.key);
      if (!Array.isArray(s?.stages) || s.stages.length === 0) errors.push(`${p}: нет ступеней`);
      for (const st of s?.stages ?? []) {
        if (!Number.isInteger(st?.stage) || st.stage < 1 || st.stage > 10) errors.push(`${p}: ступень вне 1–10`);
        if (!Array.isArray(st?.goals) || st.goals.length === 0) errors.push(`${p}: ступень ${st?.stage} без целей`);
        for (const g of st?.goals ?? []) {
          if (!isStr(g?.title)) errors.push(`${p}: цель без названия`);
          if (g?.kind !== 'theory' && g?.kind !== 'practice') errors.push(`${p}: цель «${g?.title}» — kind theory/practice`);
        }
      }
      skills.push(s);
    }
    for (const sub of b?.branches ?? []) walkBranch(sub, `${path} › ${b?.title}`);
  };
  for (const a of t.areas ?? []) {
    if (!isStr(a?.title, 80)) errors.push('У направления нет названия');
    if (!Array.isArray(a?.branches)) errors.push(`${a?.title}: нет веток`);
    for (const b of a?.branches ?? []) walkBranch(b, a?.title ?? '?');
  }
  for (const s of skills) for (const r of s?.requires ?? []) if (!keys.has(r.skill)) errors.push(`${s.title}: требует неизвестный навык «${r.skill}»`);
  for (const step of t.campaign?.steps ?? []) if (!keys.has(step.skill)) errors.push(`Кампания: неизвестный навык «${step.skill}»`);
  return errors.length ? { ok: false, errors } : { ok: true, template: t };
}

// ---------- план импорта: что добавить в текущее дерево ----------

export interface ExistingNode { id: string; parentId: string | null; kind: 'area' | 'branch' | 'skill'; title: string }
export interface ExistingGoal { skillId: string; title: string }
export interface ExistingMetric { title: string }
export interface ExistingQuest { title: string }

export interface PlanNode { id: string; parentId: string | null; kind: 'area' | 'branch' | 'skill'; title: string; color?: string; icon?: string; requires?: { nodeId: string; minProgress?: number; minLevel?: number }[] }
export interface PlanGoal { skillId: string; title: string; kind: TplGoalKind; stage: number }
export interface PlanMetric extends TplMetric { skillId: string }
export interface ImportPlan {
  nodes: PlanNode[];
  goals: PlanGoal[];
  metrics: PlanMetric[];
  quest?: { title: string; rewardXp: number; steps: { title: string; skillId: string; stage: number }[] };
  /** Навыки шаблона по порядку: куда легли и новые ли (для предпросмотра). */
  skills: { key: string; id: string; isNew: boolean }[];
  /** Сколько уже было и пропущено (для предпросмотра «добавится 12 целей, 3 уже есть»). */
  skipped: { nodes: number; goals: number; metrics: number; quest: boolean };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е');

/** Чистая функция: ничего не пишет. newId — генератор id для новых узлов. */
export function planImport(t: Template, have: { nodes: ExistingNode[]; goals: ExistingGoal[]; metrics: ExistingMetric[]; quests?: ExistingQuest[] }, newId: () => string): ImportPlan {
  const plan: ImportPlan = { nodes: [], goals: [], metrics: [], skills: [], skipped: { nodes: 0, goals: 0, metrics: 0, quest: false } };
  const all: ExistingNode[] = [...have.nodes];
  const skillIds = new Map<string, string>();
  const goalSet = new Set(have.goals.map((g) => `${g.skillId}|${norm(g.title)}`));
  const metricSet = new Set(have.metrics.map((m) => norm(m.title)));

  const ensure = (parentId: string | null, kind: PlanNode['kind'], title: string, extra: Partial<PlanNode> = {}) => {
    const found = all.find((n) => n.parentId === parentId && n.kind === kind && norm(n.title) === norm(title));
    if (found) {
      plan.skipped.nodes++;
      return found.id;
    }
    const node: PlanNode = { id: newId(), parentId, kind, title: title.trim(), ...extra };
    plan.nodes.push(node);
    all.push(node);
    return node.id;
  };

  const skillsWithReq: { tpl: TplSkill; id: string }[] = [];
  const walk = (b: TplBranch, parentId: string) => {
    const branchId = ensure(parentId, 'branch', b.title);
    for (const s of b.skills ?? []) {
      const before = plan.nodes.length;
      const id = ensure(branchId, 'skill', s.title);
      skillIds.set(s.key, id);
      plan.skills.push({ key: s.key, id, isNew: plan.nodes.length > before });
      for (const st of s.stages) {
        for (const g of st.goals) {
          const k = `${id}|${norm(g.title)}`;
          if (goalSet.has(k)) {
            plan.skipped.goals++;
            continue;
          }
          goalSet.add(k);
          plan.goals.push({ skillId: id, title: g.title.trim(), kind: g.kind, stage: st.stage });
        }
      }
      if (s.metric) {
        if (metricSet.has(norm(s.metric.title))) plan.skipped.metrics++;
        else {
          metricSet.add(norm(s.metric.title));
          plan.metrics.push({ ...s.metric, skillId: id });
        }
      }
      if (s.requires?.length) skillsWithReq.push({ tpl: s, id });
    }
    for (const sub of b.branches ?? []) walk(sub, branchId);
  };
  for (const a of t.areas) {
    const areaId = ensure(null, 'area', a.title, { ...(a.color ? { color: a.color } : {}), ...(a.icon ? { icon: a.icon } : {}) });
    for (const b of a.branches) walk(b, areaId);
  }

  // Требования — только у новых навыков (у существующих пользователь мог настроить своё).
  for (const { tpl, id } of skillsWithReq) {
    const node = plan.nodes.find((n) => n.id === id);
    if (!node) continue;
    node.requires = tpl.requires!.map((r) => ({ nodeId: skillIds.get(r.skill)!, ...(r.minProgress !== undefined ? { minProgress: r.minProgress } : {}), ...(r.minLevel !== undefined ? { minLevel: r.minLevel } : {}) }));
  }

  // Кампания с таким же названием уже есть — второй раз не создаём.
  if (t.campaign && have.quests?.some((q) => norm(q.title) === norm(t.campaign!.title))) plan.skipped.quest = true;
  else if (t.campaign) {
    const titleOf = (id: string) => all.find((n) => n.id === id)?.title ?? '';
    plan.quest = {
      title: t.campaign.title,
      rewardXp: t.campaign.rewardXp ?? 500,
      steps: t.campaign.steps.map((s) => ({ title: `${titleOf(skillIds.get(s.skill)!)}: ступень ${s.stage}`, skillId: skillIds.get(s.skill)!, stage: s.stage })),
    };
  }
  return plan;
}

// ---------- для экранов: разбор вставленного текста, подсчёт ----------

/** Текст от нейросети или из файла → шаблон. Нейросети оборачивают JSON в ```json и пишут пояснения — берём от первой { до последней }. */
export function parseTemplateText(text: string): { ok: true; template: Template } | { ok: false; errors: string[] } {
  const from = text.indexOf('{');
  const to = text.lastIndexOf('}');
  if (from < 0 || to <= from) return { ok: false, errors: ['Не нашёл шаблон: нужен текст в фигурных скобках { … }'] };
  let data: unknown;
  try {
    data = JSON.parse(text.slice(from, to + 1));
  } catch {
    return { ok: false, errors: ['Текст обрезан или в нём ошибка — скопируй ответ целиком'] };
  }
  return validateTemplate(data);
}

/** Все навыки шаблона с путём (направление › ветка …), по порядку. */
export function templateSkills(t: Template): { skill: TplSkill; area: TplArea; path: string[] }[] {
  const out: { skill: TplSkill; area: TplArea; path: string[] }[] = [];
  const walk = (a: TplArea, b: TplBranch, path: string[]) => {
    const here = [...path, b.title];
    for (const s of b.skills ?? []) out.push({ skill: s, area: a, path: here });
    for (const sub of b.branches ?? []) walk(a, sub, here);
  };
  for (const a of t.areas) for (const b of a.branches) walk(a, b, [a.title]);
  return out;
}

/** Сколько всего в шаблоне: для карточки каталога. */
export function templateStats(t: Template) {
  const skills = templateSkills(t);
  return {
    skills: skills.length,
    goals: skills.reduce((n, x) => n + x.skill.stages.reduce((m, st) => m + st.goals.length, 0), 0),
    metrics: skills.filter((x) => x.skill.metric).length,
  };
}

/** Несколько шаблонов подряд (первый запуск): каждый следующий видит то, что добавят предыдущие. */
export function planImportMany(ts: Template[], have: { nodes: ExistingNode[]; goals: ExistingGoal[]; metrics: ExistingMetric[]; quests?: ExistingQuest[] }, newId: () => string): ImportPlan[] {
  const acc = { nodes: [...have.nodes], goals: [...have.goals], metrics: [...have.metrics], quests: [...(have.quests ?? [])] };
  return ts.map((t) => {
    const plan = planImport(t, acc, newId);
    acc.nodes.push(...plan.nodes);
    acc.goals.push(...plan.goals);
    acc.metrics.push(...plan.metrics);
    if (plan.quest) acc.quests.push({ title: plan.quest.title });
    return plan;
  });
}
