// Тренировка подходами: «вес × повторы», + подход, «как в прошлый раз».
// Макет: холст, страница «Упрощение», экран 3.
import { useState } from 'preact/hooks';
import type { Metric } from '../db/db';
import { bestSet, type WorkSet } from '../engine/metrics';
import { Icon } from './Icon';
import { NumPad, fmtInput, numFrom } from './NumPad';

type Field = { i: number; key: 'w' | 'r' };

export const setsText = (sets: WorkSet[]) => sets.map((s) => (s.w !== undefined ? `${fmtInput(s.w)}×${s.r > 0 ? s.r : '—'}` : `${s.r}`)).join(' · ');

export function SetsEditor({ metric, sets, setSets, lastSets, recordHint }: {
  metric: Metric;
  sets: WorkSet[];
  setSets: (s: WorkSet[]) => void;
  /** Подходы прошлой тренировки — для «как в прошлый раз». */
  lastSets?: WorkSet[];
  /** Текст под подходами, если лучший подход — рекорд. */
  recordHint?: string | null;
}) {
  const weighted = !!metric.hasReps;
  const [field, setField] = useState<Field | null>(null);
  const [draft, setDraft] = useState('');
  const best = bestSet(sets);

  const open = (f: Field) => {
    setField(f);
    const v = sets[f.i]?.[f.key];
    setDraft(v === undefined ? '' : fmtInput(v));
  };
  const commit = (list = sets) => {
    if (!field) return list;
    const n = numFrom(draft);
    const next = list.map((s, i) => (i === field.i ? { ...s, [field.key]: n ?? (field.key === 'r' ? 0 : undefined) } : s));
    setSets(next);
    return next;
  };
  const addSet = (list = sets) => {
    const prev = list[list.length - 1];
    const next = [...list, prev ? { ...prev } : weighted ? { w: lastSets?.[0]?.w, r: 0 } : { r: 0 }];
    setSets(next);
    return next;
  };
  // «Дальше»: вес → повторы того же подхода; повторы → следующий подход (последний — копируется).
  const next = () => {
    const list = commit();
    if (!field) return;
    if (field.key === 'w') return open({ i: field.i, key: 'r' });
    const target = field.i + 1;
    const l2 = target < list.length ? list : addSet(list);
    setField({ i: target, key: 'r' });
    setDraft(fmtInput(l2[target].r));
  };

  const isLast = field ? field.i === sets.length - 1 : false;
  const doneLabel = field?.key === 'w' ? 'Дальше → повторы' : isLast ? `Дальше → подход ${sets.length + 1}` : `Дальше → подход ${(field?.i ?? 0) + 2}`;

  return (
    <div class="sets">
      <div class="spread">
        <span class="section-label sets-label">Подходы</span>
        {lastSets?.length ? <span class="muted small strong">прошлый раз: {setsText(lastSets)}</span> : null}
      </div>
      {sets.map((s, i) => {
        const isBest = best === s && sets.length > 1;
        return (
          <div class="set-row" key={i}>
            <span class={isBest ? 'set-n best' : 'set-n'}>{i + 1}</span>
            {weighted && (
              <>
                <button type="button" class={field?.i === i && field.key === 'w' ? 'set-cell on' : 'set-cell'} onClick={() => open({ i, key: 'w' })} aria-label={`Подход ${i + 1}, вес`}>
                  <span class="set-num">{s.w !== undefined ? fmtInput(s.w) : '—'}</span><span class="set-unit">{metric.unit}</span>
                </button>
                <span class="set-x">×</span>
              </>
            )}
            <button type="button" class={field?.i === i && field.key === 'r' ? 'set-cell on' : 'set-cell'} onClick={() => open({ i, key: 'r' })} aria-label={`Подход ${i + 1}, повторы`}>
              <span class="set-num">{s.r || '—'}</span><span class="set-unit">{weighted ? 'повт' : metric.unit}</span>
            </button>
            <button type="button" class="icon-btn" aria-label={`Убрать подход ${i + 1}`} onClick={() => setSets(sets.filter((_, j) => j !== i))}><Icon name="x" size={16} stroke={2.4} /></button>
          </div>
        );
      })}
      <div class="grid-2">
        <button type="button" class="set-add" onClick={() => addSet()}>+ подход{sets.length ? ` (как ${sets.length}-й)` : ''}</button>
        <button type="button" class="set-again" disabled={!lastSets?.length} onClick={() => lastSets && setSets(lastSets.map((x) => ({ ...x })))}>↺ как в прошлый раз</button>
      </div>
      {recordHint && <div class="record-hint"><Icon name="star" size={16} stroke={2.2} />{recordHint}</div>}

      {field && (
        <NumPad
          label={`Подход ${field.i + 1} · ${field.key === 'w' ? `вес, ${metric.unit}` : 'повторы'}`}
          value={draft}
          onChange={setDraft}
          step={field.key === 'w' ? 2.5 : 1}
          decimal={field.key === 'w'}
          doneLabel={doneLabel}
          onDone={next}
          onClose={() => { commit(); setField(null); }}
        />
      )}
    </div>
  );
}
