// Объёмное созвездие (мастер-план §12, решения 05.10.2026): раскладка в пространстве, проекция, масштаб к точке.
// Чистые функции — рисование и жесты в components/StarMap3D.tsx.

export interface V3 { x: number; y: number; z: number }
export interface Camera { yaw: number; pitch: number; zoom: number; panX: number; panY: number }
export interface Projected { x: number; y: number; /** множитель размера: ближе — больше */ s: number; /** 0 — дальний край, 1 — ближний */ depth: number }

export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.6;
export const PITCH_MAX = 1.3;
/** Радиус «неба» с направлениями и расстояние камеры до центра. */
export const SKY_R = 270;
const CAM_D = 640;

/** Точки равномерно по сфере (спираль Фибоначчи) — центры направлений. */
export function spherePoints(n: number, r: number): V3[] {
  if (n === 1) return [{ x: 0, y: 0, z: 0 }];
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const t = golden * i;
    return { x: Math.cos(t) * rad * r, y: y * r * 0.9, z: Math.sin(t) * rad * r };
  });
}

/** Навыки вокруг центра направления: небольшая сфера, плотнее при малом числе навыков. */
export function clusterPoints(center: V3, n: number, seed: number): V3[] {
  const r = 46 + Math.min(40, n * 4);
  return spherePoints(Math.max(n, 2), r).slice(0, n).map((p, i) => {
    // Чуть развернуть каждое созвездие по-своему, чтобы они не выглядели одинаково.
    const a = seed * 1.7 + i * 0.01;
    const x = p.x * Math.cos(a) - p.z * Math.sin(a);
    const z = p.x * Math.sin(a) + p.z * Math.cos(a);
    return { x: center.x + x, y: center.y + p.y, z: center.z + z };
  });
}

/** Поворот (рысканье, затем тангаж) и перспектива. w, h — размер холста в CSS-пикселях. */
export function project(p: V3, cam: Camera, w: number, h: number): Projected {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const y2 = p.y * cp - z1 * sp;
  const z2 = p.y * sp + z1 * cp;
  // Вписать небо в меньшую сторону холста.
  const fit = (Math.min(w, h) / (2 * SKY_R + 40)) * cam.zoom;
  const persp = CAM_D / (CAM_D + z2);
  const s = persp * fit;
  return {
    x: w / 2 + cam.panX + x1 * s,
    y: h / 2 + cam.panY + y2 * s,
    s,
    depth: Math.min(1, Math.max(0, 0.5 - z2 / (2 * (SKY_R + 120)))),
  };
}

export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
export const clampPitch = (p: number) => Math.min(PITCH_MAX, Math.max(-PITCH_MAX, p));

/** Масштаб к точке (mx, my — от центра холста): точка под пальцами остаётся на месте. */
export function zoomAt(cam: Camera, nextZoom: number, mx: number, my: number): Camera {
  const z = clampZoom(nextZoom);
  const k = z / cam.zoom;
  return { ...cam, zoom: z, panX: mx - (mx - cam.panX) * k, panY: my - (my - cam.panY) * k };
}

/** Фоновые звёзды: на большой сфере, вращаются медленнее (параллакс). */
export function backgroundStars(n: number, seed = 7): (V3 & { size: number; phase: number })[] {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => {
    const u = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u) * 900;
    return { x: Math.cos(t) * r, y: u * 900, z: Math.sin(t) * r, size: 0.4 + rnd() * 1.1, phase: rnd() * Math.PI * 2 };
  });
}

/** Вспышка закрытой ступени: две волны. t — секунды с начала; null — закончилась. */
export function flashWaves(t: number): { r: number; a: number }[] | null {
  if (t > 1.6) return null;
  const wave = (d: number) => {
    const k = (t - d) / 1.1;
    return k < 0 || k > 1 ? null : { r: 6 + k * 46, a: (1 - k) * 0.9 };
  };
  return [wave(0), wave(0.3)].filter((x): x is { r: number; a: number } => !!x);
}
