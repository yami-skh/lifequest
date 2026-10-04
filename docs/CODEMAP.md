# Карта кода

Сгенерировано `npm run map` — не править руками, перегенерировать после изменений.
`имя:строка` — объявление верхнего уровня (`*` — экспорт). Читать кусок: Read с offset = строка.


## src

- **App.tsx** (126)
  *App:22, useGameEvents:74, Toasts:108

## src/components

- **EntryCard.tsx** (83)
  Thumb:12, *EntryCard:17
- **FocusAndHints.tsx** (78) — Главный экран: «В фокусе» и «Ближайшее». ARCHITECTURE.md §16, идеи 1 и 5.
  *FocusBlock:6, *HintsBlock:36
- **Icon.tsx** (73) — Контурные иконки 24×24, цвет берут из currentColor.
  PATHS:3, *IconName:64, *Icon:66
- **InstallCard.tsx** (46)
  HIDE_KEY:6, *InstallCard:9
- **NumPad.tsx** (77) — Крупная цифровая клавиатура для весов, повторов и целей.
  *NumPadProps:6, parse:20, *fmtInput:21, *NumPad:23, *numFrom:73
- **RequirementsSheet.tsx** (123) — Настройка требований навыка. ARCHITECTURE.md §16, идея 4.
  PRESETS:9, *RequirementsSheet:11
- **SetsEditor.tsx** (106) — Тренировка подходами: «вес × повторы», + подход, «как в прошлый раз».
  Field:9, *setsText:11, *SetsEditor:13
- **ui.tsx** (125)
  *ProgressBar:7, *LevelBadge:15, *Ring:26, *AreaTile:47, *TopBar:56, *Sheet:71, *Confirm:97, *SectionLabel:111, *Check:120, *pctText:124

## src/db

- **actions.ts** (366) — Все изменения данных.
  *PhotoDraft:10, *EntryDraft:12, *primaryHistory:26, *saveEntry:33, *deleteEntry:80, *toggleGoal:92, *addGoal:99, *awardStages:108, *toggleFocus:132, *setRequirements:140, *deleteGoal:142, *addNode:146, *renameNode:158, *deleteNode:161, *addNote:179, *toggleNoteStudied:183, *deleteNote:188, *setName:192, *unlockAchievements:194, *resetAll:199, *createQuest:206, *toggleCustomStep:212, *abandonQuest:220, *deleteQuest:221, *completeQuest:224, *maintainQuests:238, *toggleWeeklyTemplate:263, *addMetric:278, *deleteMetric:283, bonus:292, *addMetricValue:303, *deleteMetricValue:345, *setMilestone:355, *removeMilestone:362, *fmtNum:365
- **db.ts** (236) — Хранилище на устройстве. ARCHITECTURE.md §11.
  *NodeKind:7, *Profile:9, *Requirement:23, *Node:25, *Goal:43, *Entry:55, *EntrySkill:72, *Photo:74, *Unlocked:76, *Note:78, *QuestKind:90, *CountRule:92, *QuestStep:102, *Quest:109, *Metric:128, *MetricValue:139, *Milestone:153, *AREA_ICON_BY_TITLE:168, *AREA_ICONS:172, LifeQuestDB:174, *db:227, *uid:230, *nowIso:235
- **seed.ts** (150) — Стартовый набор. ARCHITECTURE.md §13.
  G:7, SeedNode:8, t:17, p:18, *AREA_COLORS:20, TREE:22, *seedIfEmpty:71, STARTER_VERSION:110, STARTER_METRICS:112, *ensureStarter:121
- **world.ts** (412) — Всё состояние разом и производные значения. Данных у одного человека немного,
  *World:16, *loadWorld:30, *LockReason:47, *derive:58, .primaryOf:102, .subtreeXp:105, .areaOf:114, .pathOf:119, .skillLevelOf:140, .requirementsOf:143, .lockReasons:156, .stagesOfSkill:174, .openGoalsOf:177, .rustDays:189, .explored:195, .unlocksOf:200, .stepState:221, .questProgress:245, .metricInfo:259, .hints:277, .stats:317, *Derived:403, *WorldContext:405, *useWorld:407

## src/engine

- **achievements.ts** (77) — Достижения. ARCHITECTURE.md §7.
  *Stats:3, *AchievementIcon:27, *AchievementDef:32, flag:44, *ACHIEVEMENTS:46, *evaluateAchievements:71
- **dates.ts** (55) — Даты храним как локальные YYYY-MM-DD.
  *localDate:3, *addDays:10, *daysBetween:16, MONTHS:22, *humanDate:24, *currentStreak:32, *bestStreak:43
- **engine.test.ts** (175)
- **levels.ts** (44) — Уровни персонажа и навыков. ARCHITECTURE.md §4.3–4.4.
  *xpToNext:3, *characterLevel:5, *SKILL_LEVELS:17, *skillLevel:31
- **metrics.ts** (88) — Замеры, рекорды, прогноз рубежа. ARCHITECTURE.md §8.
  *RECORD_XP:4, *MILESTONE_XP:5, *ValueLike:7, *WorkSet:10, *bestSet:16, *valueFromSets:26, *bestRepsAt:33, *bestValue:43, *isRecord:53, *reached:60, *milestoneProgress:63, *forecastDate:72
- **progress.ts** (44) — Одна полоска прогресса. ARCHITECTURE.md §3.
  *GoalKind:3, *GOAL_WEIGHT:4, *GoalLike:6, *skillProgress:8, *NodeLike:19, *computeProgress:22
- **quests.ts** (47) — Квесты: шаблоны недельных, прогресс шагов. ARCHITECTURE.md §6.
  *QUEST_STEP_XP:4, *weekStart:7, *WeeklyTemplate:13, *WEEKLY_TEMPLATES:21, *EntryFacts:27, *countProgress:30
- **stages.ts** (51) — Ступени целей навыка. ARCHITECTURE.md §16, идея 2.
  *STAGE_NAMES:4, *stageName:5, *STAGE_BONUS:7, *StagedGoal:9, *StageInfo:11, *stagesOf:21, *currentStage:34, *assignStages:40
- **xp.ts** (87) — Начисление XP за запись журнала. ARCHITECTURE.md §4.1–4.2.
  *EntryType:4, *Difficulty:5, *ENTRY_TYPES:7, *ENTRY_TYPE_LABEL:16, *BASE_XP:21, *DIFFICULTIES:25, *REPEAT_FREE_PER_DAY:32, *SECONDARY_SHARE:34, *XpContext:36, *RUST_DAYS:52, *XpFactor:54, *calcXp:56, *secondaryXp:71, *xpContextFromHistory:74

## src/lib

- **backup.ts** (171) — Резервная копия: всё в один .zip — data.json + фото. ARCHITECTURE.md §12.
  FORMAT:10, BackupData:12, *BackupSummary:31, summarize:33, *currentSummary:40, buildZip:45, toBase64:69, *exportBackup:81, download:111, *ParsedBackup:121, *readBackup:124, *restoreBackup:145
- **install.ts** (52) — Установка PWA: ловим событие beforeinstallprompt от Chrome и показываем свою кнопку.
  InstallPromptEvent:5, deferred:10, listeners:11, emit:12, *isStandalone:24, *isIos:28, *useInstall:30
- **photo.ts** (72) — Сжатие фото перед сохранением: основное до 1600px, превью до 320px. ARCHITECTURE.md §9.
  decode:5, resize:21, *compressPhoto:34, *usePhotoUrl:42, *useBlobUrl:62
- **router.ts** (27) — Простой роутер на hash: работает на GitHub Pages без настройки сервера.
  parse:4, *useRoute:6, *go:19, *back:23
- **toast.ts** (66) — Всплывашки: XP, новый уровень, достижения.
  *ToastKind:5, *Toast:6, MERGE_MS:9, LIFETIME:10, RANK:11, toasts:13, nextId:14, lastGame:15, timers:16, listeners:17, emit:18, schedule:20, *toast:29, *useToasts:56

## src

- **main.tsx** (19)
  start:8

## src/screens

- **Achievements.tsx** (61)
  *Achievements:6
- **Backup.tsx** (193) — «Ещё» → «Резервная копия». Макет: холст, страница «Резервная копия».
  *Backup:14, agoText:144, *BackupReminder:152
- **Character.tsx** (147) — Главный экран — всё важное примерно в один экран. Макет: холст, страница «Упрощение», экран 1.
  *Character:11, WEEK_SHORT:76, TodayCard:79, *plural:140
- **EntrySheet.tsx** (281) — «＋ Запись» — главный сценарий, цель 15 секунд. Макет: холст, страница «Упрощение», экраны 2–3.
  *EntryPreset:17, LAST_TYPE:19, loadType:20, PhotoPreview:29, *EntrySheet:39, .setType:59, .choosePrimary:97, .addSecondary:106, .onFiles:113, .save:124
- **Journal.tsx** (45)
  *Journal:7
- **Metrics.tsx** (483) — Замеры и рубежи. Макет: холст, страница «Замеры и рубежи». ARCHITECTURE.md §8.
  Info:16, *metricToasts:18, Sparkline:23, deltaText:39, *Metrics:45, MilestoneCard:102, Chart:139, *MetricDetail:178, *usesSets:248, *lastSetsOf:251, *recordHintFor:259, *BigNumber:269, PhotoThumb:286, AddValueSheet:296, MilestoneSheet:350, bestRepsAtOf:423, NewMetricSheet:429, *SkillMetrics:466
- **More.tsx** (75)
  SOON:9, *More:18
- **Quests.tsx** (447) — Квесты. Макет: холст, страница «Квесты». ARCHITECTURE.md §6.
  KIND_TITLE:14, daysToMonday:16, *QuestCard:22, WeeklyRow:43, *Quests:64, *QuestDetail:148, stepKindLabel:228, DraftKind:232, NewQuestSheet:234, StepBuilder:313, *QuestsBlock:412
- **Skill.tsx** (302)
  Tab:17, TABS:19, *stagesToast:21, *Skill:24, GoalRow:146, Goals:159, Notes:238, GalleryItem:278, FullPhoto:283, Gallery:292
- **Tree.tsx** (288)
  Editor:12, loadExpanded:17, *Tree:25, .toggle:36, .skillCount:54, .skillsIn:57, .menuBtn:60, .renderChildren:66, .renderNode:76, KIND_LABEL:214, NodeEditor:216

## src/styles

- **base.css** (96) — Тёмная тема по макету: золото = XP, у направлений свои цвета.
  Тёмная тема по макету: золото = XP, у направлений свои цвета.:1, текст:43, раскладка:54, полоски:67, нижняя панель:74, всплывашки:82
- **common.css** (90) — записи
  записи:1, чипы:16, кнопки:26, поля:43, фото:53, шторка:65
- **entry.css** (50) — шторка записи (0.5)
  шторка записи (0.5):1, подходы и клавиатура (0.5):16
- **home.css** (60) — главный: фокус и подсказки
  главный: фокус и подсказки:1, установка:13, персонаж:17, главный, компактный (0.5):31
- **index.css** (11) — Порядок важен: база → общие компоненты → экраны.
  Порядок важен: база → общие компоненты → экраны.:1
- **metrics.css** (35) — замеры
  замеры:1
- **more.css** (39) — резервная копия
  резервная копия:1, «скоро» в «Ещё»:21, достижения:28
- **quests.css** (34) — квесты
  квесты:1
- **skill.css** (57) — навык
  навык:1, навык: фокус, требования, ступени:21
- **tree.css** (86) — дерево
  дерево:1, дерево: направления-карточки, ветви-линии, навыки-узлы:20, вложенные ветки — короткий отступ, линия идёт от ромбика:38, туман: навык ещё не исследован:64, ржавчина: 60+ дней без записей:68
