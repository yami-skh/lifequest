import { useState } from 'preact/hooks';
import { useWorld } from '../db/world';
import { resetAll, setName } from '../db/actions';
import { evaluateAchievements } from '../engine/achievements';
import { Icon } from '../components/Icon';
import { Confirm, SectionLabel } from '../components/ui';

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
  const [name, setNameDraft] = useState(w.profile?.name ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  const have = new Set(w.unlocked.map((u) => u.achievementId));
  const done = evaluateAchievements(w.stats()).filter((a) => a.done || have.has(a.def.id)).length;

  return (
    <div class="page">
      <h1 class="display small-display">Ещё</h1>

      <div class="stack-8">
        <a class="menu-item" href="#/journal"><Icon name="journal" />Журнал<span class="menu-meta">{w.entries.filter((e) => e.type !== 'bonus').length}</span></a>
        <a class="menu-item" href="#/achievements"><Icon name="trophy" />Достижения<span class="menu-meta">{done}</span></a>
        <a class="menu-item" href="#/quests"><Icon name="sword" />Квесты<span class="menu-meta">{w.quests.filter((q) => q.status === 'active').length}</span></a>
        <a class="menu-item" href="#/metrics"><Icon name="chart" />Замеры и рубежи<span class="menu-meta">{w.metrics.length}</span></a>
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

      <section class="stack-8">
        <SectionLabel>Персонаж</SectionLabel>
        <form class="input-row" onSubmit={(e) => { e.preventDefault(); setName(name); }}>
          <input id="profile-name" class="input" value={name} onInput={(e) => setNameDraft(e.currentTarget.value)} aria-label="Имя персонажа" />
          <button type="submit" class="btn ghost" disabled={name.trim() === (w.profile?.name ?? '')}>Сохранить</button>
        </form>
      </section>

      <section class="stack-8">
        <SectionLabel>Данные</SectionLabel>
        <p class="muted small">Всё хранится только на этом устройстве. Сохраняй резервную копию, чтобы не потерять записи.</p>
        <button type="button" class="btn ghost danger-text" onClick={() => setConfirmReset(true)}>Стереть все данные</button>
      </section>

      <p class="muted small center">LifeQuest · версия {__APP_VERSION__}</p>

      <Confirm
        open={confirmReset}
        title="Стереть все данные?"
        text="Пропадут все записи, фото, XP и изменения в дереве. Отменить нельзя."
        action="Стереть"
        onConfirm={resetAll}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}
