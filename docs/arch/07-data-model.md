# Модель данных

## 11. Модель данных

Хранилище: IndexedDB (через Dexie). Все id — строки UUID, даты — ISO.

```ts
Profile      { id, name: 'mildyan', createdAt, settings }

Node         { id, parentId | null, kind: 'area'|'branch'|'skill',
               title, icon, order, requires?: Requirement[], createdAt }

Goal         { id, skillId, kind: 'theory'|'practice',
               title, done: boolean, doneAt?, order }

Entry        { id, date, type: 'learn'|'practice'|'workout'|'project'|'course'|'teach'|'bonus',
               text, difficulty: 1|2|3, closedGoalIds: string[],
               outcome: 'ok'|'fail', failNote?, fixesEntryId?,
               photoIds: string[], createdAt }

EntrySkill   { entryId, skillId, role: 'primary'|'secondary', xp }

Photo        { id, blob: Blob, thumb: Blob, width, height, createdAt }

Quest        { id, title, kind: 'main'|'side'|'weekly',
               steps: { id, title, goalId?, done }[],
               rewardXp, rewardTitle?, deadline?, status: 'active'|'done'|'failed',
               completedAt? }

Achievement  { id, title, icon, rule, hidden: boolean, custom: boolean }
Unlocked     { achievementId, unlockedAt }

Metric       { id, title, unit, better: 'up'|'down', skillId? }
MetricValue  { id, metricId, date, value, note?, photoIds: string[] }

Milestone    { id, metricId, skillId?, title, start, target, deadline?,
               status: 'active'|'done', doneAt? }

Note         { id, skillId, kind: 'text'|'link'|'photo',
               body | url | photoId, studied?: boolean, createdAt }
```

**Производные значения не хранятся:** XP узлов, уровни, проценты, серии считаются на лету из `Entry`, `EntrySkill` и `Goal`.
XP записи (`EntrySkill.xp`) фиксируется при сохранении. Если потом поменять формулы, старые записи задним числом не пересчитаются.

Фото удаляются вместе с последней ссылкой на них (запись, замер или заметка).
