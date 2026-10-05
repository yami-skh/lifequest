// Анимации реального прогресса (мастер-план «Анимации реального прогресса»; макет: холст, «Анимации прогресса»).
// Шина событий: экраны сообщают «получен XP» / «новый уровень», слой components/Fx.tsx рисует.
// Только реальный прогресс: XP за действие и бонус этапа, новый уровень. Закрытие цели вручную XP не даёт — без «+XP».

export type FxEvent =
  | { kind: 'xp'; amount: number; badges?: string[] }
  | { kind: 'level'; level: number; from: number; left: number };

type Listener = (e: FxEvent) => void;
const listeners = new Set<Listener>();

export const onFx = (l: Listener) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const fx = (e: FxEvent) => listeners.forEach((l) => l(e));

// Тихий режим: данные подменили целиком (восстановление копии/снимка) — уровень «вырос» не от действий,
// поэтому ни анимации, ни всплывашки «Новый уровень» в ближайшие секунды.
let quietUntil = 0;
export const quietFx = (ms = 4000) => { quietUntil = Date.now() + ms; };
export const isFxQuiet = () => Date.now() < quietUntil;
