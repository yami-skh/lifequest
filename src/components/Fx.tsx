// Слой анимаций прогресса: «+N XP» летит к полоске уровня; новый уровень — полноэкранный момент.
// Макет: холст, «Анимации прогресса» (AnimXp, AnimLevel). При «уменьшении движения» — без полёта, сразу итог.
import { useEffect, useState } from 'preact/hooks';
import { onFx } from '../lib/fx';
import { useBackClose } from '../lib/backButton';

interface Fly { id: number; amount: number; badges: string[]; dx: number; dy: number }
let seq = 0;

export function FxLayer() {
  const [flies, setFlies] = useState<Fly[]>([]);
  const [level, setLevel] = useState<{ level: number; from: number; left: number } | null>(null);
  useBackClose(!!level, () => setLevel(null));

  useEffect(() => onFx((e) => {
    if (e.kind === 'level') return setLevel({ level: e.level, from: e.from, left: e.left });
    // Куда лететь: полоска опыта на главном, если она на экране; иначе — просто вверх.
    const bar = document.querySelector('.char-xp-bar') as HTMLElement | null;
    const r = bar?.getBoundingClientRect();
    const sx = innerWidth / 2;
    const sy = innerHeight - 150;
    const onScreen = r && r.bottom > 0 && r.top < innerHeight;
    const dx = onScreen ? r!.left + r!.width / 2 - sx : 0;
    const dy = onScreen ? r!.top + r!.height / 2 - sy : -220;
    const fly = { id: ++seq, amount: e.amount, badges: e.badges ?? [], dx, dy };
    setFlies((f) => [...f, fly]);
    // Полоска вспыхивает, когда число до неё долетело.
    if (onScreen) setTimeout(() => { bar!.classList.remove('fx-glow'); void bar!.offsetWidth; bar!.classList.add('fx-glow'); }, 620);
    setTimeout(() => setFlies((f) => f.filter((x) => x.id !== fly.id)), 1100);
  }), []);

  return (
    <>
      {flies.map((f) => (
        <div class="fx-fly" key={f.id} style={{ '--dx': `${f.dx}px`, '--dy': `${f.dy}px` }} aria-live="polite">
          <span class="fx-fly-num">+{f.amount} XP</span>
          {f.badges.length > 0 && <span class="fx-badges">{f.badges.map((b) => <span class="fx-badge" key={b}>{b}</span>)}</span>}
        </div>
      ))}
      {level && (
        <div class="fx-level" role="dialog" aria-modal="true" aria-label={`Новый уровень ${level.level}`} onClick={() => setLevel(null)}>
          <span class="fx-wave" /><span class="fx-wave w2" />
          {[30, 40, 52, 62, 70, 46, 58].map((x, i) => <span class="fx-spark" key={i} style={{ left: `${x}%`, animationDelay: `${0.9 + (i % 4) * 0.05}s` }} />)}
          <span class="fx-level-k">НОВЫЙ УРОВЕНЬ</span>
          <span class="fx-flip">
            <span class="fx-old">{level.from}</span>
            <span class="fx-new">{level.level}</span>
          </span>
          <span class="fx-level-t">Персонаж стал сильнее</span>
          <span class="fx-level-s">До уровня {level.level + 1} — {level.left} XP</span>
          <button type="button" class="btn primary fx-level-btn" onClick={() => setLevel(null)}>Дальше</button>
        </div>
      )}
    </>
  );
}
