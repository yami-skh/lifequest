import { useMemo, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import type { Node, NodeKind } from '../db/db';
import { addNode, deleteNode, renameNode } from '../db/actions';
import { AREA_COLORS } from '../db/seed';
import { AREA_ICONS } from '../db/db';
import { go } from '../lib/router';
import { Icon } from '../components/Icon';
import { AreaTile, Confirm, Ring, Sheet, pctText } from '../components/ui';
import { plural } from './Character';
import { ac } from '../lib/theme';
import { StarMap } from '../components/StarMap';
import { TemplatesSheet } from '../components/Templates';

type Editor =
  | { mode: 'menu'; node: Node }
  | { mode: 'add'; parent: Node | null; kind: NodeKind }
  | { mode: 'rename'; node: Node };

const loadExpanded = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem('lq.expanded') ?? '[]');
  } catch {
    return [];
  }
};

export function Tree({ focusId }: { focusId?: string }) {
  const w = useWorld();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set(loadExpanded());
    if (focusId) s.add(focusId);
    return s;
  });
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [toDelete, setToDelete] = useState<Node | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const tpl = w.hasExp('templates');
  const [mode, setModeState] = useState<'list' | 'stars'>(() => {
    try {
      return localStorage.getItem('lq.treeView') === 'stars' ? 'stars' : 'list';
    } catch {
      return 'list';
    }
  });
  const setMode = (m: 'list' | 'stars') => {
    setModeState(m);
    try {
      localStorage.setItem('lq.treeView', m);
    } catch {
      /* не критично */
    }
  };

  const toggle = (id: string) => {
    const s = new Set(expanded);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setExpanded(s);
    try {
      localStorage.setItem('lq.expanded', JSON.stringify([...s]));
    } catch {
      /* не критично */
    }
  };

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? w.nodes.filter((n) => n.title.toLowerCase().includes(q)) : null;
  }, [query, w.nodes]);

  /** Сколько навыков внутри узла. */
  const skillCount = (n: Node): number =>
    n.kind === 'skill' ? 1 : (w.children.get(n.id) ?? []).reduce((acc, k) => acc + skillCount(k), 0);

  const skillsIn = (n: Node): Node[] => (n.kind === 'skill' ? [n] : (w.children.get(n.id) ?? []).flatMap(skillsIn));
  const exploredTotal = w.skills.filter((s) => w.explored(s.id)).length;

  const menuBtn = (n: Node) => (
    <button type="button" class="icon-btn" aria-label={`Действия: ${n.title}`} onClick={() => setEditor({ mode: 'menu', node: n })}>
      <Icon name="dots" size={22} stroke={3} />
    </button>
  );

  const renderChildren = (n: Node) => (
    <div class="t-rail">
      {(w.children.get(n.id) ?? []).map(renderNode)}
      <div class="t-item t-add">
        <button type="button" class="link small" onClick={() => setEditor({ mode: 'add', parent: n, kind: 'skill' })}>+ навык</button>
        <button type="button" class="link small" onClick={() => setEditor({ mode: 'add', parent: n, kind: 'branch' })}>+ ветка</button>
      </div>
    </div>
  );

  const renderNode = (n: Node) => {
    const p = w.progress.get(n.id);
    const open = expanded.has(n.id);

    if (n.kind === 'skill') {
      const lv = w.skillLevelOf(n.id);
      const locks = w.lockReasons(n);
      const fresh = !w.explored(n.id);
      const rust = w.rustDays(n.id);
      const stage = w.currentStageOf(n.id);
      const stages = w.stagesOfSkill(n.id);
      const cls = `t-item t-skill${locks.length ? ' locked' : ''}${fresh && !locks.length ? ' fog' : ''}${rust !== null ? ' rusty' : ''}${n.focus ? ' focus' : ''}`;
      return (
        <div class={cls} key={n.id}>
          <a class="t-skill-card" href={`#/skill/${n.id}`}>
            <Ring pct={fresh ? 0 : lv.pct} size={40} stroke={3.5} color="var(--c)">
              {locks.length ? <Icon name="lock" size={16} /> : fresh ? <span class="t-lvl muted">?</span> : <span class="t-lvl">{lv.level}</span>}
            </Ring>
            <span class="t-skill-body">
              <span class="t-skill-top">
                <span class="t-skill-title">{n.title}{n.focus && <Icon name="star" size={14} stroke={2.4} />}</span>
                <span class="t-skill-pct">{pctText(p)}</span>
              </span>
              {p !== null && p !== undefined && <span class="mini-bar"><span style={{ width: `${p}%`, background: 'var(--c)' }} /></span>}
              {locks.length > 0 ? (
                locks.map((l) => <span class="t-sub" key={l.node.id}>Откроется: {l.node.title} {l.need} (сейчас {l.have})</span>)
              ) : (
                <span class="t-sub">
                  {rust !== null
                    ? `${rust} дней без записей · вернись: +50%`
                    : fresh
                      ? 'не исследован · первая запись ×1.5'
                      : stage && stages.length > 1
                        ? `${n.focus ? 'в фокусе · ' : ''}ступень ${stage.stage} из ${stages.length}`
                        : `${lv.name} · ${lv.xp} XP`}
                </span>
              )}
            </span>
            {rust !== null && <span class="t-web"><Icon name="web" size={30} stroke={1.2} /></span>}
          </a>
          {menuBtn(n)}
        </div>
      );
    }

    if (n.kind === 'branch') {
      const count = skillCount(n);
      return (
        <div class="t-item t-branch" key={n.id}>
          <div class="t-branch-row">
            <button type="button" class="t-branch-btn" onClick={() => toggle(n.id)} aria-expanded={open}>
              <span class={open ? 't-diamond open' : 't-diamond'} />
              <span class="t-branch-title">{n.title}</span>
              <span class="t-sub">{count ? `${pctText(p)} · ${count} нав.` : 'пусто'}</span>
              <Icon name={open ? 'down' : 'right'} size={16} stroke={2.4} />
            </button>
            {menuBtn(n)}
          </div>
          {open && renderChildren(n)}
        </div>
      );
    }

    const count = skillCount(n);
    const explored = skillsIn(n).filter((s) => w.explored(s.id)).length;
    return (
      <section class={open ? 't-area open' : 't-area'} key={n.id} style={{ '--c': ac(n.color) ?? 'var(--muted)' }}>
        <div class="t-area-head">
          <button type="button" class="t-area-btn" onClick={() => toggle(n.id)} aria-expanded={open}>
            <AreaTile node={n} size={44} />
            <span class="t-area-text">
              <span class="t-area-title">{n.title}</span>
              <span class="t-sub">{count} {plural(count, 'навык', 'навыка', 'навыков')} · {explored} исследовано</span>
            </span>
            <Ring pct={p ?? 0} size={46} stroke={4} color="var(--c)">
              <span class="t-ring-pct">{p === null || p === undefined ? '—' : `${Math.round(p)}%`}</span>
            </Ring>
          </button>
          {menuBtn(n)}
        </div>
        {open && renderChildren(n)}
      </section>
    );
  };

  return (
    <div class="page">
      <div class="spread">
        <div class="stack-4">
          <h1 class="display small-display">Дерево навыков</h1>
          <span class="t-sub">исследовано {exploredTotal} из {w.skills.length}</span>
        </div>
        <div class="tree-head-btns">
          {tpl && <button type="button" class="icon-btn round tpl-open" aria-label="Готовые пути" title="Готовые пути" onClick={() => setTplOpen(true)}><Icon name="grid" size={20} /></button>}
          <button type="button" class="icon-btn round" aria-label="Добавить направление" onClick={() => setEditor({ mode: 'add', parent: null, kind: 'area' })}><Icon name="plus" size={20} stroke={2.4} /></button>
        </div>
      </div>

      {tpl && w.skills.length < 5 && (
        <button type="button" class="tpl-hint" onClick={() => setTplOpen(true)}>
          <span class="strong">Не знаешь, с чего начать?</span>
          <span class="muted">Возьми готовый путь: навыки, цели по ступеням и замеры уже расписаны.</span>
          <span class="tpl-go">Выбрать шаблон →</span>
        </button>
      )}

      <div class="segmented" role="tablist" aria-label="Вид дерева">
        <button type="button" role="tab" aria-selected={mode === 'list'} class={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>Список</button>
        <button type="button" role="tab" aria-selected={mode === 'stars'} class={mode === 'stars' ? 'on' : ''} onClick={() => setMode('stars')}>Созвездие</button>
      </div>

      {mode === 'stars' ? <StarMap /> : <>

      <label class="search">
        <Icon name="search" size={18} />
        <input id="tree-search" placeholder="Найти навык" value={query} onInput={(e) => setQuery(e.currentTarget.value)} aria-label="Найти навык" />
      </label>

      {found ? (
        <div class="stack-4">
          {found.map((n) => (
            <button type="button" key={n.id} class="picker-item" onClick={() => {
              if (n.kind === 'skill') go(`skill/${n.id}`);
              else {
                const s = new Set(expanded);
                w.pathOf(n.id).forEach((x) => s.add(x.id));
                setExpanded(s);
                setQuery('');
              }
            }}>
              <span>{n.title}</span>
              <span class="muted small">{w.pathOf(n.id).slice(0, -1).map((x) => x.title).join(' › ') || 'направление'}</span>
            </button>
          ))}
          {found.length === 0 && <p class="muted">Ничего не нашлось.</p>}
        </div>
      ) : (
        <div class="t-tree">{w.areas.map(renderNode)}</div>
      )}
      </>}

      <TemplatesSheet open={tplOpen} onClose={() => setTplOpen(false)} />

      <NodeEditor editor={editor} onClose={() => setEditor(null)} onDelete={(n) => { setEditor(null); setToDelete(n); }} onAdded={(parentId) => {
        if (parentId && !expanded.has(parentId)) toggle(parentId);
      }} setEditor={setEditor} />

      <Confirm
        open={!!toDelete}
        title={`Удалить «${toDelete?.title}»?`}
        text="Удалится всё, что внутри: ветки, навыки, цели и заметки. Записи журнала и заработанный XP персонажа останутся."
        action="Удалить"
        onConfirm={() => toDelete && deleteNode(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

const KIND_LABEL: Record<NodeKind, string> = { area: 'направление', branch: 'ветку', skill: 'навык' };

function NodeEditor({ editor, onClose, onDelete, onAdded, setEditor }: {
  editor: Editor | null;
  onClose: () => void;
  onDelete: (n: Node) => void;
  onAdded: (parentId: string | null) => void;
  setEditor: (e: Editor) => void;
}) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(AREA_COLORS[0]);
  const [icon, setIcon] = useState(AREA_ICONS[0]);

  if (!editor) return null;

  if (editor.mode === 'menu') {
    const n = editor.node;
    return (
      <Sheet open onClose={onClose} title={n.title}>
        <div class="stack-8">
          {n.kind !== 'skill' && (
            <>
              <button type="button" class="menu-item" onClick={() => { setTitle(''); setEditor({ mode: 'add', parent: n, kind: 'skill' }); }}><Icon name="plus" />Добавить навык внутрь</button>
              <button type="button" class="menu-item" onClick={() => { setTitle(''); setEditor({ mode: 'add', parent: n, kind: 'branch' }); }}><Icon name="tree" />Добавить ветку внутрь</button>
            </>
          )}
          {n.kind === 'skill' && <a class="menu-item" href={`#/skill/${n.id}`} onClick={onClose}><Icon name="right" />Открыть навык</a>}
          <button type="button" class="menu-item" onClick={() => { setTitle(n.title); setEditor({ mode: 'rename', node: n }); }}><Icon name="edit" />Переименовать</button>
          <button type="button" class="menu-item danger-text" onClick={() => onDelete(n)}><Icon name="trash" />Удалить</button>
        </div>
      </Sheet>
    );
  }

  const isRename = editor.mode === 'rename';
  const submit = async (e: Event) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (editor.mode === 'rename') await renameNode(editor.node.id, title);
    else {
      await addNode(editor.parent?.id ?? null, editor.kind, title, editor.kind === 'area' ? color : undefined, editor.kind === 'area' ? icon : undefined);
      onAdded(editor.parent?.id ?? null);
    }
    setTitle('');
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={isRename ? 'Переименовать' : `Новое: ${KIND_LABEL[editor.kind]}`}>
      <form class="stack-12" onSubmit={submit}>
        {!isRename && editor.parent && <p class="muted small">Внутри: {editor.parent.title}</p>}
        <input id="node-title" class="input" placeholder="Название" value={title} onInput={(e) => setTitle(e.currentTarget.value)} autoFocus />
        {!isRename && editor.kind === 'area' && (
          <div class="colors" role="radiogroup" aria-label="Цвет направления">
            {AREA_COLORS.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} class={color === c ? 'color on' : 'color'} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        )}
        {!isRename && editor.kind === 'area' && (
          <div class="icons" role="radiogroup" aria-label="Иконка направления">
            {AREA_ICONS.map((ic) => (
              <button type="button" key={ic} role="radio" aria-checked={icon === ic} aria-label={ic} class={icon === ic ? 'icon-pick on' : 'icon-pick'} style={{ color }} onClick={() => setIcon(ic)}>
                <Icon name={ic} size={22} />
              </button>
            ))}
          </div>
        )}
        {!isRename && editor.kind === 'skill' && <p class="muted small">Цели навыка добавишь на его странице.</p>}
        <button type="submit" class="btn primary" disabled={!title.trim()}>{isRename ? 'Сохранить' : 'Добавить'}</button>
      </form>
    </Sheet>
  );
}
