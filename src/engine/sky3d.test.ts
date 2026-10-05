import { describe, expect, it } from 'vitest';
import { clampZoom, clusterPoints, flashWaves, project, spherePoints, zoomAt, ZOOM_MAX, ZOOM_MIN, type Camera } from './sky3d';

const cam: Camera = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };

describe('объёмное созвездие', () => {
  it('центры направлений — на сфере, без совпадений', () => {
    const pts = spherePoints(7, 200);
    for (const p of pts) expect(Math.hypot(p.x, p.y / 0.9, p.z)).toBeCloseTo(200, 0);
    expect(new Set(pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`)).size).toBe(7);
  });
  it('навыки — вокруг своего центра', () => {
    const c = { x: 100, y: -50, z: 30 };
    for (const p of clusterPoints(c, 5, 2)) expect(Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z)).toBeLessThan(100);
  });
  it('центр неба — в центре холста; ближняя звезда крупнее дальней', () => {
    const o = project({ x: 0, y: 0, z: 0 }, cam, 400, 600);
    expect([o.x, o.y]).toEqual([200, 300]);
    const near = project({ x: 0, y: 0, z: -150 }, cam, 400, 600);
    const far = project({ x: 0, y: 0, z: 150 }, cam, 400, 600);
    expect(near.s).toBeGreaterThan(far.s);
    expect(near.depth).toBeGreaterThan(far.depth);
  });
  it('поворот на 180° меняет ближнее и дальнее местами', () => {
    const p = { x: 0, y: 0, z: -150 };
    expect(project(p, { ...cam, yaw: Math.PI }, 400, 600).depth).toBeLessThan(0.5);
  });
  it('масштаб 0,6–2,6 и к точке: точка под пальцами остаётся на месте', () => {
    expect(clampZoom(5)).toBe(ZOOM_MAX);
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    const p = { x: 60, y: 40, z: 0 };
    const before = project(p, cam, 400, 600);
    const next = zoomAt(cam, 2, before.x - 200, before.y - 300);
    const after = project(p, next, 400, 600);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
  });
  it('вспышка: две волны, потом затихает', () => {
    expect(flashWaves(0.1)).toHaveLength(1);
    expect(flashWaves(0.5)).toHaveLength(2);
    expect(flashWaves(2)).toBeNull();
  });
});
