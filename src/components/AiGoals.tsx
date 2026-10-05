// «Предложить цели» — кнопка на навыке и шторка: запрос → ожидание → предпросмотр с галочками.
// Макет: холст, страница «AI-помощник целей».
import { useEffect, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { addGoal } from '../db/actions';
import { stageName } from '../engine/stages';
import { AiError, type AiGoalsAnswer, askGoals, fetchQuota } from '../lib/ai';
import { toast } from '../lib/toast';
import { Icon } from './Icon';
import { Check, Sheet } from './ui';
import { logError } from '../lib/errorlog';

const WISHES = ['больше практики', 'полегче', 'на неделю'];

/** Кнопка видна, только если в настройках введён код доступа. */
export function AiGoalsButton({ skillId }: { skillId: string }) {
  const w = useWorld();
  const [open, setOpen] = useState(false);
  if (!w.profile?.aiCode) return null;
  return (
    <>
      <button type="button" class="ai-btn" onClick={() => setOpen(true)}><Icon name="spark" size={16} />Предложить цели</button>
      {open && <AiGoalsSheet skillId={skillId} onClose={() => setOpen(false)} />}
    </>
  );
}

type Phase = { kind: 'ask' } | { kind: 'loading' } | { kind: 'preview'; answer: AiGoalsAnswer } | { kind: 'error'; message: string };

function AiGoalsSheet({ skillId, onClose }: { skillId: string; onClose: () => void }) {
  const w = useWorld();
  const node = w.nodeById.get(skillId)!;
  const code = w.profile?.aiCode ?? '';
  const lv = w.skillLevelOf(skillId);
  const [wish, setWish] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' });
  const [remaining, setRemaining] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchQuota(code).then((q) => setRemaining(q.remaining)).catch(() => {});
  }, [code]);

  const ask = async () => {
    setPhase({ kind: 'loading' });
    try {
      const goals = (w.goalsBySkill.get(skillId) ?? []).map((g) => ({ title: g.title, kind: g.kind, stage: g.stage, done: g.done }));
      const answer = await askGoals(code, {
        title: node.title,
        path: w.pathOf(skillId).slice(0, -1).map((n) => n.title),
        level: lv.level,
        levelName: lv.name,
        goals,
      }, wish);
      setRemaining(answer.remaining);
      setPicked(new Set(answer.stages.flatMap((s) => s.goals.map((_, i) => `${s.stage}:${i}`))));
      setPhase({ kind: 'preview', answer });
    } catch (e) {
      if (!(e instanceof AiError) || e.code === 'network' || e.code === 'internal' || e.code === 'api') logError(e, 'AI-помощник');
      if (e instanceof AiError && e.remaining !== undefined) setRemaining(e.remaining);
      setPhase({ kind: 'error', message: e instanceof AiError ? e.message : 'Что-то пошло не так' });
    }
  };

  const add = async (answer: AiGoalsAnswer) => {
    let n = 0;
    for (const s of answer.stages) {
      for (const [i, g] of s.goals.entries()) {
        if (!picked.has(`${s.stage}:${i}`)) continue;
        await addGoal(skillId, g.kind, g.title, s.stage);
        n++;
      }
    }
    toast({ kind: 'info', title: `Добавлено целей: ${n}`, sub: node.title });
    onClose();
  };

  const toggle = (key: string) => {
    const next = new Set(picked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPicked(next);
  };

  const left = remaining !== null && <span class="muted small center">Сегодня осталось запросов: {remaining}</span>;

  if (phase.kind === 'preview') {
    const a = phase.answer;
    return (
      <Sheet open onClose={onClose} title="Claude предлагает">
        {a.comment && <div class="ai-note"><Icon name="spark" size={16} /><span>{a.comment}</span></div>}
        {a.stages.map((s) => (
          <section class="stack-4" key={s.stage}>
            <span class="ai-stage">Ступень {s.stage} · {stageName(s.stage)}</span>
            {s.goals.map((g, i) => {
              const key = `${s.stage}:${i}`;
              const on = picked.has(key);
              return (
                <button type="button" class={on ? 'ai-goal' : 'ai-goal off'} onClick={() => toggle(key)} aria-pressed={on} key={key}>
                  <Check done={on} />
                  <span class="stack-4"><span class="strong">{g.title}</span><span class="muted small">{g.kind === 'practice' ? 'практика' : 'теория'}</span></span>
                </button>
              );
            })}
          </section>
        ))}
        <span class="muted small">Без галочки — цель не добавится. Потом любую цель можно удалить.</span>
        <button type="button" class="btn primary" disabled={picked.size === 0} onClick={() => add(a)}>Добавить {picked.size} {picked.size === 1 ? 'цель' : picked.size < 5 ? 'цели' : 'целей'}</button>
        <div class="row-2">
          <button type="button" class="link small ai-link" onClick={ask} disabled={remaining === 0}>↻ Другие варианты</button>
          <button type="button" class="link small muted" onClick={onClose}>Отмена</button>
        </div>
        {left}
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Цели от Claude">
      <span class="muted small ai-sub">{node.title} · ур. {lv.level}</span>
      {phase.kind === 'loading' ? (
        <div class="ai-wait"><span class="ai-spin"><Icon name="spark" size={28} /></span><span class="strong">Claude думает…</span><span class="muted small">Обычно 10–30 секунд.</span></div>
      ) : (
        <>
          <div class="stack-8">
            <span class="section-label">Пожелание · необязательно</span>
            <textarea id="ai-wish" rows={3} maxLength={300} placeholder="Например: хочу смотреть сериалы без субтитров" value={wish} onInput={(e) => setWish(e.currentTarget.value)} />
            <div class="chips">{WISHES.map((x) => <button type="button" class="chip" key={x} onClick={() => setWish(wish ? `${wish}, ${x}` : x)}>{x}</button>)}</div>
          </div>
          <div class="ai-privacy"><Icon name="shield" size={18} /><span>Отправится только: название навыка, путь в дереве, уровень и текущие цели. Действия, фото и заметки — нет.</span></div>
          {phase.kind === 'error' && <div class="notice error"><span class="small">{phase.message}</span></div>}
          <button type="button" class="btn ai-main" onClick={ask} disabled={remaining === 0}><Icon name="spark" size={18} />{phase.kind === 'error' ? 'Попробовать ещё раз' : 'Предложить цели'}</button>
          {left}
        </>
      )}
    </Sheet>
  );
}
