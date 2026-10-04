import { useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import type { Goal } from '../db/db';
import { addGoal, addNote, deleteGoal, deleteNote, toggleGoal, toggleNoteStudied } from '../db/actions';
import type { GoalKind } from '../engine/progress';
import { humanDate } from '../engine/dates';
import { Icon } from '../components/Icon';
import { Check, LevelBadge, ProgressBar, SectionLabel, TopBar } from '../components/ui';
import { EntryCard } from '../components/EntryCard';
import { usePhotoUrl } from '../lib/photo';
import type { EntryPreset } from './EntrySheet';

type Tab = 'goals' | 'exp' | 'notes' | 'gallery';
const TABS: [Tab, string][] = [['goals', 'Цели'], ['exp', 'Опыт'], ['notes', 'Материалы'], ['gallery', 'Галерея']];

export function Skill({ id, onAdd }: { id: string; onAdd: (p: EntryPreset) => void }) {
  const w = useWorld();
  const [tab, setTab] = useState<Tab>('goals');
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
  const locks = w.lockReasons(node);
  const errors = w.openErrorsBySkill.get(id) ?? [];
  const goals = w.goalsBySkill.get(id) ?? [];
  const entries = w.entriesBySkill.get(id) ?? [];

  return (
    <div class="page">
      <TopBar crumbs={w.pathOf(id).slice(0, -1).map((n) => n.title).join(' › ')} />

      <div class="stack-12">
        <div class="skill-head">
          <h1 class="display">{node.title}</h1>
          <LevelBadge level={lv.level} name={lv.name} pct={lv.pct} left={lv.left} />
        </div>
        <ProgressBar pct={prog?.pct ?? 0} color={area?.color} height={12} />
        <div class="spread small strong">
          <span>{prog ? `${Math.round(prog.pct)}%` : 'Нет целей'}</span>
          <span class="muted">{prog ? `закрыто ${prog.done} из ${prog.total} целей` : 'добавь цели, чтобы появилась полоска'}</span>
        </div>
      </div>

      {locks.length > 0 && (
        <div class="notice">
          <Icon name="lock" size={18} />
          <div class="stack-4">
            <span class="strong">Навык закрыт</span>
            {locks.map((l) => <a class="small" href={`#/skill/${l.node.id}`} key={l.node.id}>Нужно: {l.node.title} — {l.need} (сейчас {l.have})</a>)}
            <span class="muted small">Записывать опыт уже можно.</span>
          </div>
        </div>
      )}

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
    </div>
  );
}

function Goals({ skillId, goals }: { skillId: string; goals: Goal[] }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<GoalKind>('practice');
  const [editing, setEditing] = useState(false);

  const section = (k: GoalKind, label: string) => {
    const list = goals.filter((g) => g.kind === k);
    if (list.length === 0) return null;
    return (
      <div class="stack-4">
        <SectionLabel right={<span class="muted small strong">{list.filter((g) => g.done).length} / {list.length}</span>}>{label}</SectionLabel>
        {list.map((g) => (
          <div class="goal-line" key={g.id}>
            <button type="button" class={g.done ? 'goal-row' : 'goal-row open'} onClick={() => toggleGoal(g.id)} aria-pressed={g.done}>
              <Check done={g.done} />
              <span>{g.title}</span>
            </button>
            {editing && <button type="button" class="icon-btn" aria-label={`Удалить цель ${g.title}`} onClick={() => deleteGoal(g.id)}><Icon name="trash" size={18} /></button>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div class="stack-16">
      {section('theory', 'Теория · вес 1')}
      {section('practice', 'Практика · вес 2')}
      {goals.length === 0 && <p class="muted">Целей пока нет. Добавь, что хочешь узнать и что сделать руками.</p>}
      <form class="stack-8" onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await addGoal(skillId, kind, title);
        setTitle('');
      }}>
        <div class="segmented">
          <button type="button" class={kind === 'theory' ? 'on' : ''} onClick={() => setKind('theory')}>Теория</button>
          <button type="button" class={kind === 'practice' ? 'on' : ''} onClick={() => setKind('practice')}>Практика</button>
        </div>
        <div class="input-row">
          <input id="goal-title" class="input" placeholder="Новая цель" value={title} onInput={(e) => setTitle(e.currentTarget.value)} />
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
