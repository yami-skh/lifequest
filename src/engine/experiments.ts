// Флаг экспериментов: новый UX включается только у тех, кто сам включил эксперимент
// (скрытый раздел «Настроек», 5 тапов по номеру версии). У брата по умолчанию всё выключено.
// В бете (версия X.Y.Z-beta.N) включено всё сразу — переключателей там нет.
import { isBeta } from './version';

/** Эта сборка — бета. */
export const IS_BETA = typeof __APP_VERSION__ === 'string' && isBeta(__APP_VERSION__);

/** Известные эксперименты: id → что включает. Новый UX за флагом добавлять сюда. */
export const EXPERIMENTS: { id: string; title: string; sub: string }[] = [
  { id: 'next-action', title: 'Следующее действие', sub: 'карточка «что сделать сейчас» на главном (фаза 2)' },
  { id: 'stars-3d', title: 'Созвездие в объёме', sub: 'Дерево → «Созвездие»: 3D, вращение пальцем, масштаб двумя (банк идей §12)' },
  { id: 'tree-clear', title: 'Понятное дерево', sub: 'этап и «дальше» в строке навыка, подсказка «?»; удержание и свайп — быстрое меню, перенос, порядок, архив, фильтры' },
  { id: 'compact', title: 'Компактное новое действие', sub: 'навык одной строкой, «Подробнее» и «Сохранить» внизу над клавиатурой' },
  { id: 'anim', title: 'Анимации прогресса', sub: '«+XP» летит к уровню, галочка цели рисуется, новый уровень — на весь экран' },
  { id: 'suggest', title: 'Подсказки при вводе', sub: 'в «Что сделал», целях, навыках, ветках, замерах и квестах — список готовых вариантов' },
  { id: 'friends', title: 'Друзья', sub: 'напарники по коду: итоги недели и реакции, без регистрации (нужен интернет)' },
  { id: 'templates', title: 'Готовые пути', sub: 'шаблоны навыков в Дереве и свой шаблон от нейросети (фаза 1)' },
];

/** Включён ли эксперимент. Список берётся из profile.experiments; в бете (beta = true) — всё включено. */
export const hasExp = (experiments: readonly string[] | undefined, name: string, beta = false) => beta || !!experiments?.includes(name);

/** Переключить эксперимент в списке (без повторов). */
export function toggleExp(experiments: readonly string[] | undefined, name: string): string[] {
  const list = experiments ?? [];
  return list.includes(name) ? list.filter((x) => x !== name) : [...list, name];
}
