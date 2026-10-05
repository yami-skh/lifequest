// Флаг экспериментов: новый UX включается только у тех, кто сам включил эксперимент
// (скрытый раздел «Настроек», 5 тапов по номеру версии). У брата по умолчанию всё выключено.

/** Известные эксперименты: id → что включает. Новый UX за флагом добавлять сюда. */
export const EXPERIMENTS: { id: string; title: string; sub: string }[] = [
  { id: 'next-action', title: 'Следующее действие', sub: 'карточка «что сделать сейчас» на главном (фаза 2)' },
];

/** Включён ли эксперимент. Список берётся из profile.experiments. */
export const hasExp = (experiments: readonly string[] | undefined, name: string) => !!experiments?.includes(name);

/** Переключить эксперимент в списке (без повторов). */
export function toggleExp(experiments: readonly string[] | undefined, name: string): string[] {
  const list = experiments ?? [];
  return list.includes(name) ? list.filter((x) => x !== name) : [...list, name];
}
