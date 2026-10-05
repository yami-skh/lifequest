// Объёмное созвездие (мастер-план §12, решения 05.10.2026; флаг stars-3d, только бета).
// Глубина: дальние звёзды меньше и тусклее; фон с параллаксом; туманности направлений; вспышка в две волны при закрытой ступени.
// Жесты: один палец — вращать (с инерцией), два — масштаб 0,6–2,6× к точке между пальцами и сдвиг, двойной тап — сброс.
// Медленное автовращение (выключается). «Уменьшение движения» — без автовращения, инерции, мерцания и вспышек. Canvas, без библиотек.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { backgroundStars, clampPitch, clampZoom, clusterPoints, flashWaves, project, spherePoints, SKY_R, zoomAt, type Camera, type Projected, type V3 } from '../engine/sky3d';
import { Ring } from './ui';
import { useSkyHeight } from './StarMap';

type State = 'done' | 'normal' | 'fog' | 'rust' | 'locked';
interface Star3 { id: string; title: string; areaId: string; color: string; p: V3; r: number; level: number; state: State; focus: boolean }
interface Area3 { id: string; title: string; color: string; c: V3 }

const RUST = '#C98A5A';
const HOME: Camera = { yaw: -0.5, pitch: -0.25, zoom: 1, panX: 0, panY: 0 };
const AUTO_KEY = 'lq.skyAuto';
const FONT = '"Manrope Variable", Manrope, sans-serif';

const loadAuto = () => {
  try {
    return localStorage.getItem(AUTO_KEY) !== 'off';
  } catch {
    return true;
  }
};

export function StarMap3D() {
  const w = useWorld();
  const skyRef = useRef<HTMLDivElement>(null);
  useSkyHeight(skyRef);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [auto, setAutoState] = useState(loadAuto);
  const reduce = useMemo(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  // ---- сцена из данных ----
  const scene = useMemo(() => {
    const centers = spherePoints(w.areas.length, SKY_R);
    const areas: Area3[] = w.areas.map((a, i) => ({ id: a.id, title: a.title, color: a.color ?? '#A3A9B6', c: centers[i] }));
    const stars: Star3[] = areas.flatMap((a, ai) => {
      const skills = w.skills.filter((s) => w.areaOf(s.id)?.id === a.id);
      const pts = clusterPoints(a.c, skills.length, ai + 1);
      return skills.map((n, k) => {
        const goals = w.goalsBySkill.get(n.id) ?? [];
        const lv = w.skillLevelOf(n.id);
        const state: State = w.lockReasons(n).length ? 'locked'
          : goals.length && goals.every((g) => g.done) ? 'done'
          : !w.explored(n.id) ? 'fog'
          : w.rustDays(n.id) !== null ? 'rust' : 'normal';
        return { id: n.id, title: n.title, areaId: a.id, color: a.color, p: pts[k], r: 2.6 + lv.level * 0.8, level: lv.level, state, focus: !!n.focus };
      });
    });
    const byId = new Map(stars.map((s) => [s.id, s]));
    const links = w.skills.flatMap((n) => (n.requires ?? []).map((r) => [byId.get(r.nodeId), byId.get(n.id)] as const)).filter((l): l is readonly [Star3, Star3] => !!l[0] && !!l[1]);
    return { areas, stars, links };
  }, [w]);
  const bg = useMemo(() => backgroundStars(220), []);

  // ---- изменяемое состояние без перерисовки Preact ----
  const cam = useRef<Camera>({ ...HOME });
  const vel = useRef({ yaw: 0, pitch: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; pinch?: { dist: number; zoom: number; mx: number; my: number; cam: Camera }; lastTap?: { t: number; x: number; y: number } }>({ moved: 0 });
  const projected = useRef<{ star: Star3; pr: Projected }[]>([]);
  const flashes = useRef<{ id: string; t0: number }[]>([]);
  const born = useRef(performance.now());
  const sel = useRef<string | null>(null);
  sel.current = selected;
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  // Закрытая ступень → вспышка у звезды (только на новые, не при открытии экрана).
  const awarded = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    const now = new Map(w.skills.map((n) => [n.id, n.stagesAwarded?.length ?? 0]));
    if (awarded.current && !reduce) {
      for (const [id, k] of now) if (k > (awarded.current.get(id) ?? 0)) flashes.current.push({ id, t0: performance.now() });
    }
    awarded.current = now;
  }, [w, reduce]);

  // ---- цикл рисования ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H) return;
      const c = cam.current;
      const dragging = pointers.current.size > 0;
      if (!dragging) {
        if (!reduce) {
          c.yaw += vel.current.yaw;
          c.pitch = clampPitch(c.pitch + vel.current.pitch);
          vel.current.yaw *= 0.94;
          vel.current.pitch *= 0.94;
        }
        if (autoRef.current && !reduce && Math.abs(vel.current.yaw) < 0.0005) c.yaw += 0.0016;
      }
      const t = now / 1000;
      const { areas, stars, links } = sceneRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Фон: медленнее основного неба — параллакс; мерцание.
      const bgCam: Camera = { yaw: c.yaw * 0.3, pitch: c.pitch * 0.3, zoom: 1, panX: 0, panY: 0 };
      for (const b of bg) {
        const pr = project(b, bgCam, W, H);
        if (pr.depth < 0.5) continue;
        const tw = reduce ? 1 : 0.7 + 0.3 * Math.sin(t * 1.3 + b.phase);
        ctx.globalAlpha = (0.12 + 0.3 * pr.depth) * tw;
        ctx.fillStyle = '#ECEDF1';
        ctx.fillRect(pr.x, pr.y, b.size, b.size);
      }

      const pa = new Map(areas.map((a) => [a.id, project(a.c, c, W, H)]));
      // Туманности направлений.
      for (const a of areas) {
        const pr = pa.get(a.id)!;
        const rad = 120 * pr.s;
        const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, rad);
        g.addColorStop(0, a.color);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.08 + 0.12 * pr.depth;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      const list = stars.map((star) => ({ star, pr: project(star.p, c, W, H) }));
      const ps = new Map(list.map((x) => [x.star.id, x.pr]));
      // Линии: центр направления → навык; требования — пунктиром.
      ctx.lineWidth = 1;
      for (const { star, pr } of list) {
        const ca = pa.get(star.areaId)!;
        ctx.globalAlpha = 0.1 + 0.25 * Math.min(pr.depth, ca.depth);
        ctx.strokeStyle = star.color;
        ctx.beginPath();
        ctx.moveTo(ca.x, ca.y);
        ctx.lineTo(pr.x, pr.y);
        ctx.stroke();
      }
      ctx.setLineDash([3, 4]);
      for (const [from, to] of links) {
        const a = ps.get(from.id)!, b = ps.get(to.id)!;
        ctx.globalAlpha = 0.2 + 0.4 * Math.min(a.depth, b.depth);
        ctx.strokeStyle = '#ECEDF1';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Звёзды: дальние первыми.
      list.sort((a, b) => a.pr.depth - b.pr.depth);
      const age = (now - born.current) / 1000;
      list.forEach(({ star, pr }, i) => {
        const appear = reduce ? 1 : Math.min(1, Math.max(0, (age - i * 0.025) / 0.6));
        if (appear <= 0) return;
        const r = star.r * pr.s * 1.6 * (0.6 + 0.4 * appear);
        const fade = (0.35 + 0.65 * pr.depth) * appear;
        const col = star.state === 'rust' ? RUST : star.state === 'locked' ? '#5A6070' : star.color;
        if (star.state === 'fog' || star.state === 'locked') {
          ctx.globalAlpha = fade * 0.7;
          ctx.strokeStyle = col === star.color ? '#8B92A0' : col;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, Math.max(2.5, r * 0.8), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const glow = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, r * 3.2);
          glow.addColorStop(0, col);
          glow.addColorStop(1, 'transparent');
          ctx.globalAlpha = fade * (star.state === 'rust' ? 0.35 : 0.75);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, r * 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = fade;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, Math.max(0.8, r * 0.4), 0, Math.PI * 2);
          ctx.fill();
          if (star.state === 'done') {
            ctx.strokeStyle = '#F2B544';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(pr.x, pr.y, r + 4 * pr.s, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
          }
        }
        if (star.focus) {
          ctx.globalAlpha = fade;
          ctx.fillStyle = '#F2B544';
          ctx.beginPath();
          ctx.arc(pr.x + r + 3, pr.y - r - 3, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (sel.current === star.id) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#F2B544';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, r + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        // Подписи — у ближних и у выбранной.
        if (pr.depth > 0.5 || sel.current === star.id) {
          ctx.globalAlpha = Math.min(1, (pr.depth - 0.45) * 3) * appear * (star.state === 'rust' ? 0.6 : 1);
          if (sel.current === star.id) ctx.globalAlpha = 1;
          ctx.fillStyle = star.state === 'fog' ? '#8B92A0' : '#ECEDF1';
          ctx.font = `600 ${Math.round(10 + 2 * pr.depth)}px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText(star.title, pr.x, pr.y + r + 13);
        }
      });
      projected.current = list;

      // Названия направлений.
      for (const a of areas) {
        const pr = pa.get(a.id)!;
        ctx.globalAlpha = 0.3 + 0.6 * pr.depth;
        ctx.fillStyle = a.color;
        ctx.font = `800 ${Math.round(10 + 2 * pr.depth)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(a.title.toUpperCase(), pr.x, pr.y - 90 * pr.s);
      }

      // Вспышки закрытых ступеней: две волны.
      flashes.current = flashes.current.filter((f) => {
        const waves = flashWaves((now - f.t0) / 1000);
        const pr = ps.get(f.id);
        if (!waves || !pr) return !!waves;
        for (const wv of waves) {
          ctx.globalAlpha = wv.a;
          ctx.strokeStyle = '#F2B544';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, wv.r * pr.s * 1.6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
        return true;
      });
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [bg, reduce]);

  // ---- жесты ----
  const local = (e: PointerEvent) => {
    const box = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, h: box.height };
  };
  const onDown = (e: PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    vel.current = { yaw: 0, pitch: 0 };
    if (pointers.current.size === 1) gesture.current.moved = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const box = canvasRef.current!.getBoundingClientRect();
      gesture.current.pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.current.zoom,
        mx: (a.x + b.x) / 2 - box.left - box.width / 2, my: (a.y + b.y) / 2 - box.top - box.height / 2, cam: { ...cam.current },
      };
    }
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2 && g.pinch) {
      const [a, b] = [...pointers.current.values()];
      const box = canvasRef.current!.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - box.left - box.width / 2;
      const my = (a.y + b.y) / 2 - box.top - box.height / 2;
      // Масштаб к исходной точке между пальцами + сдвиг вслед за ней.
      const z = zoomAt(g.pinch.cam, g.pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.pinch.dist)), g.pinch.mx, g.pinch.my);
      cam.current = { ...cam.current, zoom: z.zoom, panX: z.panX + (mx - g.pinch.mx), panY: z.panY + (my - g.pinch.my) };
      g.moved += 10;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    g.moved += Math.abs(dx) + Math.abs(dy);
    const k = 0.006 / cam.current.zoom;
    cam.current.yaw += dx * k;
    cam.current.pitch = clampPitch(cam.current.pitch - dy * k);
    vel.current = { yaw: dx * k, pitch: -dy * k };
  };
  const onUp = (e: PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) g.pinch = undefined;
    if (pointers.current.size > 0 || g.moved >= 8) return;
    // Тап: двойной — сброс вида, одиночный — выбрать ближайшую звезду.
    const p = local(e);
    const now = performance.now();
    if (g.lastTap && now - g.lastTap.t < 320 && Math.hypot(p.x - g.lastTap.x, p.y - g.lastTap.y) < 30) {
      cam.current = { ...HOME, yaw: cam.current.yaw };
      vel.current = { yaw: 0, pitch: 0 };
      g.lastTap = undefined;
      return;
    }
    g.lastTap = { t: now, x: p.x, y: p.y };
    let best: { id: string; d: number } | null = null;
    for (const { star, pr } of projected.current) {
      const d = Math.hypot(pr.x - p.x, pr.y - p.y);
      if (d < Math.max(22, star.r * pr.s * 3) && (!best || d < best.d)) best = { id: star.id, d };
    }
    setSelected(best?.id ?? null);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = local(e as unknown as PointerEvent);
    cam.current = zoomAt(cam.current, clampZoom(cam.current.zoom * (e.deltaY > 0 ? 1 / 1.12 : 1.12)), p.x - p.w / 2, p.y - p.h / 2);
  };
  const setAuto = (v: boolean) => {
    setAutoState(v);
    try {
      localStorage.setItem(AUTO_KEY, v ? 'on' : 'off');
    } catch {
      /* не критично */
    }
  };

  const selStar = selected ? scene.stars.find((s) => s.id === selected) : undefined;
  return (
    <div class="sky" ref={skyRef}>
      <canvas
        ref={canvasRef}
        class="sky-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={(e) => { pointers.current.delete(e.pointerId); gesture.current.pinch = undefined; }}
        onWheel={onWheel}
        role="img"
        aria-label="Созвездие навыков в объёме: один палец — вращать, два — масштаб, двойной тап — сброс"
      />
      {!reduce && (
        <button type="button" class={auto ? 'sky-auto on' : 'sky-auto'} aria-pressed={auto} onClick={() => setAuto(!auto)}>
          {auto ? '⟳ вращение' : '⟳ стоп'}
        </button>
      )}
      <div class="sky-legend"><span>● крупнее — выше уровень</span><span>◌ не начат</span><span class="done">◎ пройден</span><span class="rust">● давно не трогал</span></div>
      {selStar && (
        <a class="sky-card" href={`#/skill/${selStar.id}`}>
          <Ring pct={w.skillLevelOf(selStar.id).pct} size={42} stroke={3} color={selStar.color}><span class="sky-card-lvl">{selStar.level}</span></Ring>
          <span class="stack-4 sky-card-text">
            <span class="strong">{selStar.title}</span>
            <span class="small sky-card-sub">{w.pathOf(selStar.id).slice(0, -1).map((n) => n.title).join(' › ')} · {w.skillLevelOf(selStar.id).name}</span>
          </span>
          <span class="sky-card-open">Открыть →</span>
        </a>
      )}
    </div>
  );
}
