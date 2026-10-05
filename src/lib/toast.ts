// Всплывашки: XP, новый уровень, достижения.
// События, пришедшие почти одновременно (запись → рекорд → ступень → уровень), склеиваются в одну.
import { useEffect, useState } from 'preact/hooks';
import { buzz, play } from './sound';

export type ToastKind = 'xp' | 'level' | 'achievement' | 'info';
export interface Toast { id: number; kind: ToastKind; title: string; sub?: string; lines: string[] }

/** Окно, в котором события считаются «одновременными». */
const MERGE_MS = 1500;
const LIFETIME: Record<ToastKind, number> = { xp: 2600, info: 3000, level: 4000, achievement: 4000 };
const RANK: Record<ToastKind, number> = { info: 0, xp: 1, achievement: 2, level: 3 };

let toasts: Toast[] = [];
let nextId = 1;
let lastGame: { id: number; at: number } | null = null;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const listeners = new Set<(t: Toast[]) => void>();
const emit = () => listeners.forEach((l) => l(toasts));

const schedule = (id: number, ms: number) => {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id);
    timers.delete(id);
    emit();
  }, ms));
};

export function toast(t: { kind: ToastKind; title: string; sub?: string }) {
  const now = Date.now();
  const game = t.kind !== 'info';
  const target = game && lastGame && now - lastGame.at < MERGE_MS ? toasts.find((x) => x.id === lastGame!.id) : undefined;

  if (target) {
    // Дописываем строкой; карточка становится «важнее», если пришёл уровень или достижение.
    target.lines = [...target.lines, t.sub ? `${t.title} · ${t.sub}` : t.title];
    if (RANK[t.kind] > RANK[target.kind]) {
      target.kind = t.kind;
      play(t.kind === 'level' ? 'level' : 'record');
    }
    toasts = [...toasts];
    lastGame = { id: target.id, at: now };
    schedule(target.id, LIFETIME[target.kind] + 1000);
    buzz([40, 60, 40]);
    emit();
    return;
  }

  const item: Toast = { ...t, id: nextId++, lines: [] };
  toasts = [...toasts, item];
  if (game) {
    lastGame = { id: item.id, at: now };
    buzz(t.kind === 'xp' ? 30 : [40, 60, 40]);
    play(t.kind === 'xp' ? 'xp' : t.kind === 'level' ? 'level' : 'record');
  }
  schedule(item.id, LIFETIME[t.kind]);
  emit();
}

export function useToasts() {
  const [list, setList] = useState(toasts);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}
