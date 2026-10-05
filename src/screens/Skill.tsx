import { useMemo, useState } from 'preact/hooks';
import { SuggestInput } from '../components/SuggestInput';
import { fx } from '../lib/fx';
import { items } from '../engine/suggest';
import { allPathGoals, goalIdeas } from '../data/suggest';
import { useWorld } from '../db/world';
import type { Goal } from '../db/db';
import { addGoal, addNote, deleteGoal, deleteNote, fmtNum, renameNode, setArchived, toggleFocus, toggleGoal, toggleNoteStudied } from '../db/actions';
import type { GoalKind } from '../engine/progress';
import { humanDate } from '../engine/dates';
import { STAGE_BONUS, stageName } from '../engine/stages';
import { toast } from '../lib/toast';
import { Icon } from '../components/Icon';
import type { ComponentChildren } from 'preact';
import { Check, ProgressBar, Ring, Sheet, TopBar } from '../components/ui';
import { fmtInput } from '../components/NumPad';
import { bestSet } from '../engine/metrics';
import { EntryCard } from '../components/EntryCard';
import { RequirementsSheet } from '../components/RequirementsSheet';
import { AiGoalsButton } from '../components/AiGoals';
import { MilestoneCard, SkillMetrics, Sparkline, lastSetsOf, usesSets, type MetricInfo } from './Metrics';
import { usePhotoUrl } from '../lib/photo';
import type { EntryPreset } from './EntrySheet';
import { useBackClose } from '../lib/backButton';
import { ac } from '../lib/theme';

export const stagesToast = (names: string[]) =>
  names.forEach((n) => toast({ kind: 'achievement', title: `Ступень «${n}» пройдена`, sub: `+${STAGE_BONUS} XP` }));

type Fold = 'goals' | 'history' | 'notes';
const word = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;

/** Страница навыка. Макет: холст, страница «Навык проще» (тренировочный / обычный / меню ⋯). */
export function Skill({ id, onAdd }: { id: string; onAdd: (p: EntryPreset) => void }) {
  const w = useWorld();
  // Новый навык (действий ещё нет) — сразу открыты цели: это главное, что делать. Дальше — как было (всё свёрнуто).
  const [fold, setFold] = useState<Fold | null>(() => ((w.entriesBySkill.get(id)?.length ?? 0) === 0 && (w.goalsBySkill.get(id)?.length ?? 0) > 0 ? 'goals' : null));
  const [menu, setMenu] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const node = w.nodeById.get(id);
  if (!node) {
    return (
      <div class="page">
        <TopBar title="Навык не найден" />
        <p class="muted">Похоже, его удалили. Вернись в дерево.</p>
      </div>
    );
  }
  const area = w.areaOf(id);
  const color = ac(area?.color) ?? 'var(--gold)';
  const lv = w.skillLevelOf(id);
  const prog = w.skillProgressOf(id);
  const reqs = w.requirementsOf(node);
  const errors = w.openErrorsBySkill.get(id) ?? [];
  const goals = w.goalsBySkill.get(id) ?? [];
  const entries = w.entriesBySkill.get(id) ?? [];
  const stages = w.stagesOfSkill(id);
  const cur = w.currentStageOf(id);
  const rust = w.rustDays(id);
  const metric = w.metricsOfSkill(id)[0];
  const info = metric ? w.metricInfo(metric) : undefined;
  const workout = !!metric && usesSets(metric);
  const photoIds = entries.flatMap((e) => e.photoIds);
  const notesCount = w.notes.filter((n) => n.skillId === id).length;
  const toggle = (f: Fold) => setFold(fold === f ? null : f);

  const onFocus = async () => {
    const ok = await toggleFocus(id);
    if (!ok) toast({ kind: 'info', title: 'Активных навыков уже 3', sub: 'Сделай неактивным один из них' });
  };

  const goalsMeta = cur ? `ступень ${cur.stage} · ${cur.done} из ${cur.goals.length}` : goals.length ? 'все пройдены' : 'добавить';
  const notesMeta = [photoIds.length ? `${photoIds.length} фото` : '', notesCount ? `${notesCount} ${word(notesCount, 'заметка', 'заметки', 'заметок')}` : ''].filter(Boolean).join(' · ') || 'пусто';

  return (
    <div class="page">
      <TopBar
        crumbs={w.pathOf(id).slice(0, -1).map((n) => n.title).join(' › ')}
        right={
          <>
            <button type="button" class={node.focus ? 'focus-star on' : 'focus-star'} onClick={onFocus} aria-pressed={!!node.focus} aria-label={node.focus ? 'Сделать неактивным' : 'Сделать активным'}>
              <Icon name="star" size={node.focus ? 16 : 22} stroke={2.2} />
              {node.focus && <span>×1.2</span>}
            </button>
            <button type="button" class="icon-btn" aria-label="Настройки навыка" onClick={() => setMenu(true)}><Icon name="dots" size={22} stroke={3} /></button>
          </>
        }
      />

      {node.archived && (
        <div class="notice"><Icon name="download" size={18} /><span class="small" style={{ flex: 1 }}>Навык в архиве: его нет в дереве и при выборе навыка. Цели и XP сохранены.</span>
          <button type="button" class="link small" onClick={() => setArchived(id, false)}>Вернуть</button></div>
      )}

      <div class="skill-title" style={{ '--c': color }}>
        <Ring pct={lv.pct} size={56} stroke={5} color="var(--c)"><span class="skill-lvl">{lv.level}</span></Ring>
        <span class="stack-4">
          <h1 class="display skill-name">{node.title}</h1>
          <span class="muted small">{lv.name}{lv.level >= 10 ? '' : ` · до ${lv.level + 1} ур. ещё ${lv.left} XP`}</span>
        </span>
      </div>

      {!workout && (
        <div class="stack-8">
          <ProgressBar pct={prog?.pct ?? 0} color={ac(area?.color)} height={10} />
          <div class="spread small strong">
            <span>{prog ? `${Math.round(prog.pct)}%` : 'Нет целей'}</span>
            <span class="muted">{prog ? `${cur ? `ступень ${cur.stage} из ${stages.length} · ` : ''}${prog.done} из ${prog.total} целей` : 'добавь цели, чтобы появилась полоска'}</span>
          </div>
        </div>
      )}

      {rust !== null && (
        <div class="notice">
          <Icon name="web" size={18} />
          <div class="stack-4">
            <span class="strong">{rust} дней без действий</span>
            <span class="small">Первое действие после перерыва даст +50% XP.</span>
          </div>
        </div>
      )}

      {reqs.length > 0 && (
        <div class="req-card">
          <div class="spread">
            <span class="section-label">Требования</span>
            <button type="button" class="link small" onClick={() => setReqOpen(true)}>Настроить</button>
          </div>
          {reqs.map((r) => (
            <a class="req-line" href={`#/skill/${r.node.id}`} key={r.index}>
              <Check done={r.met} />
              <span>{r.node.title} — {r.need}</span>
              {!r.met && <span class="muted small">сейчас {r.have}</span>}
            </a>
          ))}
          {reqs.some((r) => !r.met) && <span class="muted small">Записывать действия можно и до открытия.</span>}
        </div>
      )}

      {errors.map((e) => (
        <div class="notice error" key={e.id}>
          <span class="notice-icon"><Icon name="alert" size={16} stroke={2.6} /></span>
          <div class="stack-4">
            <span class="strong">Нерешённая ошибка</span>
            <span class="small">{humanDate(e.date)} — {e.failNote || e.text}</span>
            <button type="button" class="link small" onClick={() => onAdd({ skillId: id, fixesEntryId: e.id })}>Исправил — записать действие (×1.5 XP)</button>
          </div>
        </div>
      ))}

      {workout && info && <WorkoutCard info={info} />}
      {workout && info?.milestone && <MilestoneCard info={info} link />}

      {!workout && (
        <section class="next-goals" style={{ '--c': color }}>
          <span class="next-goals-label">{cur ? `Следующие цели · ступень ${cur.stage}` : 'Цели'}</span>
          {cur?.goals.filter((g) => !g.done).slice(0, 2).map((g) => <GoalRow g={g} editing={false} key={g.id} />)}
          {!cur && <span class="muted small">{goals.length ? 'Все цели пройдены — добавь новую ступень.' : 'Целей пока нет. Добавь, что хочешь узнать и что сделать руками.'}</span>}
          <div class="spread">
            <button type="button" class="link small" onClick={() => toggle('goals')} aria-expanded={fold === 'goals'}>
              {fold === 'goals' ? 'Свернуть' : goals.length ? `Все цели (${goals.length}) →` : 'Добавить цель →'}
            </button>
            <AiGoalsButton skillId={id} />
          </div>
          {fold === 'goals' && <Goals skillId={id} goals={goals} />}
        </section>
      )}
      {!workout && metric && <SkillMetrics skillId={id} />}

      <button type="button" class="btn primary skill-cta" onClick={() => onAdd(workout ? { skillId: id, workout: true } : { skillId: id })}>
        <span class="skill-cta-main"><Icon name="plus" size={20} stroke={2.6} />{workout ? 'Записать тренировку' : 'Записать действие'}</span>
        {workout && info?.last && <span class="skill-cta-sub">подставим подходы прошлого раза</span>}
      </button>

      <div class="fold-list">
        {workout && (
          <FoldRow title="Цели и ступени" meta={goalsMeta} open={fold === 'goals'} onToggle={() => toggle('goals')}>
            <div class="ai-row"><AiGoalsButton skillId={id} /></div>
            <Goals skillId={id} goals={goals} />
          </FoldRow>
        )}
        <FoldRow title="История" meta={`${entries.length} ${workout ? word(entries.length, 'тренировка', 'тренировки', 'тренировок') : word(entries.length, 'действие', 'действия', 'действий')}`} open={fold === 'history'} onToggle={() => toggle('history')}>
          <div class="stack-10">
            <div class="muted small">{lv.xp} XP за всё время</div>
            {entries.length === 0 ? <p class="muted">Пока нет действий по этому навыку.</p> : entries.map((e) => <EntryCard entry={e} key={e.id} />)}
          </div>
        </FoldRow>
        <FoldRow title="Заметки и фото" meta={notesMeta} open={fold === 'notes'} onToggle={() => toggle('notes')}>
          <div class="stack-12">
            <Notes skillId={id} />
            {photoIds.length > 0 && <Gallery photoIds={photoIds} />}
          </div>
        </FoldRow>
      </div>

      {menu && <SkillMenu id={id} onFocus={onFocus} onReq={() => { setMenu(false); setReqOpen(true); }} onClose={() => setMenu(false)} />}
      {reqOpen && <RequirementsSheet node={node} onClose={() => setReqOpen(false)} />}
    </div>
  );
}

function FoldRow({ title, meta, open, onToggle, children }: { title: string; meta: string; open: boolean; onToggle: () => void; children: ComponentChildren }) {
  return (
    <section class={open ? 'fold open' : 'fold'}>
      <button type="button" class="fold-head" onClick={onToggle} aria-expanded={open}>
        <span class="fold-title">{title}</span>
        <span class="muted small">{meta}</span>
        <Icon name={open ? 'down' : 'right'} size={16} stroke={2.4} />
      </button>
      {open && <div class="fold-body">{children}</div>}
    </section>
  );
}

/** Прошлая тренировка: подходы, рекорд, мини-график. Нажатие — на страницу замера. */
function WorkoutCard({ info }: { info: MetricInfo }) {
  const m = info.metric;
  const sets = lastSetsOf(info);
  if (!info.last || !sets) {
    return (
      <a class="workout-card" href={`#/metrics/${m.id}`}>
        <span class="workout-label">Подходы</span>
        <span class="muted small">Пока пусто — запиши первую тренировку, и здесь появятся подходы и рекорд.</span>
      </a>
    );
  }
  const top = bestSet(sets);
  const best = info.best;
  return (
    <a class="workout-card" href={`#/metrics/${m.id}`}>
      <span class="spread"><span class="workout-label">Прошлая тренировка</span><span class="muted small">{humanDate(info.last.date).toLowerCase()}</span></span>
      <span class="set-chips">
        {sets.map((s, i) => (
          <span class={s === top ? 'set-chip best' : 'set-chip'} key={i}>
            {s.w !== undefined ? <>{fmtInput(s.w)} <small>{m.unit}</small> × {s.r > 0 ? s.r : '—'}</> : <>{s.r} <small>{m.unit}</small></>}
          </span>
        ))}
      </span>
      <span class="workout-foot">
        <span class="stack-4">
          <span class="muted small">рекорд</span>
          <span class="workout-record">{best ? `${fmtNum(best.value)} ${m.unit}${best.reps ? ` × ${best.reps}` : ''} · ${humanDate(best.date).toLowerCase()}` : '—'}</span>
        </span>
        <span style={{ '--c': 'var(--orange)' }}><Sparkline info={info} /></span>
      </span>
    </a>
  );
}

/** Меню ⋯: фокус, требования, замер, переименовать. */
function SkillMenu({ id, onFocus, onReq, onClose }: { id: string; onFocus: () => void; onReq: () => void; onClose: () => void }) {
  const w = useWorld();
  const node = w.nodeById.get(id)!;
  const [name, setName] = useState(node.title);
  const reqs = w.requirementsOf(node);
  const unlocks = w.unlocksOf(id);
  const metric = w.metricsOfSkill(id)[0];
  const reqText = [reqs.length ? `${reqs.filter((r) => r.met).length} из ${reqs.length} выполнено` : 'открыт сразу', unlocks.length ? `открывает: ${unlocks.map((u) => u.title).join(', ')}` : ''].filter(Boolean).join(' · ');
  return (
    <Sheet open onClose={onClose} title={node.title}>
      <div class="menu-list">
        <button type="button" class="menu-row" onClick={onFocus} aria-pressed={!!node.focus}>
          <span class="menu-row-icon gold"><Icon name="star" size={20} stroke={2.2} /></span>
          <span class="menu-row-text"><span class="strong">Сделать активным</span><span class="muted small">×1.2 XP, до трёх навыков</span></span>
          <span class={node.focus ? 'switch on' : 'switch'}><span /></span>
        </button>
        <button type="button" class="menu-row" onClick={onReq}>
          <span class="menu-row-icon"><Icon name="lock" size={20} /></span>
          <span class="menu-row-text"><span class="strong">Требования</span><span class="muted small">{reqText}</span></span>
          <Icon name="right" size={16} stroke={2.4} />
        </button>
        {metric && (
          <a class="menu-row" href={`#/metrics/${metric.id}`} onClick={onClose}>
            <span class="menu-row-icon"><Icon name="chart" size={20} /></span>
            <span class="menu-row-text"><span class="strong">Замер «{metric.title}»</span><span class="muted small">график, вся история, рубеж</span></span>
            <Icon name="right" size={16} stroke={2.4} />
          </a>
        )}
      </div>
      <form class="input-row" onSubmit={async (e) => { e.preventDefault(); if (name.trim()) { await renameNode(id, name); onClose(); } }}>
        <input id="skill-name" class="input" value={name} onInput={(e) => setName(e.currentTarget.value)} aria-label="Название навыка" />
        <button type="submit" class="btn ghost" disabled={!name.trim() || name.trim() === node.title}>Переименовать</button>
      </form>
    </Sheet>
  );
}

function GoalRow({ g, editing }: { g: Goal; editing: boolean }) {
  const anim = useWorld().hasExp('anim');
  return (
    <div class="goal-line">
      <button type="button" class={g.done ? 'goal-row' : 'goal-row open'} aria-pressed={g.done} onClick={async () => {
        const stages = await toggleGoal(g.id);
        // Цель сама по себе XP не даёт; пройденный ею этап — даёт (+100), это и летит к уровню.
        if (anim && stages.length) fx({ kind: 'xp', amount: stages.length * STAGE_BONUS, badges: ['этап пройден'] });
        stagesToast(stages);
      }}>
        <Check done={g.done} />
        <span>{g.title}</span>
        <span class="goal-kind">{g.kind === 'practice' ? 'практика' : 'теория'}</span>
      </button>
      {editing && <button type="button" class="icon-btn" aria-label={`Удалить цель ${g.title}`} onClick={() => deleteGoal(g.id)}><Icon name="trash" size={18} /></button>}
    </div>
  );
}

function Goals({ skillId, goals }: { skillId: string; goals: Goal[] }) {
  const w = useWorld();
  const stages = w.stagesOfSkill(skillId);
  const cur = w.currentStageOf(skillId);
  const last = stages[stages.length - 1]?.stage ?? 0;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<GoalKind>('practice');
  const [target, setTarget] = useState<number>(cur?.stage ?? Math.max(1, last));
  const [editing, setEditing] = useState(false);
  // Подсказки цели: из путей для этого навыка и общие с его названием → все цели путей.
  const skillTitle = w.nodeById.get(skillId)?.title ?? '';
  const goalIdeasHere = useMemo(() => items({ goal: goalIdeas(skillTitle), idea: allPathGoals() }), [skillTitle]);
  const [openDone, setOpenDone] = useState<number[]>([]);

  return (
    <div class="stack-10">
      {goals.length === 0 && <p class="muted">Целей пока нет. Добавь, что хочешь узнать и что сделать руками.</p>}

      {stages.map((s) => {
        if (s.complete && s.unlocked) {
          const open = openDone.includes(s.stage);
          return (
            <div class="stage done" key={s.stage}>
              <button type="button" class="stage-head" onClick={() => setOpenDone(open ? openDone.filter((x) => x !== s.stage) : [...openDone, s.stage])} aria-expanded={open}>
                <span class="stage-num ok"><Icon name="check" size={16} stroke={3} /></span>
                <span class="stage-text"><span class="strong">Ступень {s.stage} · {s.name}</span><span class="stage-sub ok">пройдена · {s.done} из {s.goals.length}</span></span>
                <Icon name={open ? 'down' : 'right'} size={16} stroke={2.4} />
              </button>
              {open && <div class="stage-goals">{s.goals.map((g) => <GoalRow g={g} editing={editing} key={g.id} />)}</div>}
            </div>
          );
        }
        if (s.unlocked) {
          return (
            <div class="stage current" key={s.stage}>
              <div class="stage-head">
                <span class="stage-num">{s.stage}</span>
                <span class="stage-text"><span class="strong">Ступень {s.stage} · {s.name}</span><span class="stage-sub">текущая · {s.done} из {s.goals.length}</span></span>
                <span class="stage-bonus">+{STAGE_BONUS} XP</span>
              </div>
              <div class="stage-goals">{s.goals.map((g) => <GoalRow g={g} editing={editing} key={g.id} />)}</div>
            </div>
          );
        }
        return (
          <div class="stage locked" key={s.stage}>
            <div class="stage-head">
              <span class="stage-num lock"><Icon name="lock" size={16} /></span>
              <span class="stage-text"><span class="strong">Ступень {s.stage} · {s.name}</span><span class="stage-sub">откроется после ступени {s.stage - 1} · {s.goals.length} {s.goals.length === 1 ? 'цель' : s.goals.length < 5 ? 'цели' : 'целей'}</span></span>
            </div>
            {editing && <div class="stage-goals">{s.goals.map((g) => <GoalRow g={g} editing key={g.id} />)}</div>}
          </div>
        );
      })}

      <form class="stack-8 goal-form" onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await addGoal(skillId, kind, title, target);
        setTitle('');
      }}>
        <span class="section-label">Новая цель</span>
        <div class="chips">
          {stages.map((s) => (
            <button type="button" key={s.stage} class={target === s.stage ? 'chip big primary' : 'chip big'} onClick={() => setTarget(s.stage)}>{s.stage} · {s.name}</button>
          ))}
          <button type="button" class={target === last + 1 ? 'chip big primary' : 'chip big dashed'} onClick={() => setTarget(last + 1)}>+ ступень {stageName(last + 1)}</button>
        </div>
        <div class="segmented">
          <button type="button" class={kind === 'theory' ? 'on' : ''} onClick={() => setKind('theory')}>Теория</button>
          <button type="button" class={kind === 'practice' ? 'on' : ''} onClick={() => setKind('practice')}>Практика</button>
        </div>
        <div class="input-row">
          <SuggestInput id="goal-title" placeholder="Например: сварить бульон" value={title} onValue={setTitle} items={goalIdeasHere} exclude={goals.map((g) => g.title)} />
          <button type="submit" class="btn primary square" aria-label="Добавить цель" disabled={!title.trim()}><Icon name="plus" size={20} stroke={2.6} /></button>
        </div>
      </form>
      {goals.length > 0 && <button type="button" class="link small" onClick={() => setEditing(!editing)}>{editing ? 'Готово' : 'Удалить цели…'}</button>}
    </div>
  );
}

function Notes({ skillId }: { skillId: string }) {
  const w = useWorld();
  const notes = w.notes.filter((n) => n.skillId === skillId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');

  return (
    <div class="stack-12">
      <form class="stack-8" onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim() && !url.trim()) return;
        await addNote(skillId, body || url, url);
        setBody('');
        setUrl('');
      }}>
        <textarea id="note-body" rows={3} placeholder="Заметка: вывод, рецепт, инструкция" value={body} onInput={(e) => setBody(e.currentTarget.value)} />
        <input id="note-url" class="input" type="url" placeholder="Ссылка (необязательно)" value={url} onInput={(e) => setUrl(e.currentTarget.value)} />
        <button type="submit" class="btn ghost" disabled={!body.trim() && !url.trim()}>Добавить</button>
      </form>
      {notes.length === 0 && <p class="muted">Здесь будут твои заметки и ссылки по навыку.</p>}
      {notes.map((n) => (
        <div class="note" key={n.id}>
          {n.kind === 'link' ? (
            <div class="note-link">
              <button type="button" class="check-btn" aria-label={n.studied ? 'Отметить как неизученное' : 'Отметить как изученное'} onClick={() => toggleNoteStudied(n.id)}><Check done={!!n.studied} /></button>
              <a href={n.url} target="_blank" rel="noopener noreferrer">{n.body}</a>
            </div>
          ) : (
            <p class="note-text">{n.body}</p>
          )}
          <div class="spread">
            <span class="muted small">{humanDate(n.createdAt.slice(0, 10))}</span>
            <button type="button" class="icon-btn" aria-label="Удалить заметку" onClick={() => deleteNote(n.id)}><Icon name="trash" size={18} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function GalleryItem({ id, onOpen }: { id: string; onOpen: () => void }) {
  const url = usePhotoUrl(id);
  return <button type="button" class="gallery-item" onClick={onOpen} aria-label="Открыть фото">{url && <img src={url} alt="" />}</button>;
}

function FullPhoto({ id, onClose }: { id: string; onClose: () => void }) {
  useBackClose(true, onClose);
  const url = usePhotoUrl(id, 'full');
  return (
    <div class="lightbox" onClick={onClose} role="dialog" aria-label="Фото">
      {url && <img src={url} alt="" />}
    </div>
  );
}

function Gallery({ photoIds }: { photoIds: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (photoIds.length === 0) return <p class="muted">Фото из действий по навыку появятся здесь.</p>;
  return (
    <>
      <div class="gallery">{photoIds.map((id) => <GalleryItem id={id} key={id} onOpen={() => setOpen(id)} />)}</div>
      {open && <FullPhoto id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
