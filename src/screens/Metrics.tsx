// Замеры и рубежи. Макет: холст, страница «Замеры и рубежи». ARCHITECTURE.md §8.
import { useRef, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import type { Metric } from '../db/db';
import { addMetric, addMetricValue, deleteMetric, deleteMetricValue, fmtNum, removeMilestone, setMilestone, type PhotoDraft } from '../db/actions';
import { addDays, humanDate, localDate } from '../engine/dates';
import { isRecord, MILESTONE_XP, RECORD_XP } from '../engine/metrics';
import { compressPhoto, useBlobUrl } from '../lib/photo';
import { toast } from '../lib/toast';
import { go } from '../lib/router';
import { Icon } from '../components/Icon';
import { Confirm, ProgressBar, SectionLabel, Sheet, TopBar } from '../components/ui';

type Info = ReturnType<ReturnType<typeof useWorld>['metricInfo']>;

export const metricToasts = (m: Metric, r: { record: boolean; milestone: unknown }, value: number, reps?: number) => {
  if (r.record) toast({ kind: 'achievement', title: 'Новый рекорд!', sub: `${m.title} ${fmtNum(value)} ${m.unit}${reps ? ` × ${reps}` : ''} · +${RECORD_XP} XP` });
  if (r.milestone) toast({ kind: 'achievement', title: 'Рубеж взят!', sub: `${m.title} · +${MILESTONE_XP} XP` });
};

function Sparkline({ info }: { info: Info }) {
  const vals = info.values.slice(-8);
  if (vals.length < 2) return <span class="spark-empty" />;
  const min = Math.min(...vals.map((v) => v.value));
  const max = Math.max(...vals.map((v) => v.value));
  const span = max - min || 1;
  const pts = vals.map((v, i) => [2 + (i * 74) / (vals.length - 1), 28 - ((v.value - min) / span) * 24]);
  const last = pts[pts.length - 1];
  return (
    <svg width="80" height="32" viewBox="0 0 80 32" aria-hidden="true">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--c)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={info.last?.record ? 'var(--gold)' : 'var(--c)'} />
    </svg>
  );
}

const deltaText = (info: Info) => {
  if (info.delta === null || info.delta === 0) return null;
  const good = info.metric.better === 'up' ? info.delta > 0 : info.delta < 0;
  return { text: `${info.delta > 0 ? '+' : '−'}${fmtNum(Math.abs(info.delta))} за 30 дн`, good };
};

export function Metrics() {
  const w = useWorld();
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState<Metric | null>(null);
  const infos = w.metrics.map(w.metricInfo);
  const withMs = infos.filter((i) => i.milestone);

  const groups = new Map<string, Info[]>();
  for (const i of infos) {
    const path = i.metric.skillId ? w.pathOf(i.metric.skillId) : [];
    const key = path.length ? path.slice(0, 2).map((n) => n.title).join(' · ') : 'Без навыка';
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }

  return (
    <div class="page">
      <div class="spread">
        <h1 class="display small-display">Замеры</h1>
        <button type="button" class="icon-btn round" aria-label="Новый замер" onClick={() => setCreating(true)}><Icon name="plus" size={20} stroke={2.4} /></button>
      </div>

      {withMs.map((i) => <MilestoneCard info={i} key={i.metric.id} link />)}

      {[...groups].map(([title, list]) => (
        <section class="stack-8" key={title}>
          <SectionLabel>{title}</SectionLabel>
          {list.map((i) => {
            const d = deltaText(i);
            const color = i.metric.skillId ? w.areaOf(i.metric.skillId)?.color : undefined;
            if (!i.last) {
              return (
                <div class="metric-row empty" key={i.metric.id}>
                  <a class="metric-name" href={`#/metrics/${i.metric.id}`}><span class="strong fg-2">{i.metric.title}</span><span class="muted small">ещё нет значений</span></a>
                  <button type="button" class="link small" onClick={() => setAdding(i.metric)}>Внести</button>
                </div>
              );
            }
            return (
              <a class="metric-row" href={`#/metrics/${i.metric.id}`} key={i.metric.id} style={{ '--c': color ?? '#FF8A5B' }}>
                <span class="metric-name"><span class="strong">{i.metric.title}</span><span class="muted small">{humanDate(i.last.date)}{i.last.record ? ' · рекорд' : i.metric.better === 'down' ? ' · лучше меньше' : ''}</span></span>
                <Sparkline info={i} />
                <span class="metric-val">
                  <span class="metric-num">{fmtNum(i.last.value)} <span class="muted small">{i.metric.unit}</span></span>
                  {d && <span class={d.good ? 'small ok-text' : 'small danger-text'}>{d.text}</span>}
                </span>
              </a>
            );
          })}
        </section>
      ))}

      {creating && <NewMetricSheet onClose={() => setCreating(false)} />}
      {adding && <AddValueSheet metric={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function MilestoneCard({ info, link = false }: { info: Info; link?: boolean }) {
  const ms = info.milestone!;
  const m = info.metric;
  const late = ms.deadline && info.forecast && info.forecast > ms.deadline;
  const body = (
    <>
      <span class="spread">
        <span class="ms-title"><Icon name="target" size={18} stroke={2.2} />Рубеж: {m.title.toLowerCase()} {fmtNum(ms.target)} {m.unit}</span>
        <span class="muted small strong">{Math.round(info.milestonePct)}%</span>
      </span>
      <ProgressBar pct={info.milestonePct} color="#FF8A5B" height={8} />
      <span class="spread small muted strong"><span>старт {fmtNum(ms.start)}</span><span class="fg-2">сейчас {info.last ? fmtNum(info.last.value) : '—'}</span><span>цель {fmtNum(ms.target)}</span></span>
      <span class={late ? 'small danger-text' : info.forecast ? 'small ok-text' : 'small muted'}>
        {info.forecast
          ? `по темпу ${late ? 'не успеваешь — ' : 'успеешь '}к ${humanDate(info.forecast)}${ms.deadline ? ` · срок ${humanDate(ms.deadline)}` : ''}`
          : `прогноз появится после 3 значений за 6 недель${ms.deadline ? ` · срок ${humanDate(ms.deadline)}` : ''}`}
      </span>
    </>
  );
  return link ? <a class="ms-card" href={`#/metrics/${m.id}`}>{body}</a> : <div class="ms-card">{body}</div>;
}

/** График: значения, отметки рекордов, пунктир рубежа. */
function Chart({ info }: { info: Info }) {
  const vals = info.values.slice(-20);
  if (vals.length === 0) return <p class="muted small">Внеси первое значение — появится график.</p>;
  const target = info.milestone?.target;
  const ys = vals.map((v) => v.value).concat(target !== undefined ? [target] : []);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  min -= pad; max += pad;
  const W = 330, H = 180, L = 32, R = 14, T = 22, B = 26;
  const x = (i: number) => (vals.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (vals.length - 1));
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const ticks = [min + pad, (min + max) / 2, max - pad];
  return (
    <figure class="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`График: ${vals.map((v) => fmtNum(v.value)).join(', ')} ${info.metric.unit}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--surface-2)" />
            <text x={L - 6} y={y(t) + 4} text-anchor="end" fill="var(--muted-2)" font-size="10">{fmtNum(t)}</text>
          </g>
        ))}
        {target !== undefined && (
          <g>
            <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} stroke="#FF8A5B" stroke-width="1.5" stroke-dasharray="6 5" />
            <text x={W - R} y={y(target) - 6} text-anchor="end" fill="#FF8A5B" font-size="11" font-weight="700">рубеж {fmtNum(target)}</text>
          </g>
        )}
        {vals.length > 1 && <polyline points={vals.map((v, i) => `${x(i)},${y(v.value)}`).join(' ')} fill="none" stroke="#FF8A5B" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />}
        {vals.map((v, i) => <circle key={v.id} cx={x(i)} cy={y(v.value)} r={v.record ? 5 : 3.5} fill={v.record ? 'var(--gold)' : '#FF8A5B'} stroke={v.record ? 'var(--surface)' : 'none'} stroke-width="2" />)}
        <text x={x(0)} y={H - 6} text-anchor="start" fill="var(--muted-2)" font-size="10">{humanDate(vals[0].date)}</text>
        {vals.length > 1 && <text x={x(vals.length - 1)} y={H - 6} text-anchor="end" fill="var(--muted-2)" font-size="10">{humanDate(vals[vals.length - 1].date)}</text>}
      </svg>
    </figure>
  );
}

export function MetricDetail({ id }: { id: string }) {
  const w = useWorld();
  const m = w.metrics.find((x) => x.id === id);
  const [adding, setAdding] = useState(false);
  const [msOpen, setMsOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!m) {
    return (
      <div class="page">
        <TopBar title="Замер не найден" />
      </div>
    );
  }
  const info = w.metricInfo(m);
  const d = deltaText(info);
  const skill = m.skillId ? w.nodeById.get(m.skillId) : undefined;

  return (
    <div class="page">
      <TopBar crumbs={skill ? `Замеры · ${w.pathOf(skill.id).slice(0, -1).map((n) => n.title).join(' › ')}` : 'Замеры'} />
      <div class="stack-8">
        <h1 class="display">{m.title}</h1>
        <div class="metric-big">
          <span class="metric-big-num">{info.last ? fmtNum(info.last.value) : '—'}</span>
          <span class="muted strong">{m.unit}</span>
          {d && <span class={d.good ? 'delta-chip good' : 'delta-chip bad'}>{d.text}</span>}
        </div>
        <div class="chips">
          {info.last?.record && <span class="chip big gold-chip">Рекорд — {humanDate(info.last.date).toLowerCase()} · +{RECORD_XP} XP</span>}
          {skill && <a class="chip big" href={`#/skill/${skill.id}`}>навык: {skill.title}</a>}
          <span class="chip big">лучше {m.better === 'up' ? 'больше' : 'меньше'}</span>
        </div>
      </div>

      <Chart info={info} />

      {info.milestone && <MilestoneCard info={info} />}

      <div class="row-2">
        <button type="button" class="btn ghost" onClick={() => setMsOpen(true)}>{info.milestone ? 'Изменить рубеж' : 'Поставить рубеж'}</button>
        <button type="button" class="btn primary" onClick={() => setAdding(true)}>Внести значение</button>
      </div>

      <section class="stack-4">
        <SectionLabel>История</SectionLabel>
        {info.values.length === 0 && <p class="muted small">Значений пока нет.</p>}
        {[...info.values].reverse().map((v) => (
          <div class="history-row" key={v.id}>
            <span class="muted">{humanDate(v.date)}</span>
            <span class="strong">{fmtNum(v.value)} {m.unit}{v.reps ? ` × ${v.reps} повт.` : ''}</span>
            <span class="history-end">
              {v.record && <span class="record-tag">РЕКОРД</span>}
              <button type="button" class="icon-btn" aria-label="Удалить значение" onClick={() => deleteMetricValue(v.id)}><Icon name="trash" size={16} /></button>
            </span>
            {v.note && <span class="history-note">{v.note}</span>}
          </div>
        ))}
      </section>

      <button type="button" class="link small danger-text" onClick={() => setConfirm(true)}>Удалить замер</button>

      {adding && <AddValueSheet metric={m} onClose={() => setAdding(false)} />}
      {msOpen && <MilestoneSheet info={info} onClose={() => setMsOpen(false)} />}
      <Confirm open={confirm} title={`Удалить «${m.title}»?`} text="Пропадут все значения и рубеж. XP за рекорды останется." action="Удалить"
        onConfirm={async () => { await deleteMetric(m.id); go('metrics'); }} onClose={() => setConfirm(false)} />
    </div>
  );
}

/** Поле значения с −/+ и быстрыми кнопками. Используется и в шторке записи. */
export function ValueInput({ metric, value, setValue, reps, setReps, compact = false }: {
  metric: Metric; value: number | null; setValue: (v: number | null) => void; reps: number | null; setReps: (r: number | null) => void; compact?: boolean;
}) {
  const w = useWorld();
  const info = w.metricInfo(metric);
  const step = metric.unit === 'кг' && metric.hasReps ? 2.5 : metric.unit === 'ч' || metric.unit === 'кг' ? 0.5 : 1;
  const base = value ?? info.last?.value ?? 0;
  return (
    <div class="stack-8">
      <div class="stepper">
        <button type="button" class="btn ghost square" aria-label="Меньше" onClick={() => setValue(Math.max(0, Math.round((base - step) * 10) / 10))}>−</button>
        <input id={`val-${metric.id}`} class={compact ? 'value-input compact' : 'value-input'} inputMode="decimal" placeholder={info.last ? fmtNum(info.last.value) : '0'}
          value={value === null ? '' : fmtNum(value)} aria-label={`${metric.title}, ${metric.unit}`}
          onInput={(e) => { const n = parseFloat(e.currentTarget.value.replace(',', '.')); setValue(Number.isFinite(n) ? n : null); }} />
        <button type="button" class="btn ghost square" aria-label="Больше" onClick={() => setValue(Math.round((base + step) * 10) / 10)}>+</button>
      </div>
      {!compact && info.last && (
        <div class="chips center-chips">
          <button type="button" class="chip big" onClick={() => setValue(Math.round((info.last!.value - step) * 10) / 10)}>−{fmtNum(step)}</button>
          <button type="button" class="chip big" onClick={() => { setValue(info.last!.value); if (info.last!.reps) setReps(info.last!.reps); }}>как в прошлый раз</button>
          <button type="button" class="chip big" onClick={() => setValue(Math.round((info.last!.value + step) * 10) / 10)}>+{fmtNum(step)}</button>
        </div>
      )}
      {metric.hasReps && (
        <div class="chips">
          <span class="muted small strong reps-label">повторы:</span>
          {[3, 5, 6, 8, 10, 12].map((r) => (
            <button type="button" key={r} class={reps === r ? 'chip big primary' : 'chip big'} onClick={() => setReps(reps === r ? null : r)}>{r}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoThumb({ p, onRemove }: { p: PhotoDraft; onRemove: () => void }) {
  const url = useBlobUrl(p.thumb);
  return (
    <div class="photo-draft">
      {url && <img src={url} alt="" />}
      <button type="button" class="photo-remove" aria-label="Убрать фото" onClick={onRemove}><Icon name="x" size={14} stroke={3} /></button>
    </div>
  );
}

function AddValueSheet({ metric, onClose }: { metric: Metric; onClose: () => void }) {
  const w = useWorld();
  const info = w.metricInfo(metric);
  const [value, setValue] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  const [date, setDate] = useState(localDate());
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const record = value !== null && isRecord(info.values, { value, reps: reps ?? undefined }, metric.better);

  const save = async () => {
    if (value === null || busy) return;
    setBusy(true);
    const r = await addMetricValue(metric.id, { value, reps: reps ?? undefined, note, date, photos });
    metricToasts(metric, r, value, reps ?? undefined);
    if (!r.record && !r.milestone) toast({ kind: 'info', title: 'Значение сохранено' });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={metric.title}>
      <span class="muted small">{info.last ? `прошлое: ${fmtNum(info.last.value)} ${metric.unit}${info.last.reps ? ` × ${info.last.reps}` : ''} · рекорд ${fmtNum(info.best!.value)}` : 'первое значение — точка отсчёта'}</span>
      <span class="field-label">{metric.title}, {metric.unit}</span>
      <ValueInput metric={metric} value={value} setValue={setValue} reps={reps} setReps={setReps} />
      <div class="grid-2">
        <select id="value-date" class="input" value={date} onChange={(e) => setDate(e.currentTarget.value)} aria-label="Дата">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => { const v = addDays(localDate(), -d); return <option value={v} key={v}>{humanDate(v)}</option>; })}
        </select>
        <button type="button" class="photo-btn" onClick={() => fileRef.current?.click()}><Icon name="camera" size={20} />Фото</button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
          const f = e.currentTarget.files?.[0];
          if (f) setPhotos([...photos, await compressPhoto(f)].slice(0, 2));
        }} />
      </div>
      {photos.length > 0 && <div class="photo-row">{photos.map((p, i) => <PhotoThumb p={p} key={i} onRemove={() => setPhotos(photos.filter((_, j) => j !== i))} />)}</div>}
      <input id="value-note" class="input" placeholder="Заметка: например, «с паузой внизу»" value={note} onInput={(e) => setNote(e.currentTarget.value)} />
      {record && <div class="record-hint"><Icon name="star" size={18} stroke={2.2} />Это новый рекорд: +{RECORD_XP} XP{metric.skillId ? ` в «${w.nodeById.get(metric.skillId)?.title}»` : ''}</div>}
      <button type="button" class="btn primary" disabled={value === null || busy} onClick={save}>{value === null ? 'Введи значение' : 'Сохранить'}</button>
    </Sheet>
  );
}

function MilestoneSheet({ info, onClose }: { info: Info; onClose: () => void }) {
  const m = info.metric;
  const current = info.last?.value ?? 0;
  const step = m.unit === 'кг' ? 5 : m.unit === 'ч' ? 0.5 : 5;
  const presets = [1, 2, 3, 4].map((k) => Math.round((m.better === 'up' ? current + step * k : current - step * k) * 10) / 10).filter((v) => v > 0);
  const [target, setTarget] = useState<number>(info.milestone?.target ?? presets[1] ?? current);
  const [term, setTerm] = useState<'none' | '30' | '90'>('none');
  const deadline = term === 'none' ? undefined : addDays(localDate(), Number(term));
  const forecast = info.forecast ?? null;

  return (
    <Sheet open onClose={onClose} title={info.milestone ? 'Изменить рубеж' : 'Новый рубеж'}>
      <div class="row-2">
        <div class="compare"><span class="section-label">Сейчас</span><span class="compare-lvl">{info.last ? `${fmtNum(current)} ${m.unit}` : '—'}</span><span class="muted small">старт рубежа</span></div>
        <div class="compare target"><span class="section-label">Цель</span>
          <input id="ms-target" class="value-input compact" inputMode="decimal" value={fmtNum(target)} aria-label="Цель"
            onInput={(e) => { const n = parseFloat(e.currentTarget.value.replace(',', '.')); if (Number.isFinite(n)) setTarget(n); }} />
          <span class="muted small">{m.better === 'up' ? '+' : '−'}{fmtNum(Math.abs(target - current))} {m.unit}</span>
        </div>
      </div>
      <div class="chips">{presets.map((p) => <button type="button" key={p} class={target === p ? 'chip big primary' : 'chip big'} onClick={() => setTarget(p)}>{fmtNum(p)}</button>)}</div>
      <span class="field-label">Срок · необязательно</span>
      <div class="segmented">
        <button type="button" class={term === 'none' ? 'on' : ''} onClick={() => setTerm('none')}>нет</button>
        <button type="button" class={term === '30' ? 'on' : ''} onClick={() => setTerm('30')}>1 мес</button>
        <button type="button" class={term === '90' ? 'on' : ''} onClick={() => setTerm('90')}>3 мес</button>
      </div>
      {info.values.length >= 3 && (
        <div class="notice small">
          <span>{forecast && info.milestone?.target === target ? `По твоему темпу — примерно к ${humanDate(forecast)}.` : 'Прогноз по темпу появится на экране замера после сохранения.'}</span>
        </div>
      )}
      <span class="muted small"><Icon name="star" size={14} /> Взятый рубеж: +{MILESTONE_XP} XP{m.skillId ? ' навыку' : ''} и достижение</span>
      <button type="button" class="btn primary" disabled={!info.last || target === current} onClick={async () => { await setMilestone(m.id, current, target, deadline); onClose(); }}>
        {!info.last ? 'Сначала внеси значение' : 'Поставить рубеж'}
      </button>
      {info.milestone && <button type="button" class="link small danger-text" onClick={async () => { await removeMilestone(info.milestone!.id); onClose(); }}>Убрать рубеж</button>}
    </Sheet>
  );
}

function NewMetricSheet({ onClose }: { onClose: () => void }) {
  const w = useWorld();
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('раз');
  const [better, setBetter] = useState<'up' | 'down'>('up');
  const [hasReps, setHasReps] = useState(false);
  const [skillId, setSkillId] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const found = query.trim() ? w.skills.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6) : [];

  return (
    <Sheet open onClose={onClose} title="Новый замер">
      <input id="metric-title" class="input" placeholder="Название: например, бег 3 км" value={title} onInput={(e) => setTitle(e.currentTarget.value)} />
      <span class="field-label">Единица</span>
      <div class="chips">{['кг', 'раз', 'мин', 'км', 'ч', '%'].map((u) => <button type="button" key={u} class={unit === u ? 'chip big primary' : 'chip big'} onClick={() => setUnit(u)}>{u}</button>)}</div>
      <div class="segmented">
        <button type="button" class={better === 'up' ? 'on' : ''} onClick={() => setBetter('up')}>лучше больше</button>
        <button type="button" class={better === 'down' ? 'on' : ''} onClick={() => setBetter('down')}>лучше меньше</button>
      </div>
      <button type="button" class="toggle-row" role="switch" aria-checked={hasReps} onClick={() => setHasReps(!hasReps)}>
        <span class="strong">Записывать повторы</span><span class={hasReps ? 'switch on' : 'switch'}><span /></span>
      </button>
      <span class="field-label">Навык · рекорды дают ему XP</span>
      {skillId ? (
        <div class="chips"><span class="chip big primary"><span class="chip-btn">{w.nodeById.get(skillId)?.title}</span><button type="button" class="chip-x" aria-label="Убрать навык" onClick={() => setSkillId(undefined)}><Icon name="x" size={14} stroke={3} /></button></span></div>
      ) : (
        <>
          <input id="metric-skill" class="input" placeholder="Найти навык (необязательно)" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
          {found.length > 0 && <div class="chips">{found.map((s) => <button type="button" class="chip big" key={s.id} onClick={() => { setSkillId(s.id); setQuery(''); }}>{s.title}</button>)}</div>}
        </>
      )}
      <button type="button" class="btn primary" disabled={!title.trim()} onClick={async () => { await addMetric({ title: title.trim(), unit, better, hasReps, skillId }); onClose(); }}>Добавить замер</button>
    </Sheet>
  );
}

/** Ссылки на замеры навыка — для страницы навыка. */
export function SkillMetrics({ skillId }: { skillId: string }) {
  const w = useWorld();
  const list = w.metricsOfSkill(skillId).map(w.metricInfo);
  if (list.length === 0) return null;
  return (
    <div class="stack-4">
      {list.map((i) => (
        <a class="skill-metric" href={`#/metrics/${i.metric.id}`} key={i.metric.id}>
          <Icon name="chart" size={18} />
          <span class="strong">{i.metric.title}</span>
          <span class="muted small">{i.last ? `${fmtNum(i.last.value)} ${i.metric.unit}${i.milestone ? ` · рубеж ${fmtNum(i.milestone.target)}` : ''}` : 'нет значений'}</span>
        </a>
      ))}
    </div>
  );
}

