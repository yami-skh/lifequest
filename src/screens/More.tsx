import { useWorld } from '../db/world';
import { evaluateAchievements } from '../engine/achievements';
import { Icon } from '../components/Icon';
import { SectionLabel } from '../components/ui';

/** Будущие фичи (ARCHITECTURE.md §16 и «Отложено» в роудмапе). */
const SOON: [string, string, string][] = [
  ['star', 'Созвездие навыков', 'дерево в виде звёздной карты'],
  ['bulb', 'AI-помощник целей', 'цели и ступени для нового навыка одной кнопкой'],
  ['book', 'Шаблоны веток', 'гитара, вождение, первая помощь и другие'],
  ['voice', 'Запись своими словами', '«пожал 50×10×3» — и всё заполнится само'],
  ['crown', 'Класс и титулы', 'кто ты по прокачке: воин, маг, ремесленник…'],
  ['brush', 'Новый стиль «Ателье»', 'оформление в духе Persona и Metaphor'],
];

export function More() {
  const w = useWorld();
  const have = new Set(w.unlocked.map((u) => u.achievementId));
  const done = evaluateAchievements(w.stats()).filter((a) => a.done || have.has(a.def.id)).length;

  return (
    <div class="page">
      <h1 class="display small-display">Ещё</h1>

      <div class="stack-8">
        <a class="menu-item" href="#/settings"><Icon name="settings" />Настройки<span class="menu-meta" /></a>
        <a class="menu-item" href="#/journal"><Icon name="journal" />Журнал<span class="menu-meta">{w.entries.filter((e) => e.type !== 'bonus').length}</span></a>
        <a class="menu-item" href="#/achievements"><Icon name="trophy" />Достижения<span class="menu-meta">{done}</span></a>
        <a class="menu-item" href="#/quests"><Icon name="sword" />Квесты<span class="menu-meta">{w.quests.filter((q) => q.status === 'active').length}</span></a>
        <a class="menu-item" href="#/metrics"><Icon name="chart" />Замеры и рубежи<span class="menu-meta">{w.metrics.length}</span></a>
        <a class="menu-item" href="#/changelog"><Icon name="star" />Что нового<span class="menu-meta">{__APP_VERSION__}</span></a>
        <a class="menu-item" href="#/backup"><Icon name="shield" />Резервная копия<span class="menu-meta">{w.profile?.lastBackupAt ? '' : 'не было'}</span></a>
      </div>

      <section class="stack-8">
        <SectionLabel>Скоро</SectionLabel>
        {SOON.map(([icon, title, sub]) => (
          <div class="menu-item disabled soon" key={title}>
            <Icon name={icon} />
            <span class="soon-text"><span>{title}</span><span class="muted small">{sub}</span></span>
            <span class="soon-tag">скоро</span>
          </div>
        ))}
      </section>

      <p class="muted small center">LifeQuest · версия {__APP_VERSION__}</p>

    </div>
  );
}
