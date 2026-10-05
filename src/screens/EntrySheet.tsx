// «＋ Запись» — главный сценарий, цель 15 секунд. Макет: холст, страница «Упрощение», экраны 2–3.
// Сверху только обязательное (тип, навык, текст); остальное — в «Подробнее».
import { useMemo, useRef, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { addMetricValue, saveEntry, type PhotoDraft } from '../db/actions';
import { calcXp, DIFFICULTIES, ENTRY_TYPES, secondaryXp, xpContextFromHistory, type Difficulty, type EntryType } from '../engine/xp';
import { localDate, humanDate } from '../engine/dates';
import { bestSet, RECORD_XP, type WorkSet } from '../engine/metrics';
import { compressPhoto, useBlobUrl } from '../lib/photo';
import { toast } from '../lib/toast';
import { Icon } from '../components/Icon';
import { Check, SectionLabel, Sheet } from '../components/ui';
import { SetsEditor } from '../components/SetsEditor';
import { stagesToast } from './Skill';
import { BigNumber, lastSetsOf, metricToasts, recordHintFor, usesSets } from './Metrics';
import { logError } from '../lib/errorlog';
import { SuggestInput } from '../components/SuggestInput';
import { fx } from '../lib/fx';
import { STAGE_BONUS } from '../engine/stages';
import { items } from '../engine/suggest';
import { actionIdeas, allPathGoals, goalsFromPaths } from '../data/suggest';

/** workout: открыто кнопкой «Записать тренировку» — тип «Тренировка», подставленные подходы сохраняются как есть. */
/** goalId + closeGoal — из «Следующего действия»: «Цель выполнена ✓» (закрыть) или «Сделал шаг» (работал, не закрывая). */
export interface EntryPreset { skillId?: string; fixesEntryId?: string; workout?: boolean; goalId?: string; closeGoal?: boolean }

const LAST_TYPE = 'lq.lastType';
const loadType = (): EntryType => {
  try {
    const t = localStorage.getItem(LAST_TYPE) as EntryType | null;
    return t && ENTRY_TYPES.some((x) => x.id === t) ? t : 'practice';
  } catch {
    return 'practice';
  }
};

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
  const presetGoal = preset.goalId ? w.goals.find((g) => g.id === preset.goalId) : undefined;
  // Тип по цели: теория → «Изучил», практика → «Практика».
  const [type, setTypeState] = useState<EntryType>(() => (preset.workout ? 'workout' : presetGoal ? (presetGoal.kind === 'theory' ? 'learn' : 'practice') : loadType()));
  const [text, setText] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [skillIds, setSkillIds] = useState<string[]>(preset.skillId ? [preset.skillId] : []);
  const [closeGoals, setCloseGoals] = useState<string[]>(preset.goalId && preset.closeGoal ? [preset.goalId] : []);
  const [outcome, setOutcome] = useState<'ok' | 'fail'>('ok');
  const [failNote, setFailNote] = useState('');
  const [fixesId, setFixesId] = useState<string | undefined>(preset.fixesEntryId);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [picking, setPicking] = useState<'primary' | 'secondary' | null>(null);
  const [query, setQuery] = useState('');
  const [more, setMore] = useState(!!preset.fixesEntryId);
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sets, setSets] = useState<WorkSet[] | null>(null);
  const [single, setSingle] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Подсказки «Что сделал»: свои записи (сначала по этому навыку) → цели навыка → запас по типу действия.
  const ideaSkill = skillIds[0];
  const textIdeas = useMemo(() => {
    const byDate = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);
    const own = ideaSkill ? (w.entriesBySkill.get(ideaSkill) ?? []) : [];
    const recent = [...w.entries].sort(byDate).slice(0, 300);
    const skillTitle = ideaSkill ? w.nodeById.get(ideaSkill)?.title ?? '' : '';
    return items({
      mine: [...own, ...recent].filter((e) => e.type !== 'bonus').map((e) => e.text),
      goal: ideaSkill ? [...w.openGoalsOf(ideaSkill).map((g) => g.title), ...goalsFromPaths(skillTitle)] : [],
      idea: [...actionIdeas(type), ...allPathGoals()],
    });
  }, [ideaSkill, type, w.entries]);

  const setType = (t: EntryType) => {
    setTypeState(t);
    try {
      localStorage.setItem(LAST_TYPE, t);
    } catch {
      /* не критично */
    }
  };

  const primaryId = skillIds[0];
  const primary = primaryId ? w.nodeById.get(primaryId) : undefined;
  const cur = primaryId ? w.currentStageOf(primaryId) : undefined;
  const stageGoals = cur ? cur.goals.filter((g) => !g.done) : [];
  const openErrors = primaryId ? w.openErrorsBySkill.get(primaryId) ?? [] : [];

  // Замер навыка — только в тренировке (§8).
  const metric = primaryId && type === 'workout' ? w.metricsOfSkill(primaryId)[0] : undefined;
  const mInfo = metric ? w.metricInfo(metric) : undefined;
  const lastSets = mInfo ? lastSetsOf(mInfo) : undefined;
  const curSets = sets ?? (lastSets ? lastSets.map((x) => ({ ...x })) : metric?.hasReps ? [{ w: undefined, r: 0 }] : [{ r: 0 }]);
  const setsTouched = sets !== null || (!!preset.workout && !!lastSets);
  const hint = mInfo && (setsTouched || single !== null) ? recordHintFor(mInfo, curSets, single) : null;

  const preview = useMemo(() => {
    if (!primaryId) return null;
    const history = w.entries.filter((e) => e.type !== 'bonus' && w.primaryOf(e.id) === primaryId).map((e) => ({ type: e.type, date: e.date }));
    const ctx = xpContextFromHistory(history, { type, difficulty, hasPhoto: photos.length > 0, fixesError: outcome === 'ok' && !!fixesId, isFocus: !!primary?.focus }, localDate());
    return calcXp(ctx);
  }, [w, primaryId, type, difficulty, photos.length, outcome, fixesId, primary]);
  const total = preview ? preview.xp + (hint ? RECORD_XP : 0) : 0;

  const suggestions = [...w.focusSkills, ...w.recentSkills.filter((s) => !s.focus)].filter((s) => !skillIds.includes(s.id)).slice(0, 5);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? w.skills.filter((s) => s.title.toLowerCase().includes(q)) : w.skills;
    return list.filter((s) => !skillIds.includes(s.id)).slice(0, 30);
  }, [query, w.skills, skillIds]);

  const choosePrimary = (id: string) => {
    setSkillIds([id, ...skillIds.slice(1).filter((x) => x !== id)]);
    setCloseGoals([]);
    setFixesId(undefined);
    setSets(null);
    setSingle(null);
    setPicking(null);
    setQuery('');
  };
  const addSecondary = (id: string) => {
    if (!primaryId) return choosePrimary(id);
    setSkillIds((ids) => (ids.includes(id) || ids.length >= 5 ? ids : [...ids, id]));
    setPicking(null);
    setQuery('');
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    try {
      const done = await Promise.all([...files].slice(0, 4 - photos.length).map(compressPhoto));
      setPhotos((p) => [...p, ...done].slice(0, 4));
    } catch {
      toast({ kind: 'info', title: 'Не получилось открыть фото', sub: 'Попробуй другой снимок' });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    if (!primaryId || busy) return;
    setBusy(true);
    try {
      const { xp, stages } = await saveEntry({
        type, text, difficulty, primaryId, secondaryIds: skillIds.slice(1), closeGoalIds: closeGoals,
        outcome, failNote, fixesEntryId: outcome === 'ok' ? fixesId : undefined, photos,
        stepGoalIds: preset.goalId && primaryId === presetGoal?.skillId ? [preset.goalId] : undefined,
      });
      // Анимации прогресса (флаг anim): «+N XP» летит к полоске уровня с множителями; иначе — как раньше, всплывашкой.
      if (w.hasExp('anim')) fx({ kind: 'xp', amount: xp + stages.length * STAGE_BONUS, badges: (preview?.factors ?? []).map((f) => `×${f.mult} ${f.label}`) });
      else toast({ kind: 'xp', title: `+${xp} XP`, sub: primary?.title });
      stagesToast(stages);
      if (metric && mInfo) {
        const withSets = usesSets(metric);
        if (withSets ? setsTouched && bestSet(curSets) : single !== null) {
          const r = await addMetricValue(metric.id, withSets ? { sets: curSets } : { value: single! });
          const b = bestSet(curSets);
          metricToasts(metric, r, withSets ? (metric.hasReps ? b?.w ?? 0 : b?.r ?? 0) : single!, withSets && metric.hasReps ? b?.r : undefined);
        }
      }
      onClose();
    } catch (e) {
      logError(e, 'Действие');
      toast({ kind: 'info', title: 'Не удалось сохранить действие', sub: 'Попробуй ещё раз' });
      setBusy(false);
    }
  };

  const diffLabel = DIFFICULTIES.find((d) => d.id === difficulty)!.label.toLowerCase();
  const summary = [diffLabel, outcome === 'ok' ? 'получилось' : 'не получилось', skillIds.length > 1 ? `${skillIds.length} навыка` : null, fixesId ? 'исправляет ошибку' : null].filter(Boolean).join(' · ');

  return (
    <Sheet open onClose={onClose} title="Новое действие">
      <div class="type-row" role="radiogroup" aria-label="Тип действия">
        {ENTRY_TYPES.map((t) => (
          <button type="button" key={t.id} role="radio" aria-checked={type === t.id} class={type === t.id ? 'chip big primary' : 'chip big'} onClick={() => setType(t.id)}>{t.label}</button>
        ))}
      </div>

      <div class="stack-8">
        <SectionLabel>Навык</SectionLabel>
        <div class="chips">
          {primary && <span class="chip big primary">{primary.focus && <Icon name="star" size={14} stroke={2.4} />}{primary.title}</span>}
          {!picking && suggestions.map((s) => (
            <button type="button" key={s.id} class="chip big" onClick={() => choosePrimary(s.id)}>{s.focus && <Icon name="star" size={14} stroke={2.4} />}{s.title}</button>
          ))}
          <button type="button" class="chip big dashed" onClick={() => setPicking(picking ? null : 'primary')}>{picking ? 'закрыть' : 'поиск…'}</button>
        </div>
        {picking && (
          <div class="picker">
            <input id="skill-search" class="input" placeholder="Найти навык" value={query} onInput={(e) => setQuery(e.currentTarget.value)} autoFocus />
            <div class="picker-list">
              {results.map((s) => (
                <button type="button" key={s.id} class="picker-item" onClick={() => (picking === 'primary' ? choosePrimary(s.id) : addSecondary(s.id))}>
                  <span>{s.title}</span>
                  <span class="muted small">{w.pathOf(s.id).slice(0, -1).map((n) => n.title).join(' › ')}</span>
                </button>
              ))}
              {results.length === 0 && <p class="muted small">Ничего не нашлось. Новый навык добавляется во вкладке «Дерево».</p>}
            </div>
          </div>
        )}
      </div>

      <div class="text-row">
        <SuggestInput id="entry-text" placeholder={type === 'workout' ? 'Что делал (необязательно)' : 'Что сделал'} value={text} onValue={setText} items={textIdeas} />
        <button type="button" class="text-cam" aria-label="Добавить фото" onClick={() => fileRef.current?.click()}><Icon name="camera" size={22} /></button>
        <input ref={fileRef} id="entry-photo" type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onFiles(e.currentTarget.files)} />
      </div>
      {photos.length > 0 && <div class="photo-row">{photos.map((p, i) => <PhotoPreview key={i} photo={p} onRemove={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} />)}</div>}

      {metric && mInfo && (
        <div class="metric-in-entry">
          {usesSets(metric) ? (
            <SetsEditor metric={metric} sets={curSets} setSets={(s) => setSets(s)} lastSets={lastSets} recordHint={hint} />
          ) : (
            <>
              <span class="section-label metric-label">Замер · {metric.title}</span>
              <BigNumber metric={metric} value={single} setValue={setSingle} placeholder={mInfo.last?.value} />
              {hint && <div class="record-hint"><Icon name="star" size={16} stroke={2.2} />{hint}</div>}
            </>
          )}
          {preset.workout && sets === null && lastSets && <span class="muted small">Как в прошлый раз — поправь, если было иначе. Не нужны — убери «✕».</span>}
          {!setsTouched && single === null && <span class="muted small">Подставлено как в прошлый раз — нажми на число, чтобы поправить. Не трогал — сохранится только действие.</span>}
        </div>
      )}

      {outcome === 'ok' && cur && stageGoals.length > 0 && (
        <div class="stack-4">
          <SectionLabel>Закрыть цель? · ступень «{cur.name}»</SectionLabel>
          {stageGoals.map((g) => {
            const on = closeGoals.includes(g.id);
            return (
              <button type="button" key={g.id} class={on ? 'goal-row' : 'goal-row open'} onClick={() => setCloseGoals(on ? closeGoals.filter((x) => x !== g.id) : [...closeGoals, g.id])}>
                <Check done={on} /><span>{g.title}</span>
              </button>
            );
          })}
        </div>
      )}

      <div class="more-box">
        <button type="button" class="more-head" onClick={() => setMore(!more)} aria-expanded={more}>
          <span class="stack-4"><span class="strong">Подробнее</span><span class="muted small">{summary}</span></span>
          <Icon name={more ? 'up' : 'down'} size={18} stroke={2.4} />
        </button>
        {more && (
          <div class="more-body">
            <span class="field-label">Сложность</span>
            <div class="segmented">
              {DIFFICULTIES.map((d) => <button type="button" key={d.id} class={difficulty === d.id ? 'on' : ''} onClick={() => setDifficulty(d.id)}>{d.label}</button>)}
            </div>
            <div class="row-2">
              <button type="button" class={outcome === 'ok' ? 'pick ok on' : 'pick'} onClick={() => setOutcome('ok')}>Получилось</button>
              <button type="button" class={outcome === 'fail' ? 'pick fail on' : 'pick'} onClick={() => setOutcome('fail')}>Не получилось</button>
            </div>
            {outcome === 'fail' && <input id="fail-note" class="input" placeholder="Что пошло не так" value={failNote} onInput={(e) => setFailNote(e.currentTarget.value)} />}
            {outcome === 'ok' && openErrors.length > 0 && (
              <div class="stack-4">
                <span class="field-label">Исправляет ошибку? ×1.5 XP</span>
                {openErrors.map((e) => (
                  <button type="button" key={e.id} class="goal-row" onClick={() => setFixesId(fixesId === e.id ? undefined : e.id)}>
                    <Check done={fixesId === e.id} /><span>{e.failNote || e.text} <span class="muted small">· {humanDate(e.date)}</span></span>
                  </button>
                ))}
              </div>
            )}
            <span class="field-label">Сопутствующие навыки · по 50%</span>
            <div class="chips">
              {skillIds.slice(1).map((id) => (
                <span key={id} class="chip big"><span class="chip-btn">{w.nodeById.get(id)?.title}</span>
                  <button type="button" class="chip-x" aria-label="Убрать навык" onClick={() => setSkillIds(skillIds.filter((x) => x !== id))}><Icon name="x" size={14} stroke={3} /></button>
                </span>
              ))}
              {primaryId && skillIds.length < 5 && <button type="button" class="chip big dashed" onClick={() => setPicking('secondary')}>+ навык</button>}
            </div>
          </div>
        )}
      </div>

      <div class="save-zone">
        {why && preview && (
          <span class="muted small why-text">
            {[`база ${preview.base}`, ...preview.factors.map((f) => `×${f.mult} ${f.label}`)].join(' ')}
            {skillIds.length > 1 && ` · сопутствующим по +${secondaryXp(preview.xp)}`}
            {hint && ` · рекорд +${RECORD_XP}`}
          </span>
        )}
        <div class="save-row">
          {preview && (
            <button type="button" class="xp-why" onClick={() => setWhy(!why)} aria-expanded={why}>
              <span class="xp-big">+{total}</span><span class="why-link">почему?</span>
            </button>
          )}
          <button type="button" class="btn primary save-btn" disabled={!primaryId || busy} onClick={save}>{primaryId ? 'Сохранить' : 'Выбери навык'}</button>
        </div>
      </div>
    </Sheet>
  );
}
