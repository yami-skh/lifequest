// «Готовые пути» — шаблоны навыков (мастер-план §12, фаза 1). Макет: холст, страница «Шаблоны».
// Каталог → предпросмотр с галочками → добавить в дерево; «Свой шаблон» — JSON из буфера, файла или от нейросети.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { importTemplate, previewTemplate, previewTemplates } from '../db/actions';
import { TEMPLATES } from '../data/templates';
import { TEMPLATE_PROMPT } from '../data/templatePrompt';
import { parseTemplateText, templateSkills, templateStats, type ImportPlan, type Template } from '../engine/templates';
import { stageName } from '../engine/stages';
import { toast } from '../lib/toast';
import { ac } from '../lib/theme';
import { Icon } from './Icon';
import { Check, Sheet } from './ui';
import { plural } from '../screens/Character';

type Phase = { kind: 'catalog' } | { kind: 'preview'; template: Template; plan: ImportPlan; from: 'catalog' | 'paste' } | { kind: 'paste' };

const goalsWord = (n: number) => plural(n, 'цель', 'цели', 'целей');
const skillsWord = (n: number) => plural(n, 'навык', 'навыка', 'навыков');

export function TemplatesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'catalog' });
  const [pasted, setPasted] = useState('');
  useEffect(() => {
    if (open) setPhase({ kind: 'catalog' });
  }, [open]);
  if (!open) return null;

  const openPreview = async (template: Template, from: 'catalog' | 'paste') => setPhase({ kind: 'preview', template, plan: await previewTemplate(template), from });

  if (phase.kind === 'preview') {
    return <Preview template={phase.template} plan={phase.plan} onBack={() => setPhase({ kind: phase.from })} onClose={onClose} />;
  }
  if (phase.kind === 'paste') {
    return <Paste text={pasted} setText={setPasted} onBack={() => setPhase({ kind: 'catalog' })} onClose={onClose} onOk={(t) => openPreview(t, 'paste')} />;
  }
  return <Catalog onClose={onClose} onPick={(t) => openPreview(t, 'catalog')} onPaste={() => setPhase({ kind: 'paste' })} />;
}

function AreaChip({ title, color }: { title: string; color?: string }) {
  const c = ac(color) ?? 'var(--muted)';
  return <span class="tpl-chip" style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}>{title}</span>;
}

function Catalog({ onClose, onPick, onPaste }: { onClose: () => void; onPick: (t: Template) => void; onPaste: () => void }) {
  const w = useWorld();
  const [plans, setPlans] = useState<ImportPlan[] | null>(null);
  // Пересчитываем, когда меняется дерево: после импорта карточка покажет «есть 4 из 4».
  useEffect(() => {
    previewTemplates(TEMPLATES).then(setPlans);
  }, [w.nodes.length, w.goals.length]);

  return (
    <Sheet open onClose={onClose} title="Готовые пути">
      <span class="muted small tpl-lead">Добавляются к твоему дереву. Что уже есть — не трогается и не дублируется.</span>
      <div class="stack-8">
        {TEMPLATES.map((t, i) => {
          const s = templateStats(t);
          const have = plans ? plans[i].skills.filter((x) => !x.isNew).length : 0;
          const all = plans && have === s.skills && plans[i].goals.length === 0;
          return (
            <button type="button" class="tpl-card" key={t.id} onClick={() => onPick(t)}>
              <span class="tpl-card-body">
                <span class="tpl-card-top">
                  <span class="tpl-card-title">{t.title}</span>
                  {have > 0 && <span class="tpl-have">{all ? 'уже добавлен' : `есть ${have} из ${s.skills}`}</span>}
                </span>
                {t.description && <span class="tpl-desc">{t.description}</span>}
                <span class="tpl-chips">{t.areas.map((a) => <AreaChip key={a.title} title={a.title} color={a.color} />)}</span>
                <span class="t-sub">
                  {s.skills} {skillsWord(s.skills)} · {s.goals} {goalsWord(s.goals)}
                  {t.campaign && <span class="tpl-gold"> · кампания +{t.campaign.rewardXp ?? 500} XP</span>}
                </span>
              </span>
              <Icon name="right" size={18} />
            </button>
          );
        })}
      </div>
      <button type="button" class="btn ghost tpl-dashed" onClick={onPaste}><Icon name="clipboard" size={20} />Вставить свой шаблон</button>
    </Sheet>
  );
}

function Preview({ template, plan, onBack, onClose }: { template: Template; plan: ImportPlan; onBack: () => void; onClose: () => void }) {
  const [picked, setPicked] = useState<Set<number>>(() => new Set(plan.goals.map((_, i) => i)));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const skills = useMemo(() => templateSkills(template), [template]);
  const titleByKey = new Map(skills.map((x) => [x.skill.key, x.skill.title]));
  const where = new Map(plan.skills.map((x) => [x.key, x]));

  const newSkills = plan.skills.filter((x) => x.isNew).length;
  const existing = plan.skills.filter((x) => !x.isNew);
  const toggle = (i: number) => {
    const next = new Set(picked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setPicked(next);
  };
  const nothing = plan.nodes.length === 0 && picked.size === 0 && plan.metrics.length === 0 && !plan.quest;

  const add = async () => {
    setBusy(true);
    await importTemplate({ ...plan, goals: plan.goals.filter((_, i) => picked.has(i)) });
    const sub = [newSkills > 0 && `${newSkills} ${skillsWord(newSkills)}`, picked.size > 0 && `${picked.size} ${goalsWord(picked.size)}`].filter(Boolean).join(', ');
    toast({ kind: 'info', title: `Путь «${template.title}» добавлен`, sub: sub || undefined });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} onBack={onBack} title={template.title}>
      {template.description && <span class="muted small tpl-lead">{template.description}</span>}
      <div class="tpl-stats">
        <div><b>{newSkills}</b><span>{plural(newSkills, 'новый навык', 'новых навыка', 'новых навыков')}</span></div>
        <div><b>{picked.size}</b><span>{goalsWord(picked.size)}</span></div>
        <div><b>{plan.metrics.length}</b><span>{plural(plan.metrics.length, 'замер', 'замера', 'замеров')}</span></div>
      </div>
      {existing.length > 0 && (
        <div class="notice ok small">
          {existing.map((x) => titleByKey.get(x.key)).join(', ')} уже есть — добавятся только недостающие цели.
          {plan.skipped.metrics > 0 && ` Замеров уже есть: ${plan.skipped.metrics}.`}
        </div>
      )}
      <div class="stack-8">
        {skills.map(({ skill, area, path }) => {
          const at = where.get(skill.key)!;
          const goals = plan.goals.map((g, i) => ({ g, i })).filter((x) => x.g.skillId === at.id);
          const on = goals.filter((x) => picked.has(x.i)).length;
          const sub = [
            `${skill.stages.length} ${plural(skill.stages.length, 'этап', 'этапа', 'этапов')}`,
            skill.metric && `замер «${skill.metric.title}»`,
            skill.requires?.length && `после «${skill.requires.map((r) => titleByKey.get(r.skill)).join('», «')}»`,
          ].filter(Boolean).join(' · ');
          const expanded = openKey === skill.key;
          return (
            <div class="tpl-skill-wrap" key={skill.key}>
              <button type="button" class="tpl-skill" style={{ '--c': ac(area.color) ?? 'var(--muted)' }} onClick={() => setOpenKey(expanded ? null : skill.key)} aria-expanded={expanded} disabled={goals.length === 0}>
                <span class="tpl-bar" />
                <span class="tpl-skill-text">
                  <span class="t-sub">{path.join(' › ')}</span>
                  <span class="strong">{skill.title}</span>
                  <span class="muted small">{sub}</span>
                </span>
                {at.isNew
                  ? <span class="tpl-new">новый</span>
                  : <span class="tpl-plus">{goals.length ? `+${on} ${goalsWord(on)}` : 'всё есть'}</span>}
              </button>
              {expanded && (
                <div class="tpl-goals">
                  {skill.stages.map((st) => {
                    const list = goals.filter((x) => x.g.stage === st.stage);
                    if (!list.length) return null;
                    return (
                      <section class="stack-4" key={st.stage}>
                        <span class="ai-stage">Этап {st.stage} · {stageName(st.stage)}{st.boss ? ' · контрольный' : ''}</span>
                        {list.map(({ g, i }) => (
                          <button type="button" class={picked.has(i) ? 'ai-goal' : 'ai-goal off'} onClick={() => toggle(i)} aria-pressed={picked.has(i)} key={i}>
                            <Check done={picked.has(i)} />
                            <span class="stack-4"><span class="strong">{g.title}</span><span class="muted small">{g.kind === 'practice' ? 'практика' : 'теория'}</span></span>
                          </button>
                        ))}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {template.campaign && (
          <div class="tpl-camp">
            <Icon name="flag" size={20} />
            <span class="stack-4">
              <span class="strong">Кампания «{template.campaign.title}»</span>
              <span class="muted small">
                {plan.quest
                  ? `${plan.quest.steps.length} ${plural(plan.quest.steps.length, 'шаг', 'шага', 'шагов')} · +${plan.quest.rewardXp} XP · появится в Квестах`
                  : 'уже есть в Квестах'}
              </span>
            </span>
          </div>
        )}
      </div>
      <span class="muted small">Нажми на навык, чтобы снять лишние цели. Потом всё можно удалить или переименовать.</span>
      <button type="button" class="btn primary" disabled={busy || nothing} onClick={add}>{nothing ? 'Всё уже есть в дереве' : 'Добавить в дерево'}</button>
    </Sheet>
  );
}

function Paste({ text, setText, onBack, onClose, onOk }: { text: string; setText: (s: string) => void; onBack: () => void; onClose: () => void; onOk: (t: Template) => void }) {
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const check = () => {
    const r = parseTemplateText(text);
    if (r.ok) onOk(r.template);
    else setErrors(r.errors);
  };
  const fromClipboard = async () => {
    try {
      const s = await navigator.clipboard.readText();
      if (s) {
        setText(s);
        setErrors([]);
      } else toast({ kind: 'info', title: 'Буфер пуст' });
    } catch {
      toast({ kind: 'info', title: 'Нет доступа к буферу', sub: 'Вставь текст в поле вручную' });
    }
  };
  const fromFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setText(await f.text());
    setErrors([]);
  };
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(TEMPLATE_PROMPT);
      toast({ kind: 'info', title: 'Запрос скопирован', sub: 'Вставь в любую нейросеть и допиши свою цель в конце' });
    } catch {
      toast({ kind: 'info', title: 'Не удалось скопировать' });
    }
  };
  const n = errors.length;

  return (
    <Sheet open onClose={onClose} onBack={onBack} title="Свой шаблон">
      <span class="muted small tpl-lead">Шаблон — это текст в формате JSON: файл от друга или ответ нейросети.</span>
      <div class="row-2">
        <button type="button" class="btn ghost" onClick={fromClipboard}><Icon name="clipboard" size={18} />Из буфера</button>
        <button type="button" class="btn ghost" onClick={() => fileRef.current?.click()}><Icon name="file" size={18} />Из файла</button>
      </div>
      <input ref={fileRef} id="tpl-file" type="file" accept=".json,application/json,text/plain" hidden onChange={(e) => fromFile(e.currentTarget.files)} />
      <textarea id="tpl-text" class={n ? 'tpl-text bad' : 'tpl-text'} rows={8} spellcheck={false} placeholder='{ "format": 1, "id": "…", "title": "…", "areas": [ … ] }'
        value={text} onInput={(e) => { setText(e.currentTarget.value); setErrors([]); }} aria-label="Текст шаблона" />
      {n > 0 && (
        <div class="notice error stack-4">
          <span class="strong">Не получилось прочитать{n > 1 ? ` — ${n} ${plural(n, 'ошибка', 'ошибки', 'ошибок')}` : ''}</span>
          {errors.slice(0, 6).map((e) => <span class="small" key={e}>· {e}</span>)}
          {n > 6 && <span class="small">· и ещё {n - 6}</span>}
        </div>
      )}
      <div class="ai-note">
        <Icon name="spark" size={16} />
        <span>Нет шаблона? <button type="button" class="link tpl-inline" onClick={copyPrompt}>Скопируй запрос</button> — любая нейросеть составит путь под твою цель в этом формате.</span>
      </div>
      <button type="button" class="btn primary" disabled={!text.trim()} onClick={check}>Посмотреть, что добавится</button>
    </Sheet>
  );
}
