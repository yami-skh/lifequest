// Звуки наград — генерируются Web Audio, без файлов. Настройки — на устройстве (localStorage).
import { useEffect, useState } from 'preact/hooks';

export interface SoundPrefs { sound: boolean; vibrate: boolean; volume: number }
const KEY = 'lq.sound';
const DEFAULTS: SoundPrefs = { sound: true, vibrate: true, volume: 0.6 };
const listeners = new Set<(p: SoundPrefs) => void>();

export function getSoundPrefs(): SoundPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function setSoundPrefs(patch: Partial<SoundPrefs>) {
  const next = { ...getSoundPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* не критично */
  }
  listeners.forEach((l) => l(next));
}

export function useSoundPrefs() {
  const [p, set] = useState(getSoundPrefs);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return p;
}

export type SoundKind = 'xp' | 'level' | 'record';
// Ноты (Гц) и длительности: xp — короткий «дзинь», record — два тона вверх, level — арпеджио-фанфара.
const MELODY: Record<SoundKind, [number, number][]> = {
  xp: [[988, 0.12], [1319, 0.18]],
  record: [[784, 0.12], [1047, 0.12], [1568, 0.26]],
  level: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.32]],
};

let ctx: AudioContext | null = null;

export function play(kind: SoundKind) {
  const p = getSoundPrefs();
  if (!p.sound || p.volume <= 0) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    let t = ctx.currentTime + 0.02;
    for (const [freq, dur] of MELODY[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25 * p.volume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur * 0.85;
    }
  } catch {
    /* звук не обязателен */
  }
}

export function buzz(pattern: number | number[]) {
  if (getSoundPrefs().vibrate) navigator.vibrate?.(pattern);
}
