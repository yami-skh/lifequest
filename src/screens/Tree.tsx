import { useMemo, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import type { Node, NodeKind } from '../db/db';
import { addNode, addPresetSkill, deleteNode, renameNode } from '../db/actions';
import { AREA_COLORS } from '../db/seed';
import { AREA_ICONS } from '../db/db';
import { go } from '../lib/router';
import { Icon } from '../components/Icon';
import { AreaTile, Confirm, Ring, Sheet, pctText } from '../components/ui';
import { plural } from './Character';
import { ac } from '../lib/theme';
import { StarMap } from '../components/StarMap';
import { TemplatesSheet } from '../components/Templates';
import { presetsFor } from '../data/presets';
import type { TplSkill } from '../engine/templates';

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
  // Готовые пути: за флагом, но новичку с почти пустым деревом — сразу (иначе после «пустого дерева» их не найти).
  const tpl = w.hasExp('templates') || w.skills.length < 5;
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
                    ? `${rust} дней без действий · вернись: +50%`
                    : fresh
                      ? 'не исследован · первое действие ×1.5'
                      : stage && stages.length > 1
                        ? `${n.focus ? 'активный · ' : ''}ступень ${stage.stage} из ${stages.length}`
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
        text="Удалится всё, что внутри: ветки, навыки, цели и заметки. Действия в журнале и заработанный XP персонажа останутся."
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
  const w = useWorld();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(AREA_COLORS[0]);
  const [icon, setIcon] = useState(AREA_ICONS[0]);
  const [preset, setPreset] = useState<TplSkill | null>(null);
  const [allPresets, setAllPresets] = useState(false);

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
  // Готовые навыки (§12): по направлению, куда добавляем; за флагом «Готовые пути».
  const area = editor.mode === 'add' && editor.parent ? w.areaOf(editor.parent.id) : undefined;
  const presets = editor.mode === 'add' && editor.kind === 'skill' && editor.parent && area && w.hasExp('templates') ? presetsFor(area.title) : [];
  const haveTitles = new Set(w.skills.map((n) => n.title.trim().toLowerCase()));
  const has = (p: TplSkill) => haveTitles.has(p.title.trim().toLowerCase());
  const sorted = [...presets.filter((p) => !has(p)), ...presets.filter(has)];
  const shown = allPresets ? sorted : sorted.slice(0, 3);
  const goalCount = (p: TplSkill) => p.stages.reduce((n, st) => n + st.goals.length, 0);
  const close = () => {
    setTitle('');
    setPreset(null);
    setAllPresets(false);
    onClose();
  };
  const submit = async (e: Event) => {
    e.preventDefault();
    if (editor.mode === 'add' && preset && editor.parent) {
      await addPresetSkill(editor.parent.id, preset);
      onAdded(editor.parent.id);
      close();
      return;
    }
    if (!title.trim()) return;
    if (editor.mode === 'rename') await renameNode(editor.node.id, title);
    else {
      await addNode(editor.parent?.id ?? null, editor.kind, title, editor.kind === 'area' ? color : undefined, editor.kind === 'area' ? icon : undefined);
      onAdded(editor.parent?.id ?? null);
    }
    close();
  };

  return (
    <Sheet open onClose={close} title={isRename ? 'Переименовать' : presets.length ? 'Новый навык' : `Новое: ${KIND_LABEL[editor.kind]}`}>
      <form class="stack-12" onSubmit={submit}>
        {!isRename && editor.parent && <p class="muted small">Внутри: {presets.length ? w.pathOf(editor.parent.id).map((n) => n.title).join(' › ') : editor.parent.title}</p>}
        {presets.length > 0 && (
          <div class="stack-8">
            <span class="section-label">Готовые · {area!.title}</span>
            {shown.map((p) => {
              const exists = has(p);
              const on = preset === p;
              const n = goalCount(p);
              return (
                <button type="button" key={p.key} class={on ? 'preset on' : 'preset'} disabled={exists} aria-pressed={on}
                  onClick={() => { setPreset(on ? null : p); setTitle(''); }}>
                  <span class="preset-top">
                    <span class="stack-4">
                      <span class="strong">{p.title}</span>
                      <span class="muted small">
                        {p.stages.length} {plural(p.stages.length, 'ступень', 'ступени', 'ступеней')} · {n} {plural(n, 'цель', 'цели', 'целей')}{p.metric ? ` · замер «${p.metric.title}»` : ''}
                      </span>
                    </span>
                    {exists ? <span class="tpl-have">уже есть</span> : <span class={on ? 'radio on' : 'radio'} />}
                  </span>
                  {on && (
                    <span class="preset-stages">
                      {p.stages.map((st) => (
                        <span key={st.stage} class="small"><b class="tpl-gold">Ст. {st.stage}{st.boss ? ' · контрольная' : ''}</b> · {st.goals.map((g) => g.title).join(', ')}</span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
            {!allPresets && sorted.length > 3 && <button type="button" class="link small" onClick={() => setAllPresets(true)}>Ещё готовые для «{area!.title}» ▾</button>}
            <span class="section-label">Или свой</span>
          </div>
        )}
        <input id="node-title" class="input" placeholder={presets.length ? 'Название своего навыка' : 'Название'} value={title}
          onInput={(e) => { setTitle(e.currentTarget.value); if (e.currentTarget.value) setPreset(null); }} autoFocus={!presets.length} />
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
        {!isRename && editor.kind === 'skill' && !preset && <p class="muted small">Цели навыка добавишь на его странице.</p>}
        <button type="submit" class="btn primary" disabled={!title.trim() && !preset}>
          {isRename ? 'Сохранить' : preset ? `Добавить «${preset.title}» · ${goalCount(preset)} ${plural(goalCount(preset), 'цель', 'цели', 'целей')}` : title.trim() && presets.length ? `Добавить «${title.trim()}»` : 'Добавить'}
        </button>
      </form>
    </Sheet>
  );
}
