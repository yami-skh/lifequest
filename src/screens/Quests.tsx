// Квесты. Макет: холст, страница «Квесты». ARCHITECTURE.md §6.
import { useMemo, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import type { CountRule, Quest, QuestKind, QuestStep } from '../db/db';
import { uid } from '../db/db';
import { abandonQuest, createQuest, deleteQuest, toggleCustomStep, toggleWeeklyTemplate } from '../db/actions';
import { QUEST_STEP_XP, WEEKLY_TEMPLATES, weekStart } from '../engine/quests';
import { addDays, daysBetween, humanDate, localDate } from '../engine/dates';
import { go } from '../lib/router';
import { Icon } from '../components/Icon';
import { Check, Confirm, ProgressBar, Ring, SectionLabel, Sheet, TopBar } from '../components/ui';
import { plural } from './Character';

const KIND_TITLE: Record<QuestKind, string> = { main: 'основной', side: 'побочный', weekly: 'недельный' };

function daysToMonday() {
  const today = localDate();
  return daysBetween(today, addDays(weekStart(today), 7));
}

/** Карточка квеста в списке и на главном. */
export function QuestCard({ q, compact = false }: { q: Quest; compact?: boolean }) {
  const w = useWorld();
  const p = w.questProgress(q);
  const main = q.kind === 'main';
  return (
    <a class={main ? 'quest-card main' : 'quest-card'} href={`#/quests/${q.id}`}>
      <span class="quest-row">
        <span class={main ? 'quest-icon gold' : 'quest-icon'}><Icon name={main ? 'sword' : 'compass'} size={20} stroke={2.2} /></span>
        <span class="quest-text">
          <span class="strong">{q.title}</span>
          <span class="muted small">{p.done} из {p.total} {plural(p.total, 'шага', 'шагов', 'шагов')}{q.deadline ? ` · до ${humanDate(q.deadline)}` : ''}</span>
        </span>
        <span class="quest-xp">+{q.rewardXp}</span>
      </span>
      <ProgressBar pct={p.pct} color={main ? 'var(--gold)' : 'var(--fg-2)'} height={7} />
      {!compact && p.next && <span class="small fg-2">Дальше: {p.next.step.title}</span>}
    </a>
  );
}

/** Недельный квест: кольцо или галочка. */
function WeeklyRow({ q }: { q: Quest }) {
  const w = useWorld();
  const p = w.questProgress(q);
  const s = p.steps[0];
  const done = q.status === 'done';
  return (
    <a class={done ? 'weekly-row done' : 'weekly-row'} href={`#/quests/${q.id}`}>
      {done ? (
        <span class="weekly-check"><Icon name="check" size={18} stroke={3} /></span>
      ) : (
        <Ring pct={p.pct} size={40} stroke={4} color="var(--gold)"><span class="t-ring-pct">{s?.have ?? 0}/{s?.target ?? 1}</span></Ring>
      )}
      <span class="quest-text">
        <span class="strong">{q.title}</span>
        <span class={done ? 'small ok-text' : 'muted small'}>{done ? `выполнен · +${q.rewardXp} XP получено` : s?.detail ?? s?.step.title}</span>
      </span>
      {!done && <span class="quest-xp">+{q.rewardXp}</span>}
    </a>
  );
}

export function Quests() {
  const w = useWorld();
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [creating, setCreating] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const week = weekStart(localDate());

  const weekly = w.quests.filter((q) => q.kind === 'weekly' && q.week === week && (q.status === 'active' || q.status === 'done'));
  const active = w.quests.filter((q) => q.status === 'active' && q.kind !== 'weekly');
  const finished = w.quests
    .filter((q) => q.status !== 'active' && !(q.kind === 'weekly' && q.week === week && q.status === 'done'))
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const d = daysToMonday();

  return (
    <div class="page">
      <div class="spread">
        <h1 class="display small-display">Квесты</h1>
        <button type="button" class="icon-btn round" aria-label="Новый квест" onClick={() => setCreating(true)}><Icon name="plus" size={20} stroke={2.4} /></button>
      </div>

      <div class="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'active'} class={tab === 'active' ? 'on' : ''} onClick={() => setTab('active')}>Активные · {active.length + weekly.filter((q) => q.status === 'active').length}</button>
        <button type="button" role="tab" aria-selected={tab === 'done'} class={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>Завершённые · {finished.length}</button>
      </div>

      {tab === 'active' ? (
        <>
          <section class="stack-8">
            <SectionLabel right={<button type="button" class="link small" onClick={() => setWeeklyOpen(true)}>Настроить</button>}>
              Недельные · до понедельника {d} {plural(d, 'день', 'дня', 'дней')}
            </SectionLabel>
            {weekly.length === 0 ? <p class="muted small">Недельные квесты выключены.</p> : weekly.map((q) => <WeeklyRow q={q} key={q.id} />)}
          </section>
          {(['main', 'side'] as const).map((k) => {
            const list = active.filter((q) => q.kind === k);
            return (
              <section class="stack-8" key={k}>
                <SectionLabel>{k === 'main' ? 'Основные' : 'Побочные'}</SectionLabel>
                {list.length === 0 ? (
                  <p class="muted small">{k === 'main' ? 'Основной квест — большая цель на месяц. Нажми ＋, чтобы взять.' : 'Нет побочных квестов.'}</p>
                ) : (
                  list.map((q) => <QuestCard q={q} key={q.id} />)
                )}
              </section>
            );
          })}
        </>
      ) : (
        <section class="stack-8">
          {finished.length === 0 && <p class="muted">Здесь будут выполненные и проваленные квесты.</p>}
          {finished.map((q) => (
            <a class="weekly-row" href={`#/quests/${q.id}`} key={q.id}>
              <span class={q.status === 'done' ? 'weekly-check' : 'weekly-check fail'}><Icon name={q.status === 'done' ? 'check' : 'x'} size={18} stroke={3} /></span>
              <span class="quest-text">
                <span class="strong">{q.title}</span>
                <span class="muted small">{q.status === 'done' ? `выполнен · +${q.rewardXp} XP` : q.status === 'failed' ? 'провален · без штрафа' : 'отказался'}{q.completedAt ? ` · ${humanDate(q.completedAt.slice(0, 10))}` : ''}</span>
              </span>
            </a>
          ))}
        </section>
      )}

      {creating && <NewQuestSheet onClose={() => setCreating(false)} />}
      {weeklyOpen && (
        <Sheet open onClose={() => setWeeklyOpen(false)} title="Недельные квесты">
          <p class="muted small">Обновляются каждый понедельник. Считаются сами по журналу.</p>
          <div class="stack-8">
            {WEEKLY_TEMPLATES.map((t) => {
              const on = !(w.profile?.weeklyOff ?? []).includes(t.id);
              return (
                <button type="button" key={t.id} class="toggle-row" role="switch" aria-checked={on} onClick={() => toggleWeeklyTemplate(t.id)}>
                  <span class="stack-4"><span class="strong">{t.title} · +{t.reward}</span><span class="muted small">{t.hint}</span></span>
                  <span class={on ? 'switch on' : 'switch'}><span /></span>
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </div>
  );
}

export function QuestDetail({ id }: { id: string }) {
  const w = useWorld();
  const q = w.quests.find((x) => x.id === id);
  const [confirm, setConfirm] = useState<'abandon' | 'delete' | null>(null);
  if (!q) {
    return (
      <div class="page">
        <TopBar title="Квест не найден" />
      </div>
    );
  }
  const p = w.questProgress(q);
  const auto = p.steps.filter((s) => s.done && s.step.kind !== 'custom').length;
  const left = q.deadline ? daysBetween(localDate(), q.deadline) : null;

  return (
    <div class="page">
      <TopBar crumbs={`Квесты · ${KIND_TITLE[q.kind]}`} />
      <div class="stack-10">
        <h1 class="display">{q.title}</h1>
        <div class="chips">
          <span class="chip big gold-chip">Награда +{q.rewardXp} XP</span>
          {q.deadline && <span class="chip big">до {humanDate(q.deadline)}{left !== null && left >= 0 ? ` · ${left} ${plural(left, 'день', 'дня', 'дней')}` : ''}</span>}
          {q.status !== 'active' && <span class="chip big">{q.status === 'done' ? 'выполнен' : q.status === 'failed' ? 'провален' : 'отказался'}</span>}
        </div>
        <ProgressBar pct={p.pct} color="var(--gold)" height={10} />
        <div class="spread small strong"><span>{p.done} из {p.total} {plural(p.total, 'шага', 'шагов', 'шагов')}</span>{auto > 0 && <span class="muted">{auto} закрылись сами</span>}</div>
      </div>

      <section class="stack-8">
        <SectionLabel>Шаги</SectionLabel>
        {p.steps.map(({ step, done, have, target, detail }) => {
          const current = !done && p.next?.step.id === step.id;
          const skillId = 'skillId' in step ? step.skillId : step.kind === 'count' ? step.rule.skillId : undefined;
          return (
            <div class={current ? 'step-card current' : 'step-card'} key={step.id}>
              {step.kind === 'custom' && q.status === 'active' ? (
                <button type="button" class="check-btn" aria-label={done ? 'Снять отметку' : 'Отметить шаг'} onClick={() => toggleCustomStep(q.id, step.id)}><Check done={done} /></button>
              ) : (
                <Check done={done} />
              )}
              <span class="step-text">
                <span class={done ? 'strong' : 'strong fg-2'}>{step.title}</span>
                <span class="step-sub">{stepKindLabel(step)}{detail ? ` · ${detail}` : ''}{target !== undefined && !done ? ` · ${have ?? 0} / ${target}` : done && step.kind !== 'custom' ? ' · закрылся сам' : ''}</span>
                {current && target ? <span class="mini-bar"><span style={{ width: `${((have ?? 0) / target) * 100}%`, background: 'var(--green)' }} /></span> : null}
              </span>
              {current && skillId && <a class="link small" href={`#/skill/${skillId}`}>к навыку</a>}
            </div>
          );
        })}
      </section>

      <div class="notice">
        <Icon name="star" size={18} />
        <span class="small">Ступень, цель и счётчик записей закрываются сами. «Свой шаг» — нажми на квадрат, когда сделал.</span>
      </div>

      {q.status === 'active' ? (
        q.kind !== 'weekly' && <button type="button" class="btn ghost danger-text" onClick={() => setConfirm('abandon')}>Отказаться от квеста</button>
      ) : (
        <button type="button" class="btn ghost danger-text" onClick={() => setConfirm('delete')}>Удалить из списка</button>
      )}

      <Confirm
        open={!!confirm}
        title={confirm === 'delete' ? 'Удалить квест?' : 'Отказаться от квеста?'}
        text={confirm === 'delete' ? 'Квест пропадёт из списка. Полученный XP останется.' : 'Квест уйдёт в завершённые без награды. Штрафа нет.'}
        action={confirm === 'delete' ? 'Удалить' : 'Отказаться'}
        onConfirm={async () => {
          if (confirm === 'delete') {
            await deleteQuest(q.id);
            go('quests');
          } else await abandonQuest(q.id);
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function stepKindLabel(s: QuestStep) {
  return s.kind === 'stage' ? 'ступень навыка' : s.kind === 'goal' ? 'цель навыка' : s.kind === 'count' ? 'счётчик записей' : s.kind === 'auto' ? 'сам' : 'свой шаг';
}

type DraftKind = 'stage' | 'goal' | 'count' | 'custom';

function NewQuestSheet({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'main' | 'side'>('main');
  const [steps, setSteps] = useState<QuestStep[]>([]);
  const [adding, setAdding] = useState<DraftKind | null>(null);
  const [reward, setReward] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<'none' | '7' | '30' | '90'>('none');
  const autoReward = Math.max(1, steps.length) * QUEST_STEP_XP;

  const save = async () => {
    if (!title.trim() || steps.length === 0) return;
    await createQuest({
      title: title.trim(), kind, steps, rewardXp: reward ?? autoReward,
      deadline: deadline === 'none' ? undefined : addDays(localDate(), Number(deadline)),
    });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="Новый квест">
      <label class="field">
        <span class="field-label">Название</span>
        <input id="quest-title" class="input" placeholder="Например: Мастер рамена" value={title} onInput={(e) => setTitle(e.currentTarget.value)} />
      </label>
      <div class="segmented">
        <button type="button" class={kind === 'main' ? 'on' : ''} onClick={() => setKind('main')}>Основной</button>
        <button type="button" class={kind === 'side' ? 'on' : ''} onClick={() => setKind('side')}>Побочный</button>
      </div>

      <div class="stack-8">
        <span class="field-label">Шаги · {steps.length}</span>
        {steps.map((s) => (
          <div class="draft-step" key={s.id}>
            <span class={`draft-kind ${s.kind}`}>{s.kind === 'stage' ? 'СТУПЕНЬ' : s.kind === 'goal' ? 'ЦЕЛЬ' : s.kind === 'count' ? 'СЧЁТЧИК' : 'СВОЙ'}</span>
            <span class="draft-title">{s.title}</span>
            <button type="button" class="icon-btn" aria-label="Убрать шаг" onClick={() => setSteps(steps.filter((x) => x.id !== s.id))}><Icon name="x" size={16} stroke={2.4} /></button>
          </div>
        ))}
      </div>

      {adding ? (
        <StepBuilder kind={adding} onDone={(s) => { if (s) setSteps([...steps, s]); setAdding(null); }} />
      ) : (
        <div class="new-req">
          <span class="section-label">Добавить шаг</span>
          <div class="grid-2">
            <button type="button" class="pick" onClick={() => setAdding('stage')}>Ступень навыка</button>
            <button type="button" class="pick" onClick={() => setAdding('goal')}>Цель навыка</button>
            <button type="button" class="pick" onClick={() => setAdding('count')}>Счётчик записей</button>
            <button type="button" class="pick" onClick={() => setAdding('custom')}>Свой шаг</button>
          </div>
        </div>
      )}

      <div class="grid-2">
        <label class="field">
          <span class="field-label">Награда, XP</span>
          <input id="quest-reward" class="input" type="number" inputMode="numeric" min={10} step={10} value={reward ?? autoReward} onInput={(e) => setReward(Number(e.currentTarget.value) || null)} />
        </label>
        <label class="field">
          <span class="field-label">Срок</span>
          <select id="quest-deadline" class="input" value={deadline} onChange={(e) => setDeadline(e.currentTarget.value as typeof deadline)}>
            <option value="none">без срока</option>
            <option value="7">неделя</option>
            <option value="30">месяц</option>
            <option value="90">3 месяца</option>
          </select>
        </label>
      </div>
      <span class="muted small">По умолчанию {QUEST_STEP_XP} XP за шаг.</span>

      <button type="button" class="btn primary" disabled={!title.trim() || steps.length === 0} onClick={save}>
        {!title.trim() ? 'Дай квесту название' : steps.length === 0 ? 'Добавь хотя бы один шаг' : 'Взять квест'}
      </button>
    </Sheet>
  );
}

/** Конструктор одного шага: выбор навыка → ступени/цели/числа. */
function StepBuilder({ kind, onDone }: { kind: DraftKind; onDone: (s: QuestStep | null) => void }) {
  const w = useWorld();
  const [query, setQuery] = useState('');
  const [skillId, setSkillId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [count, setCount] = useState(3);
  const [type, setType] = useState<CountRule['type'] | 'any'>('any');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? w.skills.filter((s) => s.title.toLowerCase().includes(q)) : [...w.focusSkills, ...w.recentSkills.filter((s) => !s.focus)]).slice(0, 8);
  }, [query, w]);

  const skill = skillId ? w.nodeById.get(skillId) : undefined;

  if (kind === 'custom') {
    return (
      <div class="new-req">
        <span class="section-label">Свой шаг</span>
        <input id="step-text" class="input" placeholder="Например: угостить друзей своим раменом" value={text} onInput={(e) => setText(e.currentTarget.value)} />
        <div class="row-2">
          <button type="button" class="btn ghost" onClick={() => onDone(null)}>Отмена</button>
          <button type="button" class="btn primary" disabled={!text.trim()} onClick={() => onDone({ id: uid(), kind: 'custom', title: text.trim() })}>Добавить</button>
        </div>
      </div>
    );
  }

  const picker = (
    <div class="picker">
      <label class="search">
        <Icon name="search" size={18} />
        <input id="step-skill" placeholder={kind === 'count' ? 'Навык (необязательно)' : 'Выбрать навык'} value={query} onInput={(e) => setQuery(e.currentTarget.value)} aria-label="Выбрать навык" />
      </label>
      <div class="chips">
        {results.map((s) => <button type="button" key={s.id} class="chip big" onClick={() => setSkillId(s.id)}>{s.title}</button>)}
      </div>
    </div>
  );

  return (
    <div class="new-req">
      <span class="section-label">{kind === 'stage' ? 'Ступень навыка' : kind === 'goal' ? 'Цель навыка' : 'Счётчик записей'}</span>
      {skill ? (
        <div class="chips">
          <span class="chip big primary"><span class="chip-btn">{skill.title}</span><button type="button" class="chip-x" aria-label="Другой навык" onClick={() => setSkillId(null)}><Icon name="x" size={14} stroke={3} /></button></span>
        </div>
      ) : (
        picker
      )}

      {kind === 'stage' && skill && (
        <div class="stack-4">
          {w.stagesOfSkill(skill.id).filter((s) => !s.complete).map((s) => (
            <button type="button" class="picker-item" key={s.stage} onClick={() => onDone({ id: uid(), kind: 'stage', title: `Пройти ступень «${s.name}» · ${skill.title}`, skillId: skill.id, stage: s.stage })}>
              <span>{s.stage} · {s.name}</span><span class="muted small">{s.done} из {s.goals.length} целей</span>
            </button>
          ))}
          {w.stagesOfSkill(skill.id).every((s) => s.complete) && <p class="muted small">Все ступени пройдены — добавь цели в навык.</p>}
        </div>
      )}

      {kind === 'goal' && skill && (
        <div class="stack-4">
          {(w.goalsBySkill.get(skill.id) ?? []).filter((g) => !g.done).map((g) => (
            <button type="button" class="picker-item" key={g.id} onClick={() => onDone({ id: uid(), kind: 'goal', title: `Закрыть цель «${g.title}»`, skillId: skill.id, goalId: g.id })}>
              <span>{g.title}</span><span class="muted small">ступень {g.stage}</span>
            </button>
          ))}
        </div>
      )}

      {kind === 'count' && (
        <>
          <div class="chips">
            {(['any', 'practice', 'workout', 'learn'] as const).map((t) => (
              <button type="button" key={t} class={type === t ? 'chip big primary' : 'chip big'} onClick={() => setType(t)}>
                {t === 'any' ? 'любые записи' : t === 'practice' ? 'практика' : t === 'workout' ? 'тренировки' : 'изучил'}
              </button>
            ))}
          </div>
          <div class="stepper">
            <button type="button" class="btn ghost square" aria-label="Меньше" onClick={() => setCount(Math.max(1, count - 1))}>−</button>
            <span class="stepper-value">{count}</span>
            <button type="button" class="btn ghost square" aria-label="Больше" onClick={() => setCount(Math.min(100, count + 1))}>+</button>
          </div>
          <button type="button" class="btn primary" onClick={() => {
            const what = type === 'practice' ? 'практики' : type === 'workout' ? 'тренировки' : type === 'learn' ? 'записи «Изучил»' : 'записи';
            onDone({ id: uid(), kind: 'count', title: `${count} ${what}${skill ? ` по навыку «${skill.title}»` : ''}`, rule: { target: count, type: type === 'any' ? undefined : type, skillId: skill?.id } });
          }}>Добавить</button>
        </>
      )}

      <button type="button" class="link small" onClick={() => onDone(null)}>Отмена</button>
    </div>
  );
}

/** Блок квестов на главном. */
export function QuestsBlock() {
  const w = useWorld();
  const week = weekStart(localDate());
  const mainQ = w.quests.find((q) => q.status === 'active' && q.kind === 'main') ?? w.quests.find((q) => q.status === 'active' && q.kind === 'side');
  const weekly = w.quests.filter((q) => q.kind === 'weekly' && q.week === week && (q.status === 'active' || q.status === 'done'));
  const total = w.quests.filter((q) => q.status === 'active').length;
  if (!mainQ && weekly.length === 0) return null;
  return (
    <section class="stack-10">
      <SectionLabel right={<a class="link small" href="#/quests">Все · {total}</a>}>Квесты</SectionLabel>
      {mainQ && <QuestCard q={mainQ} />}
      {weekly.length > 0 && (
        <>
          <div class="weekly-mini">
            {weekly.map((q) => {
              const p = w.questProgress(q);
              const s = p.steps[0];
              return (
                <a class={q.status === 'done' ? 'weekly-tile done' : 'weekly-tile'} href={`#/quests/${q.id}`} key={q.id}>
                  {q.status === 'done' ? (
                    <span class="weekly-check"><Icon name="check" size={16} stroke={3} /></span>
                  ) : (
                    <Ring pct={p.pct} size={36} stroke={3.5} color="var(--gold)"><span class="t-ring-pct small-ring">{s?.have ?? 0}/{s?.target ?? 1}</span></Ring>
                  )}
                  <span class="weekly-tile-title">{q.title}</span>
                </a>
              );
            })}
          </div>
          <span class="muted small center">недельные · обновятся в понедельник</span>
        </>
      )}
    </section>
  );
}
