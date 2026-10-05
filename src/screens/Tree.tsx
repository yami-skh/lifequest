import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import type { Node, NodeKind } from '../db/db';
import { addNode, addPresetSkill, deleteNode, moveNode, moveOrder, renameNode, setArchived, setAreaStyle, toggleFocus } from '../db/actions';
import { AREA_COLORS } from '../db/seed';
import { AREA_ICONS } from '../db/db';
import { go } from '../lib/router';
import { Icon } from '../components/Icon';
import { AreaTile, Confirm, Ring, Sheet, pctText } from '../components/ui';
import { plural } from './Character';
import { ac } from '../lib/theme';
import { StarMap } from '../components/StarMap';
import { StarMap3D } from '../components/StarMap3D';
import { TemplatesSheet } from '../components/Templates';
import { presetsFor } from '../data/presets';
import type { TplSkill } from '../engine/templates';
import { areaSummary, skillRow } from '../engine/treeRow';
import { FILTERS, matchesFilter, moveTargets, type TreeFilter } from '../engine/treeOps';
import { gestures } from '../lib/gestures';
import { SuggestInput } from '../components/SuggestInput';
import { items as suggestItems } from '../engine/suggest';
import { AREA_IDEAS, branchIdeas, skillIdeasFor } from '../data/suggest';
import { toast } from '../lib/toast';
import type { EntryPreset } from './EntrySheet';

type Editor =
  | { mode: 'menu'; node: Node }
  | { mode: 'add'; parent: Node | null; kind: NodeKind }
  | { mode: 'rename'; node: Node }
  | { mode: 'move'; node: Node }
  | { mode: 'style'; node: Node };

const loadExpanded = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem('lq.expanded') ?? '[]');
  } catch {
    return [];
  }
};

export function Tree({ focusId, onAdd }: { focusId?: string; onAdd?: (p: EntryPreset) => void }) {
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
  const [help, setHelp] = useState(false);
  const [filter, setFilter] = useState<TreeFilter | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [holdHint, setHoldHint] = useState(() => {
    try {
      return localStorage.getItem('lq.holdHint') !== 'seen';
    } catch {
      return false;
    }
  });
  const hideHoldHint = () => {
    setHoldHint(false);
    try {
      localStorage.setItem('lq.holdHint', 'seen');
    } catch {
      /* не критично */
    }
  };
  /** Удержание: быстрое меню (макет «Дерево: удержание»). Первое удержание прячет совет. */
  const openMenu = (n: Node) => {
    hideHoldHint();
    setEditor({ mode: 'menu', node: n });
  };
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
    return q ? w.nodes.filter((n) => !n.archived && n.title.toLowerCase().includes(q)) : null;
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

  // В «Понятном дереве» «+ навык / + ветка» — только у пустой ветки; в остальных — через «···» или удержание.
  const renderChildren = (n: Node) => (
    <div class="t-rail">
      {(w.children.get(n.id) ?? []).map(renderNode)}
      {(!clear || (w.children.get(n.id) ?? []).length === 0) && <div class="t-item t-add">
        <button type="button" class="link small" onClick={() => setEditor({ mode: 'add', parent: n, kind: 'skill' })}>+ навык</button>
        <button type="button" class="link small" onClick={() => setEditor({ mode: 'add', parent: n, kind: 'branch' })}>+ ветка</button>
      </div>}
    </div>
  );

  // «Понятное дерево» (эксперимент tree-clear): главный счёт — этап (engine/treeRow.ts).
  const clear = w.hasExp('tree-clear');
  const rowOf = (n: Node) => {
    const stages = w.stagesOfSkill(n.id);
    const cur = stages.find((s) => s.done < s.goals.length);
    return skillRow({
      // Нужный навык в архиве — так и пишем, иначе его не найти в дереве.
      lockedBy: w.lockReasons(n).map((l) => (l.node.archived ? `${l.node.title} (в архиве)` : l.node.title)),
      explored: w.explored(n.id),
      rustDays: w.rustDays(n.id),
      focus: !!n.focus,
      stages: stages.map((s) => ({ done: s.done, total: s.goals.length })),
      nextGoal: cur?.goals.find((g) => !g.done)?.title,
      firstGoal: stages[0]?.goals[0]?.title,
    });
  };
  const summaryOf = (n: Node) => areaSummary(skillsIn(n).map((s) => ({ title: s.title, view: rowOf(s) })));
  const headSummary = () => {
    const views = w.skills.map(rowOf);
    const work = views.filter((v) => v.stage !== null && v.state !== 'mastered').length;
    const done = views.filter((v) => v.state === 'mastered').length;
    return [work && `${work} в работе`, done && `${done} ${plural(done, 'освоен', 'освоено', 'освоено')}`, `${w.skills.length} ${plural(w.skills.length, 'навык', 'навыка', 'навыков')}`].filter(Boolean).join(' · ');
  };

  const renderSkillClear = (n: Node) => {
    const v = rowOf(n);
    const tile = v.state === 'locked' ? <Icon name="lock" size={16} />
      : v.state === 'new' ? <span class="t2-q">?</span>
      : v.state === 'mastered' ? <Icon name="crown" size={18} />
      : v.stage !== null ? <><span class="t2-tile-k">этап</span><span class="t2-tile-n">{v.stage}</span></>
      : <Icon name="sprout" size={16} />;
    return (
      <div class={`t-item t2-skill ${v.state}`} key={n.id}>
        <span class="t2-swipe">
        <span class="t2-swipe-hint add"><Icon name="plus" size={18} stroke={2.6} />действие</span>
        <span class="t2-swipe-hint menu">меню<Icon name="dots" size={18} stroke={3} /></span>
        <a class="t2-card" href={`#/skill/${n.id}`} {...gestures({ onHold: () => openMenu(n), onSwipeRight: onAdd && v.state !== 'locked' ? () => onAdd({ skillId: n.id }) : undefined, onSwipeLeft: () => openMenu(n) })}>
          <span class="t2-tile">{tile}</span>
          <span class="t2-body">
            <span class="t2-top"><span class="t2-title">{n.title}</span><span class="t2-right">{v.right}</span></span>
            {v.bar && <span class="t2-bar"><span class="mini-bar"><span style={{ width: `${(v.bar.done / Math.max(1, v.bar.total)) * 100}%` }} /></span><span class="t2-count">{v.bar.done}/{v.bar.total} {plural(v.bar.total, 'цель', 'цели', 'целей')}</span></span>}
            {v.line && <span class="t2-line">{v.state === 'final' && <Icon name="sword" size={13} />}{v.line}</span>}
          </span>
        </a>
        </span>
        {menuBtn(n)}
      </div>
    );
  };

  // Фильтры — только когда навыков много (иначе это шум; дерево — карта, а не таблица).
  const FILTER_FROM = 8;
  const filtered = () => (filter ? w.skills.filter((s) => matchesFilter(filter, rowOf(s).state)) : []);
  const filterChips = () => {
    if (w.skills.length < FILTER_FROM) return null;
    const states = w.skills.map((s) => rowOf(s).state);
    const chips = FILTERS.map((f) => ({ ...f, n: states.filter((s) => matchesFilter(f.id, s)).length })).filter((f) => f.n > 0);
    return (
      <div class="chips scroll-x t2-filters" role="group" aria-label="Показать">
        <button type="button" class={filter ? 'chip big' : 'chip big primary'} aria-pressed={!filter} onClick={() => setFilter(null)}>Все</button>
        {chips.map((f) => (
          <button type="button" key={f.id} class={filter === f.id ? 'chip big primary' : 'chip big'} aria-pressed={filter === f.id} onClick={() => setFilter(filter === f.id ? null : f.id)}>{f.label} {f.n}</button>
        ))}
      </div>
    );
  };

  const renderNode = (n: Node) => {
    const p = w.progress.get(n.id);
    const open = expanded.has(n.id);

    if (n.kind === 'skill' && clear) return renderSkillClear(n);
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
            <button type="button" class="t-branch-btn" onClick={() => toggle(n.id)} aria-expanded={open} {...(clear ? gestures({ onHold: () => openMenu(n) }) : {})}>
              <span class={open ? 't-diamond open' : 't-diamond'} />
              <span class="t-branch-title">{n.title}</span>
              <span class="t-sub">{clear ? (count ? `· ${count} ${plural(count, 'навык', 'навыка', 'навыков')}` : 'пусто') : count ? `${pctText(p)} · ${count} нав.` : 'пусто'}</span>
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
          <button type="button" class="t-area-btn" onClick={() => toggle(n.id)} aria-expanded={open} {...(clear ? gestures({ onHold: () => openMenu(n) }) : {})}>
            <AreaTile node={n} size={44} />
            <span class="t-area-text">
              <span class="t-area-title">{n.title}</span>
              <span class="t-sub">{clear ? summaryOf(n) : `${count} ${plural(count, 'навык', 'навыка', 'навыков')} · ${explored} исследовано`}</span>
            </span>
            {clear ? <Icon name={open ? 'up' : 'down'} size={18} /> : (
              <Ring pct={p ?? 0} size={46} stroke={4} color="var(--c)">
                <span class="t-ring-pct">{p === null || p === undefined ? '—' : `${Math.round(p)}%`}</span>
              </Ring>
            )}
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
          <span class="t-sub">{clear ? headSummary() : `исследовано ${exploredTotal} из ${w.skills.length}`}</span>
        </div>
        <div class="tree-head-btns">
          {clear && <button type="button" class="icon-btn round" aria-label="Как читать дерево" title="Как читать дерево" onClick={() => setHelp(true)}><span class="t2-help">?</span></button>}
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

      {mode === 'stars' ? (w.hasExp('stars-3d') ? <StarMap3D /> : <StarMap />) : <>

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
      ) : clear ? (
        <>
          {holdHint && w.skills.length > 0 && (
            <div class="t2-hint"><Icon name="spark" size={18} /><span><b>Совет:</b> удержи навык или ветку — откроются быстрые действия. Свайп по навыку вправо — новое действие.</span>
              <button type="button" class="icon-btn" aria-label="Скрыть совет" onClick={hideHoldHint}><Icon name="x" size={18} /></button></div>
          )}
          {filterChips()}
          {filter ? (
            <div class="t-tree t2-filtered">
              {filtered().map((n) => (
                <div class="stack-4" key={n.id} style={{ '--c': ac(w.areaOf(n.id)?.color) ?? 'var(--muted)' }}>
                  <span class="muted small t2-path">{w.pathOf(n.id).slice(0, -1).map((x) => x.title).join(' › ')}</span>
                  {renderSkillClear(n)}
                </div>
              ))}
              {filtered().length === 0 && <p class="muted">Таких навыков нет.</p>}
            </div>
          ) : (
            <div class="t-tree">{w.areas.map(renderNode)}</div>
          )}
          {w.archived.length > 0 && (
            <section class="stack-8 t2-archive">
              <button type="button" class="section-label t2-archive-btn" aria-expanded={archiveOpen} onClick={() => setArchiveOpen(!archiveOpen)}>
                <span>Архив · {w.archived.length}</span><Icon name={archiveOpen ? 'up' : 'down'} size={16} />
              </button>
              {archiveOpen && w.archived.map((n) => (
                <div class="t2-arch-row" key={n.id}>
                  <a class="stack-4 t2-arch-text" href={`#/skill/${n.id}`}><span class="strong">{n.title}</span><span class="muted small">{w.pathOf(n.id).slice(0, -1).map((x) => x.title).join(' › ')} · {w.xpBySkill.get(n.id) ?? 0} XP</span></a>
                  <button type="button" class="btn ghost small" onClick={async () => { await setArchived(n.id, false); toast({ kind: 'info', title: `«${n.title}» вернулся в дерево` }); }}>Вернуть</button>
                </div>
              ))}
              {archiveOpen && <span class="muted small">Навыки в архиве не видны в дереве и при выборе навыка. Цели, действия и XP сохранены.</span>}
            </section>
          )}
        </>
      ) : (
        <div class="t-tree">{w.areas.map(renderNode)}</div>
      )}
      </>}

      <TemplatesSheet open={tplOpen} onClose={() => setTplOpen(false)} />
      {help && <TreeHelp onClose={() => setHelp(false)} />}

      <NodeEditor editor={editor} onClose={() => setEditor(null)} onDelete={(n) => { setEditor(null); setToDelete(n); }} onAdded={(parentId) => {
        if (parentId && !expanded.has(parentId)) toggle(parentId);
      }} setEditor={setEditor} onAdd={onAdd} />

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

/** «Перенести…»: куда — любое направление или ветка (кроме себя и своих потомков). Макет: HoldMove. */
function MoveSheet({ node, onClose, onMoved }: { node: Node; onClose: () => void; onMoved: (parentId: string | null) => void }) {
  const w = useWorld();
  const [q, setQ] = useState('');
  const [to, setTo] = useState<string | null>(null);
  const targets = moveTargets(w.nodes.filter((n) => !n.archived), node.id);
  const shown = q.trim() ? targets.filter((t) => t.path.toLowerCase().includes(q.trim().toLowerCase())) : targets;
  const dest = targets.find((t) => t.id === to);
  const move = async () => {
    if (!to) return;
    try {
      await moveNode(node.id, to);
      onMoved(to);
      onClose();
      toast({ kind: 'info', title: `«${node.title}» → ${dest?.path}` });
    } catch (e) {
      toast({ kind: 'info', title: e instanceof Error ? e.message : 'Не получилось перенести' });
    }
  };
  return (
    <Sheet open onClose={onClose} title={`Перенести «${node.title}»`}>
      <span class="muted small">Выбери направление или ветку.</span>
      {targets.length > 8 && (
        <label class="search">
          <Icon name="search" size={18} />
          <input placeholder="Найти ветку" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Найти ветку" />
        </label>
      )}
      <div class="stack-4 t2-move" role="radiogroup" aria-label="Куда перенести">
        {shown.map((t) => (
          <button type="button" key={t.id} role="radio" aria-checked={to === t.id} disabled={t.current}
            class={`t2-dest${to === t.id ? ' on' : ''}${t.depth === 0 ? ' area' : ''}`} style={{ paddingLeft: `${12 + t.depth * 18}px` }}
            onClick={() => setTo(t.id)}>
            <span class={to === t.id ? 'radio on' : 'radio'} />
            <span class="t2-dest-title">{t.path.split(' › ').pop()}</span>
            {t.current && <span class="muted small">сейчас тут</span>}
          </button>
        ))}
        {shown.length === 0 && <p class="muted">Ничего не нашлось.</p>}
      </div>
      <div class="ai-privacy"><Icon name="repeat" size={18} /><span>{node.kind === 'skill' ? 'Переедут цели, этапы, замеры, действия и XP.' : 'Ветка переедет со всем, что внутри.'} Требования других навыков к нему сохранятся.</span></div>
      <button type="button" class="btn primary" disabled={!to} onClick={move}>{dest ? `Перенести в «${dest.path}»` : 'Выбери, куда'}</button>
    </Sheet>
  );
}

/** «Как читать дерево» — словами плана (путь, этап, цель, уровень), без формул. Макет: TreeLegend. */
function TreeHelp({ onClose }: { onClose: () => void }) {
  const terms: [string, string][] = [
    ['Навык — твой путь', 'Например «Отжимания» или «Python». Путь разбит на этапы.'],
    ['Этап', 'Несколько целей. Закрыл все — этап пройден, открывается следующий. Номер этапа — на плитке навыка.'],
    ['Цель', 'Конкретный результат: «30 отжиманий подряд». Полоска — сколько целей этапа уже закрыто.'],
    ['Уровень', 'Растёт от XP за действия — смотри внутри навыка и у персонажа.'],
  ];
  const marks: [string, ComponentChildren, string, string][] = [
    ['active', <><span class="t2-tile-k">этап</span><span class="t2-tile-n">2</span></>, 'Сейчас качаешь', 'золотая рамка; под названием — что сделать дальше'],
    ['new', <span class="t2-q">?</span>, 'Не начат', 'первое действие откроет путь'],
    ['locked', <Icon name="lock" size={16} />, 'Закрыт', 'откроется, когда подкачаешь другой навык — какой, видно внутри'],
    ['rust', <><span class="t2-tile-k">этап</span><span class="t2-tile-n">1</span></>, 'Давно не занимался', 'прогресс цел — просто вернись'],
    ['mastered', <Icon name="crown" size={18} />, 'Освоен', 'все этапы пройдены'],
    ['final', <Icon name="sword" size={16} />, 'Финальный этап', 'контрольное задание пути'],
  ];
  return (
    <Sheet open onClose={onClose} title="Как читать дерево">
      <div class="card stack-12">
        {terms.map(([t, s]) => <span class="stack-4" key={t}><span class="strong">{t}</span><span class="muted small">{s}</span></span>)}
      </div>
      <span class="section-label">Значки</span>
      <div class="card stack-12">
        {marks.map(([cls, tile, t, s]) => (
          <span class={`t2-skill ${cls} t2-legend`} key={t}>
            <span class="t2-tile">{tile}</span>
            <span class="stack-4"><span class="strong">{t}</span><span class="muted small">{s}</span></span>
          </span>
        ))}
      </div>
    </Sheet>
  );
}

function NodeEditor({ editor, onClose, onDelete, onAdded, setEditor, onAdd }: {
  editor: Editor | null;
  onClose: () => void;
  onDelete: (n: Node) => void;
  onAdded: (parentId: string | null) => void;
  setEditor: (e: Editor) => void;
  onAdd?: (p: EntryPreset) => void;
}) {
  const w = useWorld();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(AREA_COLORS[0]);
  const [icon, setIcon] = useState(AREA_ICONS[0]);
  const [preset, setPreset] = useState<TplSkill | null>(null);
  const [allPresets, setAllPresets] = useState(false);

  if (!editor) return null;

  if (editor.mode === 'move') return <MoveSheet node={editor.node} onClose={onClose} onMoved={onAdded} />;

  // Быстрое меню «Понятного дерева» (удержание, свайп влево, «···»). Макет: «Дерево: удержание».
  if (editor.mode === 'menu' && w.hasExp('tree-clear')) {
    const n = editor.node;
    const where = w.pathOf(n.id).slice(0, -1).map((x) => x.title).join(' › ');
    const focusCount = w.focusSkills.length;
    const locked = n.kind === 'skill' && w.lockReasons(n).length > 0;
    const order = async (dir: -1 | 1) => {
      if (!(await moveOrder(n.id, dir))) toast({ kind: 'info', title: dir < 0 ? 'Выше некуда' : 'Ниже некуда' });
    };
    return (
      <Sheet open onClose={onClose} title={n.title}>
        {where && <span class="muted small t2-menu-where">{where}</span>}
        <div class="stack-8">
          {n.kind === 'skill' && onAdd && !locked && (
            <button type="button" class="btn primary" onClick={() => { onClose(); onAdd({ skillId: n.id }); }}><Icon name="plus" size={18} stroke={2.6} />Действие по навыку</button>
          )}
          {n.kind !== 'skill' && (
            <>
              <button type="button" class="menu-item" onClick={() => { setTitle(''); setEditor({ mode: 'add', parent: n, kind: 'skill' }); }}><Icon name="plus" />Добавить навык</button>
              <button type="button" class="menu-item" onClick={() => { setTitle(''); setEditor({ mode: 'add', parent: n, kind: 'branch' }); }}><Icon name="tree" />Добавить ветку внутрь</button>
            </>
          )}
          {n.kind === 'skill' && (
            <button type="button" class="menu-item" onClick={async () => {
              const ok = await toggleFocus(n.id);
              if (!ok) toast({ kind: 'info', title: 'Активных уже 3', sub: 'Сначала убери один из активных' });
              else onClose();
            }}>
              <Icon name="star" />{n.focus ? 'Убрать из активных' : 'Сделать активным'}<span class="menu-meta">{focusCount} из 3</span>
            </button>
          )}
          {n.kind !== 'area' && <button type="button" class="menu-item" onClick={() => setEditor({ mode: 'move', node: n })}><Icon name="repeat" />Перенести…</button>}
          <div class="row-2">
            <button type="button" class="menu-item" onClick={() => order(-1)}><Icon name="up" />Выше</button>
            <button type="button" class="menu-item" onClick={() => order(1)}><Icon name="down" />Ниже</button>
          </div>
          {n.kind === 'area' && (
            <button type="button" class="menu-item" onClick={() => { setColor(n.color ?? AREA_COLORS[0]); setIcon(n.icon ?? AREA_ICONS[0]); setEditor({ mode: 'style', node: n }); }}><Icon name="brush" />Цвет и иконка</button>
          )}
          {n.kind === 'skill' && <a class="menu-item" href={`#/skill/${n.id}`} onClick={onClose}><Icon name="right" />Открыть навык</a>}
          <button type="button" class="menu-item" onClick={() => { setTitle(n.title); setEditor({ mode: 'rename', node: n }); }}><Icon name="edit" />Переименовать</button>
          {n.kind === 'skill' && (
            <button type="button" class="menu-item" onClick={async () => {
              await setArchived(n.id, true);
              onClose();
              toast({ kind: 'info', title: `«${n.title}» в архиве`, sub: 'Дерево → Архив внизу. Цели и XP сохранены.' });
            }}><Icon name="download" />В архив</button>
          )}
          <button type="button" class="menu-item danger-text" onClick={() => onDelete(n)}><Icon name="trash" />Удалить</button>
        </div>
      </Sheet>
    );
  }

  if (editor.mode === 'style') {
    const n = editor.node;
    return (
      <Sheet open onClose={onClose} title={`Цвет и иконка: ${n.title}`}>
        <div class="stack-12">
          <div class="colors" role="radiogroup" aria-label="Цвет направления">
            {AREA_COLORS.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} class={color === c ? 'color on' : 'color'} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <div class="icons" role="radiogroup" aria-label="Иконка направления">
            {AREA_ICONS.map((ic) => (
              <button type="button" key={ic} role="radio" aria-checked={icon === ic} aria-label={ic} class={icon === ic ? 'icon-pick on' : 'icon-pick'} style={{ color }} onClick={() => setIcon(ic)}>
                <Icon name={ic} size={22} />
              </button>
            ))}
          </div>
          <button type="button" class="btn primary" onClick={async () => { await setAreaStyle(n.id, color, icon); onClose(); }}>Сохранить</button>
        </div>
      </Sheet>
    );
  }

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
  // Подсказки названия (data/suggest.ts): направления / ветки этого направления / навыки (сначала этого направления).
  const kindNow: NodeKind = editor.mode === 'add' ? editor.kind : editor.node.kind;
  const areaTitle = editor.mode === 'add' ? (editor.parent ? w.areaOf(editor.parent.id)?.title : undefined) : w.areaOf(editor.node.id)?.title;
  const titleIdeas = suggestItems({ idea: kindNow === 'area' ? AREA_IDEAS : kindNow === 'branch' ? branchIdeas(areaTitle) : skillIdeasFor(areaTitle) });
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
        <SuggestInput id="node-title" placeholder={presets.length ? 'Название своего навыка' : 'Название'} value={title}
          onValue={(v) => { setTitle(v); if (v) setPreset(null); }} autoFocus={!presets.length}
          items={titleIdeas} exclude={w.nodes.filter((n) => n.kind === kindNow).map((n) => n.title)} />
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
