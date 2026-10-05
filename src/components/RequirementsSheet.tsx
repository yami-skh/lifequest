// Настройка требований навыка. ARCHITECTURE.md §16, идея 4.
import { useMemo, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import type { Node, Requirement } from '../db/db';
import { setRequirements } from '../db/actions';
import { Icon } from './Icon';
import { Check, Sheet } from './ui';

const PRESETS = { progress: [25, 50, 75, 100], level: [1, 2, 3, 5] };

export function RequirementsSheet({ node, onClose }: { node: Node; onClose: () => void }) {
  const w = useWorld();
  const reqs = w.requirementsOf(node);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<Node | null>(null);
  const [mode, setMode] = useState<'progress' | 'level'>('progress');
  const [value, setValue] = useState(50);

  // Нельзя требовать сам себя и то, что зависит от этого навыка (иначе замкнутый круг).
  const banned = useMemo(() => {
    const out = new Set<string>([node.id]);
    const stack = [node.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const n of w.unlocksOf(id)) if (!out.has(n.id)) { out.add(n.id); stack.push(n.id); }
    }
    for (const r of node.requires ?? []) out.add(r.nodeId);
    return out;
  }, [w, node]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return w.nodes.filter((n) => n.kind !== 'area' && !banned.has(n.id) && n.title.toLowerCase().includes(q)).slice(0, 12);
  }, [query, w.nodes, banned]);

  const switchMode = (m: 'progress' | 'level') => {
    setMode(m);
    setValue(m === 'progress' ? 50 : 3);
  };
  const step = mode === 'progress' ? 5 : 1;
  const max = mode === 'progress' ? 100 : 10;

  const add = async () => {
    if (!target) return;
    const r: Requirement = mode === 'progress' ? { nodeId: target.id, minProgress: value } : { nodeId: target.id, minLevel: value };
    await setRequirements(node.id, [...(node.requires ?? []), r]);
    setTarget(null);
    setQuery('');
  };
  const remove = (index: number) => setRequirements(node.id, (node.requires ?? []).filter((_, i) => i !== index));

  return (
    <Sheet open onClose={onClose} title="Требования">
      <p class="muted small">«{node.title}» откроется, когда выполнены <b>все</b> условия. Записывать действия можно и до этого.</p>

      <div class="stack-8">
        {reqs.length === 0 && <p class="small fg-2">Условий нет — навык открыт сразу.</p>}
        {reqs.map((r) => (
          <div class="req-row" key={r.index}>
            <Check done={r.met} />
            <span class="req-row-body">
              <span class="strong">{r.node.title} — {r.need}</span>
              {r.met ? (
                <span class="small ok-text">выполнено</span>
              ) : (
                <span class="req-progress"><span class="mini-bar"><span style={{ width: `${r.ratio * 100}%`, background: 'var(--gold)' }} /></span><span class="muted small strong">{r.have} / {r.need}</span></span>
              )}
            </span>
            <button type="button" class="icon-btn" aria-label={`Убрать условие ${r.node.title}`} onClick={() => remove(r.index)}><Icon name="trash" size={18} /></button>
          </div>
        ))}
      </div>

      <div class="new-req">
        <span class="section-label">Новое условие</span>
        {target ? (
          <div class="chips">
            <span class="chip big primary">
              <span class="chip-btn">{target.title}</span>
              <button type="button" class="chip-x" aria-label="Выбрать другой" onClick={() => setTarget(null)}><Icon name="x" size={14} stroke={3} /></button>
            </span>
          </div>
        ) : (
          <div class="picker">
            <label class="search">
              <Icon name="search" size={18} />
              <input id="req-search" placeholder="Выбрать навык или ветку" value={query} onInput={(e) => setQuery(e.currentTarget.value)} aria-label="Выбрать навык или ветку" />
            </label>
            {results.length > 0 && (
              <div class="picker-list">
                {results.map((n) => (
                  <button type="button" key={n.id} class="picker-item" onClick={() => { setTarget(n); if (n.kind !== 'skill') switchMode('progress'); }}>
                    <span>{n.title}</span>
                    <span class="muted small">{n.kind === 'branch' ? 'ветка · ' : ''}{w.pathOf(n.id).slice(0, -1).map((x) => x.title).join(' › ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div class="segmented">
          <button type="button" class={mode === 'progress' ? 'on' : ''} onClick={() => switchMode('progress')}>Прогресс, %</button>
          <button type="button" class={mode === 'level' ? 'on' : ''} disabled={target?.kind === 'branch'} onClick={() => switchMode('level')}>Уровень</button>
        </div>
        <div class="stepper">
          <button type="button" class="btn ghost square" aria-label="Меньше" onClick={() => setValue(Math.max(step, value - step))}>−</button>
          <span class="stepper-value">{mode === 'progress' ? `${value}%` : `ур. ${value}`}</span>
          <button type="button" class="btn ghost square" aria-label="Больше" onClick={() => setValue(Math.min(max, value + step))}>+</button>
        </div>
        <div class="chips">
          {PRESETS[mode].map((v) => (
            <button type="button" key={v} class={value === v ? 'chip big primary' : 'chip big'} onClick={() => setValue(v)}>{mode === 'progress' ? `${v}%` : `ур. ${v}`}</button>
          ))}
        </div>
      </div>

      <button type="button" class="btn primary" disabled={!target} onClick={add}>{target ? 'Добавить условие' : 'Сначала выбери навык'}</button>
    </Sheet>
  );
}
