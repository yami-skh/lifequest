// Всплывашки: XP, новый уровень, достижения.
import { useEffect, useState } from 'preact/hooks';

export interface Toast { id: number; kind: 'xp' | 'level' | 'achievement' | 'info'; title: string; sub?: string }

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<(t: Toast[]) => void>();
const emit = () => listeners.forEach((l) => l(toasts));

export function toast(t: Omit<Toast, 'id'>) {
  const item = { ...t, id: nextId++ };
  toasts = [...toasts, item];
  emit();
  if (t.kind !== 'info') navigator.vibrate?.(t.kind === 'xp' ? 30 : [40, 60, 40]);
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== item.id);
    emit();
  }, t.kind === 'xp' ? 2600 : 4000);
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
