import { useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import type { Goal } from '../db/db';
import { addGoal, addNote, deleteGoal, deleteNote, toggleFocus, toggleGoal, toggleNoteStudied } from '../db/actions';
import type { GoalKind } from '../engine/progress';
import { humanDate } from '../engine/dates';
import { STAGE_BONUS, stageName } from '../engine/stages';
import { toast } from '../lib/toast';
import { Icon } from '../components/Icon';
import { Check, LevelBadge, ProgressBar, TopBar } from '../components/ui';
import { EntryCard } from '../components/EntryCard';
import { RequirementsSheet } from '../components/RequirementsSheet';
import { usePhotoUrl } from '../lib/photo';
import type { EntryPreset } from './EntrySheet';

type Tab = 'goals' | 'exp' | 'notes' | 'gallery';
// Короткие подписи: четыре вкладки должны влезать в строку на телефоне.
const TABS: [Tab, string][] = [['goals', 'Цели'], ['exp', 'Опыт'], ['notes', 'Заметки'], ['gallery', 'Фото']];

export const stagesToast = (names: string[]) =>
  names.forEach((n) => toast({ kind: 'achievement', title: `Ступень «${n}» пройдена`, sub: `+${STAGE_BONUS} XP` }));

export function Skill({ id, onAdd }: { id: string; onAdd: (p: EntryPreset) => void }) {
  const w = useWorld();
  const [tab, setTab] = useState<Tab>('goals');
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
  const lv = w.skillLevelOf(id);
  const prog = w.skillProgressOf(id);
  const reqs = w.requirementsOf(node);
  const unlocks = w.unlocksOf(id);
  const errors = w.openErrorsBySkill.get(id) ?? [];
  const goals = w.goalsBySkill.get(id) ?? [];
  const entries = w.entriesBySkill.get(id) ?? [];
  const stages = w.stagesOfSkill(id);
  const cur = w.currentStageOf(id);
  const rust = w.rustDays(id);

  const onFocus = async () => {
    const ok = await toggleFocus(id);
    if (!ok) toast({ kind: 'info', title: 'В фокусе уже 3 навыка', sub: 'Сними фокус с одного из них' });
  };

  return (
    <div class="page">
      <TopBar crumbs={w.pathOf(id).slice(0, -1).map((n) => n.title).join(' › ')} />

      <div class="stack-12">
        <div class="skill-head">
          <div class="stack-8">
            <h1 class="display">{node.title}</h1>
            <button type="button" class={node.focus ? 'focus-btn on' : 'focus-btn'} onClick={onFocus} aria-pressed={!!node.focus}>
              <Icon name="star" size={16} stroke={2.2} />
              {node.focus ? 'В фокусе · ×1.2' : 'В фокус'}
            </button>
          </div>
          <LevelBadge level={lv.level} name={lv.name} pct={lv.pct} left={lv.left} />
        </div>
        <ProgressBar pct={prog?.pct ?? 0} color={area?.color} height={12} />
        <div class="spread small strong">
          <span>{prog ? `${Math.round(prog.pct)}%` : 'Нет целей'}</span>
          <span class="muted">
            {prog ? `${cur ? `ступень ${cur.stage} из ${stages.length} · ` : ''}${prog.done} из ${prog.total} целей` : 'добавь цели, чтобы появилась полоска'}
          </span>
        </div>
      </div>

      {rust !== null && (
        <div class="notice">
          <Icon name="web" size={18} />
          <div class="stack-4">
            <span class="strong">{rust} дней без записей</span>
            <span class="small">Первая запись после перерыва даст +50% XP.</span>
          </div>
        </div>
      )}

      <div class="req-card">
        <div class="spread">
          <span class="section-label">Требования</span>
          <button type="button" class="link small" onClick={() => setReqOpen(true)}>Настроить</button>
        </div>
        {reqs.length === 0 ? (
          <span class="small fg-2">Открыт сразу</span>
        ) : (
          reqs.map((r) => (
            <a class="req-line" href={`#/skill/${r.node.id}`} key={r.index}>
              <Check done={r.met} />
              <span>{r.node.title} — {r.need}</span>
              {!r.met && <span class="muted small">сейчас {r.have}</span>}
            </a>
          ))
        )}
        {reqs.some((r) => !r.met) && <span class="muted small">Записывать опыт можно и до открытия.</span>}
        {unlocks.length > 0 && <span class="small fg-2">Сам открывает: <b>{unlocks.map((u) => u.title).join(', ')}</b></span>}
      </div>

      {errors.map((e) => (
        <div class="notice error" key={e.id}>
          <span class="notice-icon"><Icon name="alert" size={16} stroke={2.6} /></span>
          <div class="stack-4">
            <span class="strong">Нерешённая ошибка</span>
            <span class="small">{humanDate(e.date)} — {e.failNote || e.text}</span>
            <button type="button" class="link small" onClick={() => onAdd({ skillId: id, fixesEntryId: e.id })}>Исправил — записать (×1.5 XP)</button>
          </div>
        </div>
      ))}

      <button type="button" class="btn primary" onClick={() => onAdd({ skillId: id })}>
        <Icon name="plus" size={20} stroke={2.6} /> Записать опыт
      </button>

      <div class="segmented four" role="tablist">
        {TABS.map(([t, label]) => (
          <button type="button" role="tab" aria-selected={tab === t} key={t} class={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      {tab === 'goals' && <Goals skillId={id} goals={goals} />}
      {tab === 'exp' && (
        <div class="stack-10">
          <div class="muted small">{lv.xp} XP · {entries.length} {entries.length === 1 ? 'запись' : 'записей'}</div>
          {entries.length === 0 ? <p class="muted">Пока нет записей по этому навыку.</p> : entries.map((e) => <EntryCard entry={e} key={e.id} />)}
        </div>
      )}
      {tab === 'notes' && <Notes skillId={id} />}
      {tab === 'gallery' && <Gallery photoIds={entries.flatMap((e) => e.photoIds)} />}

      {reqOpen && <RequirementsSheet node={node} onClose={() => setReqOpen(false)} />}
    </div>
  );
}

function GoalRow({ g, editing }: { g: Goal; editing: boolean }) {
  return (
    <div class="goal-line">
      <button type="button" class={g.done ? 'goal-row' : 'goal-row open'} onClick={async () => stagesToast(await toggleGoal(g.id))} aria-pressed={g.done}>
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
          <input id="goal-title" class="input" placeholder="Например: сварить бульон" value={title} onInput={(e) => setTitle(e.currentTarget.value)} />
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
  const url = usePhotoUrl(id, 'full');
  return (
    <div class="lightbox" onClick={onClose} role="dialog" aria-label="Фото">
      {url && <img src={url} alt="" />}
    </div>
  );
}

function Gallery({ photoIds }: { photoIds: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (photoIds.length === 0) return <p class="muted">Фото из записей по навыку появятся здесь.</p>;
  return (
    <>
      <div class="gallery">{photoIds.map((id) => <GalleryItem id={id} key={id} onOpen={() => setOpen(id)} />)}</div>
      {open && <FullPhoto id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
