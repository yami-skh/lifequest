// «＋ Запись» — главный сценарий, цель 15 секунд. ARCHITECTURE.md §10.
import { useMemo, useRef, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { addMetricValue, saveEntry, type PhotoDraft } from '../db/actions';
import { isRecord, RECORD_XP } from '../engine/metrics';
import { metricToasts, ValueInput } from './Metrics';
import { calcXp, DIFFICULTIES, ENTRY_TYPES, secondaryXp, xpContextFromHistory, type Difficulty, type EntryType } from '../engine/xp';
import { localDate, humanDate } from '../engine/dates';
import { compressPhoto, useBlobUrl } from '../lib/photo';
import { toast } from '../lib/toast';
import { Icon } from '../components/Icon';
import { Check, SectionLabel, Sheet } from '../components/ui';
import { stagesToast } from './Skill';

export interface EntryPreset { skillId?: string; fixesEntryId?: string }

function PhotoPreview({ photo, onRemove }: { photo: PhotoDraft; onRemove: () => void }) {
  const url = useBlobUrl(photo.thumb);
  return (
    <div class="photo-draft">
      {url && <img src={url} alt="" />}
      <button type="button" class="photo-remove" aria-label="Убрать фото" onClick={onRemove}><Icon name="x" size={14} stroke={3} /></button>
    </div>
  );
}

export function EntrySheet({ preset, onClose }: { preset: EntryPreset; onClose: () => void }) {
  const w = useWorld();
  const [type, setType] = useState<EntryType>('practice');
  const [text, setText] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [skillIds, setSkillIds] = useState<string[]>(preset.skillId ? [preset.skillId] : []);
  const [closeGoals, setCloseGoals] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<'ok' | 'fail'>('ok');
  const [failNote, setFailNote] = useState('');
  const [fixesId, setFixesId] = useState<string | undefined>(preset.fixesEntryId);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [mValue, setMValue] = useState<number | null>(null);
  const [mReps, setMReps] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const primaryId = skillIds[0];
  const primary = primaryId ? w.nodeById.get(primaryId) : undefined;
  const openGoals = primaryId ? w.openGoalsOf(primaryId) : [];
  const openErrors = primaryId ? w.openErrorsBySkill.get(primaryId) ?? [] : [];

  const preview = useMemo(() => {
    if (!primaryId) return null;
    const history = w.entries.filter((e) => e.type !== 'bonus' && w.primaryOf(e.id) === primaryId).map((e) => ({ type: e.type, date: e.date }));
    const ctx = xpContextFromHistory(history, { type, difficulty, hasPhoto: photos.length > 0, fixesError: outcome === 'ok' && !!fixesId, isFocus: !!primary?.focus }, localDate());
    return calcXp(ctx);
  }, [w, primaryId, type, difficulty, photos.length, outcome, fixesId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? w.skills.filter((s) => s.title.toLowerCase().includes(q)) : w.skills;
    return list.filter((s) => !skillIds.includes(s.id)).slice(0, 30);
  }, [query, w.skills, skillIds]);

  const addSkill = (id: string) => {
    setSkillIds((ids) => (ids.includes(id) || ids.length >= 5 ? ids : [...ids, id]));
    setPicking(false);
    setQuery('');
  };
  const removeSkill = (id: string) => {
    setSkillIds((ids) => ids.filter((x) => x !== id));
    if (id === primaryId) {
      setCloseGoals([]);
      setFixesId(undefined);
    }
  };
  const makePrimary = (id: string) => {
    setSkillIds((ids) => [id, ...ids.filter((x) => x !== id)]);
    setCloseGoals([]);
    setFixesId(undefined);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = 4 - photos.length;
    const list = [...files].slice(0, room);
    try {
      const done = await Promise.all(list.map(compressPhoto));
      setPhotos((p) => [...p, ...done].slice(0, 4));
    } catch {
      toast({ kind: 'info', title: 'Не получилось открыть фото', sub: 'Попробуй другой снимок' });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  // Замер основного навыка: показываем при тренировке и практике (§8).
  const metric = primaryId && (type === 'workout' || type === 'practice') ? w.metricsOfSkill(primaryId)[0] : undefined;
  const mInfo = metric ? w.metricInfo(metric) : undefined;
  const mRecord = !!(metric && mInfo && mValue !== null && isRecord(mInfo.values, { value: mValue, reps: mReps ?? undefined }, metric.better));

  const save = async () => {
    if (!primaryId || busy) return;
    setBusy(true);
    try {
      const { xp, stages } = await saveEntry({
        type,
        text,
        difficulty,
        primaryId,
        secondaryIds: skillIds.slice(1),
        closeGoalIds: closeGoals,
        outcome,
        failNote,
        fixesEntryId: outcome === 'ok' ? fixesId : undefined,
        photos,
      });
      toast({ kind: 'xp', title: `+${xp} XP`, sub: primary?.title });
      stagesToast(stages);
      if (metric && mValue !== null) {
        const r = await addMetricValue(metric.id, { value: mValue, reps: mReps ?? undefined });
        metricToasts(metric, r, mValue, mReps ?? undefined);
      }
      onClose();
    } catch (e) {
      console.error(e);
      toast({ kind: 'info', title: 'Не удалось сохранить запись', sub: 'Попробуй ещё раз' });
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Новая запись">
      <div class="grid-3">
        {ENTRY_TYPES.map((t) => (
          <button type="button" key={t.id} class={type === t.id ? 'pick on' : 'pick'} onClick={() => setType(t.id)}>{t.label}</button>
        ))}
      </div>

      <label class="field">
        <span class="field-label">Что сделал</span>
        <textarea id="entry-text" rows={2} placeholder="Например: приготовил рамен с нуля" value={text} onInput={(e) => setText(e.currentTarget.value)} />
      </label>

      <div class="photo-row">
        {photos.length < 4 && (
          <button type="button" class="photo-add" aria-label="Добавить фото" onClick={() => fileRef.current?.click()}>
            <Icon name="camera" size={26} />
          </button>
        )}
        {photos.map((p, i) => <PhotoPreview key={i} photo={p} onRemove={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} />)}
        <input ref={fileRef} id="entry-photo" type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onFiles(e.currentTarget.files)} />
      </div>

      <div class="stack-8">
        <SectionLabel>Навыки</SectionLabel>
        <div class="chips">
          {skillIds.map((id, i) => (
            <span key={id} class={i === 0 ? 'chip big primary' : 'chip big'}>
              <button type="button" class="chip-btn" onClick={() => i > 0 && makePrimary(id)} title={i > 0 ? 'Сделать основным' : undefined}>
                {w.nodeById.get(id)?.title} · {i === 0 ? 'основной' : '50%'}
              </button>
              <button type="button" class="chip-x" aria-label="Убрать навык" onClick={() => removeSkill(id)}><Icon name="x" size={14} stroke={3} /></button>
            </span>
          ))}
          {skillIds.length < 5 && (
            <button type="button" class="chip big dashed" onClick={() => setPicking(!picking)}>+ навык</button>
          )}
        </div>
        {skillIds.length === 0 && !picking && (w.recentSkills.length > 0 || w.focusSkills.length > 0) && (
          <div class="chips">
            {[...w.focusSkills, ...w.recentSkills.filter((s) => !s.focus)].slice(0, 6).map((s) => (
              <button type="button" key={s.id} class="chip big" onClick={() => addSkill(s.id)}>{s.focus && <Icon name="star" size={14} stroke={2.4} />}{s.title}</button>
            ))}
          </div>
        )}
        {picking && (
          <div class="picker">
            <input id="skill-search" class="input" placeholder="Найти навык" value={query} onInput={(e) => setQuery(e.currentTarget.value)} autoFocus />
            <div class="picker-list">
              {results.map((s) => (
                <button type="button" key={s.id} class="picker-item" onClick={() => addSkill(s.id)}>
                  <span>{s.title}</span>
                  <span class="muted small">{w.pathOf(s.id).slice(0, -1).map((n) => n.title).join(' › ')}</span>
                </button>
              ))}
              {results.length === 0 && <p class="muted small">Ничего не нашлось. Новый навык добавляется во вкладке «Дерево».</p>}
            </div>
          </div>
        )}
      </div>

      <div class="stack-8">
        <SectionLabel>Сложность</SectionLabel>
        <div class="segmented">
          {DIFFICULTIES.map((d) => (
            <button type="button" key={d.id} class={difficulty === d.id ? 'on' : ''} onClick={() => setDifficulty(d.id)}>{d.label}</button>
          ))}
        </div>
      </div>

      <div class="row-2">
        <button type="button" class={outcome === 'ok' ? 'pick ok on' : 'pick'} onClick={() => setOutcome('ok')}>Получилось</button>
        <button type="button" class={outcome === 'fail' ? 'pick fail on' : 'pick'} onClick={() => setOutcome('fail')}>Не получилось</button>
      </div>
      {outcome === 'fail' && (
        <label class="field">
          <span class="field-label">Что пошло не так</span>
          <input id="fail-note" class="input" placeholder="Например: бульон получился мутным" value={failNote} onInput={(e) => setFailNote(e.currentTarget.value)} />
        </label>
      )}

      {metric && mInfo && (
        <div class="metric-in-entry">
          <div class="spread">
            <span class="section-label metric-label">Замер · {metric.title}</span>
            {mInfo.last && <span class="muted small strong">прошлое {String(mInfo.last.value).replace('.', ',')}{mInfo.last.reps ? ` × ${mInfo.last.reps}` : ''}</span>}
          </div>
          <ValueInput metric={metric} value={mValue} setValue={setMValue} reps={mReps} setReps={setMReps} compact />
          <span class="muted small">Можно оставить пустым — тогда сохранится только запись.</span>
        </div>
      )}

      {outcome === 'ok' && openErrors.length > 0 && (
        <div class="stack-8">
          <SectionLabel>Исправляет ошибку? ×1.5 XP</SectionLabel>
          {openErrors.map((e) => (
            <button type="button" key={e.id} class="goal-row" onClick={() => setFixesId(fixesId === e.id ? undefined : e.id)}>
              <Check done={fixesId === e.id} />
              <span>{e.failNote || e.text} <span class="muted small">· {humanDate(e.date)}</span></span>
            </button>
          ))}
        </div>
      )}

      {outcome === 'ok' && openGoals.length > 0 && (
        <div class="stack-8">
          <SectionLabel>Закрыть цели навыка</SectionLabel>
          {openGoals.map((g) => {
            const on = closeGoals.includes(g.id);
            return (
              <button type="button" key={g.id} class="goal-row" onClick={() => setCloseGoals(on ? closeGoals.filter((x) => x !== g.id) : [...closeGoals, g.id])}>
                <Check done={on} />
                <span>{g.title}</span>
                <span class="goal-kind">{g.kind === 'practice' ? 'практика' : 'теория'}</span>
              </button>
            );
          })}
        </div>
      )}

      <div class="save-zone">
        <div class="xp-preview">
          <span class="muted small">
            {preview ? [String(preview.base), ...preview.factors.map((f) => `×${f.mult} ${f.label}`)].join(' ') : 'Выбери навык, чтобы увидеть XP'}
            {preview && skillIds.length > 1 && ` · сопутствующим по +${secondaryXp(preview.xp)}`}
            {mRecord && ` · рекорд +${RECORD_XP}`}
          </span>
          <span class="xp-big">{preview ? `+${preview.xp + (mRecord ? RECORD_XP : 0)} XP` : ''}</span>
        </div>
        <button type="button" class="btn primary" disabled={!primaryId || busy} onClick={save}>
          {primaryId ? 'Сохранить' : 'Выбери навык'}
        </button>
      </div>
    </Sheet>
  );
}
