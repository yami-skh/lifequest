// Созвездие навыков: второй вид дерева (§16, идея 11). Макет: холст, «Созвездие и напоминания».
// Направления — созвездия по кругу, навыки — звёзды вокруг (крупнее = выше уровень, пунктир = не начат, рыжая = ржавчина).
// Небо всегда тёмное, в любой теме. Сдвиг — пальцем, приближение — двумя пальцами или колёсиком.
import { useMemo, useRef, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import type { Node } from '../db/db';
import { Ring } from './ui';

interface Star { node: Node; x: number; y: number; r: number; level: number; fog: boolean; rust: boolean }
interface Cluster { area: Node; x: number; y: number; color: string; stars: Star[] }
type View = { x: number; y: number; w: number; h: number };

const RUST = '#C98A5A';

export function StarMap() {
  const w = useWorld();
  const [selected, setSelected] = useState<string | null>(null);

  const clusters = useMemo<Cluster[]>(() => {
    const areas = w.areas;
    // Овал, вытянутый по вертикали: экран телефона узкий и высокий.
    const n = areas.length;
    const rx = n > 1 ? 95 + n * 5 : 0;
    const ry = n > 1 ? 150 + n * 14 : 0;
    return areas.map((area, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const cx = rx * Math.cos(a);
      const cy = ry * Math.sin(a);
      const skills = w.skills.filter((s) => w.areaOf(s.id)?.id === area.id);
      const stars = skills.map((node, k) => {
        // Кольца по 6 звёзд, каждое следующее — дальше от центра созвездия.
        const ring = Math.floor(k / 6);
        const inRing = Math.min(6, skills.length - ring * 6);
        const ang = -Math.PI / 2 + ((k % 6) * 2 * Math.PI) / inRing + ring * 0.5;
        const rad = 44 + ring * 30 + (k % 2) * 8;
        const lv = w.skillLevelOf(node.id);
        return {
          node, level: lv.level, r: 3 + lv.level * 0.9,
          x: cx + rad * Math.cos(ang), y: cy + rad * Math.sin(ang),
          fog: !w.explored(node.id), rust: w.rustDays(node.id) !== null,
        };
      });
      return { area, x: cx, y: cy, color: area.color ?? '#A3A9B6', stars };
    });
  }, [w]);

  // Начальный вид — всё небо целиком.
  const fit = useMemo<View>(() => {
    const pts = clusters.flatMap((c) => [{ x: c.x, y: c.y }, ...c.stars]);
    if (!pts.length) return { x: -200, y: -200, w: 400, h: 400 };
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const m = 40;
    return { x: Math.min(...xs) - m, y: Math.min(...ys) - m, w: Math.max(...xs) - Math.min(...xs) + 2 * m, h: Math.max(...ys) - Math.min(...ys) + 2 * m + 110 }; // снизу — место под карточку навыка и легенду
  }, [clusters]);
  const [view, setView] = useState<View | null>(null);
  const v = view ?? fit;

  // ---- жесты: один палец — сдвиг, два — масштаб ----
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const pinch = useRef<{ dist: number; view: View } | null>(null);

  const scale = () => {
    const box = svgRef.current!.getBoundingClientRect();
    return Math.max(v.w / box.width, v.h / box.height);
  };
  const zoomAt = (factor: number, base: View = v) => {
    const nw = Math.min(fit.w * 2.5, Math.max(fit.w / 4, base.w * factor));
    const nh = (base.h / base.w) * nw;
    setView({ x: base.x + (base.w - nw) / 2, y: base.y + (base.h - nh) / 2, w: nw, h: nh });
  };

  const onDown = (e: PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), view: v };
    }
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      zoomAt(pinch.current.dist / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), pinch.current.view);
      moved.current += 10;
      return;
    }
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    moved.current += Math.abs(dx) + Math.abs(dy);
    const s = scale();
    setView({ ...v, x: v.x - dx * s, y: v.y - dy * s });
  };
  const onUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const tap = (id: string | null) => {
    if (moved.current < 8) setSelected(id);
  };

  const sel = selected ? clusters.flatMap((c) => c.stars).find((s) => s.node.id === selected) : undefined;
  const selArea = sel ? w.areaOf(sel.node.id) : undefined;
  const bg = useMemo(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 140 }, () => ({ x: fit.x + rnd() * fit.w, y: fit.y + rnd() * fit.h, r: 0.5 + rnd() * 0.9, o: 0.12 + rnd() * 0.25 }));
  }, [fit]);

  return (
    <div class="sky">
      <svg
        ref={svgRef}
        class="sky-svg"
        viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => { e.preventDefault(); zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15); }}
        onClick={() => tap(null)}
        role="img"
        aria-label="Созвездие навыков"
      >
        <defs>
          {clusters.map((c) => (
            <radialGradient id={`glow-${c.area.id}`} key={c.area.id}>
              <stop offset="0" stop-color={c.color} stop-opacity="0.55" />
              <stop offset="1" stop-color={c.color} stop-opacity="0" />
            </radialGradient>
          ))}
        </defs>
        {bg.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ECEDF1" opacity={s.o} />)}
        {clusters.map((c) => (
          <g key={c.area.id}>
            {c.stars.map((s) => <line key={s.node.id} x1={c.x} y1={c.y} x2={s.x} y2={s.y} stroke={c.color} stroke-opacity="0.28" stroke-width="1.2" />)}
            <circle cx={c.x} cy={c.y} r="4" fill={c.color} opacity="0.8" />
            <text x={c.x} y={c.y + (c.y > 0 ? -12 : 20)} text-anchor="middle" class="sky-area" fill={c.color}>{c.area.title.toUpperCase()}</text>
            {c.stars.map((s) => (
              <g key={s.node.id} class="sky-star" onClick={(e) => { e.stopPropagation(); tap(s.node.id); }}>
                <circle cx={s.x} cy={s.y} r={Math.max(s.r * 3, 16)} fill="transparent" />
                {s.fog ? (
                  <circle cx={s.x} cy={s.y} r="3" fill="none" stroke="#8B92A0" stroke-opacity="0.6" stroke-dasharray="2 2" />
                ) : (
                  <>
                    <circle cx={s.x} cy={s.y} r={s.r * 3} fill={`url(#glow-${c.area.id})`} opacity={s.rust ? 0.4 : 0.9} />
                    <circle cx={s.x} cy={s.y} r={s.r} fill={s.rust ? RUST : c.color} />
                    <circle cx={s.x} cy={s.y} r={Math.max(1, s.r * 0.4)} fill="#FFFFFF" opacity="0.9" />
                  </>
                )}
                {selected === s.node.id && <circle cx={s.x} cy={s.y} r={s.r + 7} fill="none" stroke="#F2B544" stroke-width="2" />}
                <text x={s.x} y={s.y + (s.fog ? 3 : s.r) + 13} text-anchor="middle" class={s.fog ? 'sky-label fog' : 'sky-label'} opacity={s.rust ? 0.6 : 1}>{s.node.title}</text>
              </g>
            ))}
          </g>
        ))}
      </svg>

      <div class="sky-legend"><span>● крупнее — выше уровень</span><span>◌ не начат</span><span class="rust">● давно не трогал</span></div>

      {sel && (
        <a class="sky-card" href={`#/skill/${sel.node.id}`}>
          <Ring pct={w.skillLevelOf(sel.node.id).pct} size={42} stroke={3} color={selArea?.color ?? '#F2B544'}><span class="sky-card-lvl">{sel.level}</span></Ring>
          <span class="stack-4 sky-card-text">
            <span class="strong">{sel.node.title}</span>
            <span class="small sky-card-sub">{w.pathOf(sel.node.id).slice(0, -1).map((n) => n.title).join(' › ')} · {w.skillLevelOf(sel.node.id).name}</span>
          </span>
          <span class="sky-card-open">Открыть →</span>
        </a>
      )}
    </div>
  );
}
