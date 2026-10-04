import { useMemo, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import type { Node, NodeKind } from '../db/db';
import { addNode, deleteNode, renameNode } from '../db/actions';
import { AREA_COLORS } from '../db/seed';
import { AREA_ICONS } from '../db/db';
import { go } from '../lib/router';
import { Icon } from '../components/Icon';
import { Confirm, Sheet, pctText } from '../components/ui';

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

  const renderNode = (n: Node, depth: number) => {
    const p = w.progress.get(n.id);
    const kids = w.children.get(n.id) ?? [];
    const open = expanded.has(n.id);
    const locks = n.kind === 'skill' ? w.lockReasons(n) : [];
    const area = w.areaOf(n.id);

    if (n.kind === 'skill') {
      const lv = w.skillLevelOf(n.id);
      return (
        <div class="tree-skill-wrap" key={n.id} style={{ marginLeft: `${depth * 16}px` }}>
          <a class={locks.length ? 'tree-skill locked' : 'tree-skill'} href={`#/skill/${n.id}`}>
            <span class="spread">
              <span class="tree-skill-title">
                {locks.length > 0 && <Icon name="lock" size={16} />}
                {n.title}
              </span>
              <span class="tree-skill-meta">
                <span class="lvl-chip">ур. {lv.level}</span>
                <span class="strong">{pctText(p)}</span>
              </span>
            </span>
            {p !== null && p !== undefined && <span class="mini-bar"><span style={{ width: `${p}%`, background: area?.color }} /></span>}
            {locks.map((l) => <span class="muted small" key={l.node.id}>Откроется: {l.node.title} — {l.need} (сейчас {l.have})</span>)}
          </a>
          <button type="button" class="icon-btn" aria-label={`Действия: ${n.title}`} onClick={() => setEditor({ mode: 'menu', node: n })}><Icon name="dots" size={22} stroke={3} /></button>
        </div>
      );
    }

    return (
      <div key={n.id}>
        <div class="tree-row" style={{ paddingLeft: `${depth * 16}px` }}>
          <button type="button" class="tree-toggle" onClick={() => toggle(n.id)} aria-expanded={open}>
            <Icon name={open ? 'down' : 'right'} size={16} stroke={2.4} />
            {n.kind === 'area' && <span class="dot" style={{ background: n.color }} />}
            <span class={n.kind === 'area' ? 'tree-title area' : 'tree-title'}>{n.title}</span>
            <span class="muted small strong">{p === null || p === undefined ? (kids.length ? '—' : 'пусто') : pctText(p)}</span>
          </button>
          <button type="button" class="icon-btn" aria-label={`Действия: ${n.title}`} onClick={() => setEditor({ mode: 'menu', node: n })}><Icon name="dots" size={22} stroke={3} /></button>
        </div>
        {open && (
          <div class="tree-children">
            {kids.map((k) => renderNode(k, depth + 1))}
            <div class="tree-add" style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
              <button type="button" class="link small" onClick={() => setEditor({ mode: 'add', parent: n, kind: 'skill' })}>+ навык</button>
              <button type="button" class="link small" onClick={() => setEditor({ mode: 'add', parent: n, kind: 'branch' })}>+ ветка</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div class="page">
      <div class="spread">
        <h1 class="display small-display">Дерево навыков</h1>
        <button type="button" class="icon-btn round" aria-label="Добавить направление" onClick={() => setEditor({ mode: 'add', parent: null, kind: 'area' })}><Icon name="plus" size={20} stroke={2.4} /></button>
      </div>

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
        <div class="tree">{w.areas.map((a) => renderNode(a, 0))}</div>
      )}

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
