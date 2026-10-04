# Карта кода

Сгенерировано `npm run map` — не править руками, перегенерировать после изменений.
`имя:строка` — объявление верхнего уровня (`*` — экспорт). Читать кусок: Read с offset = строка.


## src

- **App.tsx** (131)
  *App:24, useGameEvents:79, Toasts:113

## src/components

- **AiGoals.tsx** (137) — «Предложить цели» — кнопка на навыке и шторка: запрос → ожидание → предпросмотр с галочками.
  WISHES:12, *AiGoalsButton:15, Phase:27, AiGoalsSheet:29
- **EntryCard.tsx** (83)
  Thumb:12, *EntryCard:17
- **FocusAndHints.tsx** (79) — Главный экран: «В фокусе» и «Ближайшее». ARCHITECTURE.md §16, идеи 1 и 5.
  *FocusBlock:7, *HintsBlock:37
- **Icon.tsx** (74) — Контурные иконки 24×24, цвет берут из currentColor.
  PATHS:3, *IconName:65, *Icon:67
- **InstallCard.tsx** (46)
  HIDE_KEY:6, *InstallCard:9
- **NumPad.tsx** (79) — Крупная цифровая клавиатура для весов, повторов и целей.
  *NumPadProps:7, parse:21, *fmtInput:22, *NumPad:24, *numFrom:75
- **RequirementsSheet.tsx** (123) — Настройка требований навыка. ARCHITECTURE.md §16, идея 4.
  PRESETS:9, *RequirementsSheet:11
- **SetsEditor.tsx** (106) — Тренировка подходами: «вес × повторы», + подход, «как в прошлый раз».
  Field:9, *setsText:11, *SetsEditor:13
- **ui.tsx** (128)
  *ProgressBar:9, *LevelBadge:17, *Ring:28, *AreaTile:49, *TopBar:58, *Sheet:73, *Confirm:100, *SectionLabel:114, *Check:123, *pctText:127

## src/data

- **changelog.ts** (137) — Что нового в версиях — для пользователя, простыми словами. Новые версии — сверху.
  *ChangeKind:4, *Change:5, *Release:6, *CHANGELOG:8, *SEEN_BEFORE_CHANGELOG:136

## src/db

- **actions.ts** (368) — Все изменения данных.
  *PhotoDraft:10, *EntryDraft:12, *primaryHistory:26, *saveEntry:33, *deleteEntry:80, *toggleGoal:92, *addGoal:99, *awardStages:108, *toggleFocus:132, *setRequirements:140, *deleteGoal:142, *addNode:146, *renameNode:158, *deleteNode:161, *addNote:179, *toggleNoteStudied:183, *deleteNote:188, *setAiCode:192, *setSeenVersion:193, *setName:194, *unlockAchievements:196, *resetAll:201, *createQuest:208, *toggleCustomStep:214, *abandonQuest:222, *deleteQuest:223, *completeQuest:226, *maintainQuests:240, *toggleWeeklyTemplate:265, *addMetric:280, *deleteMetric:285, bonus:294, *addMetricValue:305, *deleteMetricValue:347, *setMilestone:357, *removeMilestone:364, *fmtNum:367
- **db.ts** (240) — Хранилище на устройстве. ARCHITECTURE.md §11.
  *NodeKind:7, *Profile:9, *Requirement:27, *Node:29, *Goal:47, *Entry:59, *EntrySkill:76, *Photo:78, *Unlocked:80, *Note:82, *QuestKind:94, *CountRule:96, *QuestStep:106, *Quest:113, *Metric:132, *MetricValue:143, *Milestone:157, *AREA_ICON_BY_TITLE:172, *AREA_ICONS:176, LifeQuestDB:178, *db:231, *uid:234, *nowIso:239
- **seed.ts** (150) — Стартовый набор. ARCHITECTURE.md §13.
  G:7, SeedNode:8, t:17, p:18, *AREA_COLORS:20, TREE:22, *seedIfEmpty:71, STARTER_VERSION:110, STARTER_METRICS:112, *ensureStarter:121
- **world.ts** (412) — Всё состояние разом и производные значения. Данных у одного человека немного,
  *World:16, *loadWorld:30, *LockReason:47, *derive:58, .primaryOf:102, .subtreeXp:105, .areaOf:114, .pathOf:119, .skillLevelOf:140, .requirementsOf:143, .lockReasons:156, .stagesOfSkill:174, .openGoalsOf:177, .rustDays:189, .explored:195, .unlocksOf:200, .stepState:221, .questProgress:245, .metricInfo:259, .hints:277, .stats:317, *Derived:403, *WorldContext:405, *useWorld:407

## src/engine

- **achievements.ts** (77) — Достижения. ARCHITECTURE.md §7.
  *Stats:3, *AchievementIcon:27, *AchievementDef:32, flag:44, *ACHIEVEMENTS:46, *evaluateAchievements:71
- **dates.ts** (55) — Даты храним как локальные YYYY-MM-DD.
  *localDate:3, *addDays:10, *daysBetween:16, MONTHS:22, *humanDate:24, *currentStreak:32, *bestStreak:43
- **engine.test.ts** (189)
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
- **version.ts** (17) — Сравнение версий «0.5.1» и выбор того, что показать в «Что нового».
  *cmpVersion:3, *unseenReleases:14
- **xp.ts** (87) — Начисление XP за запись журнала. ARCHITECTURE.md §4.1–4.2.
  *EntryType:4, *Difficulty:5, *ENTRY_TYPES:7, *ENTRY_TYPE_LABEL:16, *BASE_XP:21, *DIFFICULTIES:25, *REPEAT_FREE_PER_DAY:32, *SECONDARY_SHARE:34, *XpContext:36, *RUST_DAYS:52, *XpFactor:54, *calcXp:56, *secondaryXp:71, *xpContextFromHistory:74

## src/lib

- **ai.ts** (41) — AI-помощник целей: запросы к серверу-посреднику (server/, Cloudflare Worker). Ключ Claude — только на сервере.
  *AI_URL:6, *AiGoal:8, *AiStage:9, *AiGoalsAnswer:10, *AiSkillInput:11, *AiError:19, call:25, *askGoals:37, *fetchQuota:40
- **backButton.ts** (60) — Системная кнопка «Назад» в APK: закрывает верхнее открытое (клавиатура, шторка, фото),
  stack:9, *useBackClose:12, EXIT_MS:26, exitArmedAt:27, *closeTop:30, *handleBack:37, *initBackButton:49
- **backup.ts** (171) — Резервная копия: всё в один .zip — data.json + фото. ARCHITECTURE.md §12.
  FORMAT:10, BackupData:12, *BackupSummary:31, summarize:33, *currentSummary:40, buildZip:45, toBase64:69, *exportBackup:81, download:111, *ParsedBackup:121, *readBackup:124, *restoreBackup:145
- **install.ts** (52) — Установка PWA: ловим событие beforeinstallprompt от Chrome и показываем свою кнопку.
  InstallPromptEvent:5, deferred:10, listeners:11, emit:12, *isStandalone:24, *isIos:28, *useInstall:30
- **photo.ts** (72) — Сжатие фото перед сохранением: основное до 1600px, превью до 320px. ARCHITECTURE.md §9.
  decode:5, resize:21, *compressPhoto:34, *usePhotoUrl:42, *useBlobUrl:62
- **router.ts** (27) — Простой роутер на hash: работает на GitHub Pages без настройки сервера.
  parse:4, *useRoute:6, *go:19, *back:23
- **theme.ts** (51) — Тема оформления: «как в системе» (по умолчанию), тёмная или светлая. Выбор — на устройстве (localStorage),
  *ThemePref:5, KEY:6, media:7, listeners:8, *getThemePref:10, apply:19, *setThemePref:25, *initTheme:35, *useThemePref:40, *ac:50
- **toast.ts** (66) — Всплывашки: XP, новый уровень, достижения.
  *ToastKind:5, *Toast:6, MERGE_MS:9, LIFETIME:10, RANK:11, toasts:13, nextId:14, lastGame:15, timers:16, listeners:17, emit:18, schedule:20, *toast:29, *useToasts:56
- **update.ts** (115) — Автообновление APK. Сайт обновляется сам (service worker), здесь — только приложение.
  *SITE:15, *Remote:16, *UpdateState:18, state:27, listeners:28, setState:29, *useUpdate:34, fetchRemote:43, *checkForUpdate:53, *installApk:80, *initUpdates:102

## src

- **main.tsx** (29)
  start:16

## src/screens

- **Achievements.tsx** (61)
  *Achievements:6
- **Backup.tsx** (193) — «Ещё» → «Резервная копия». Макет: холст, страница «Резервная копия».
  *Backup:14, agoText:144, *BackupReminder:152
- **Changelog.tsx** (107) — «Что нового»: окно один раз после обновления и история версий в «Ещё». Макет: холст, страница «Что нового».
  KIND:11, ORDER:16, fmtDate:18, changesWord:19, *WhatsNew:22, ChangeRow:60, *Changelog:70, ReleaseCard:85
- **Character.tsx** (149) — Главный экран — всё важное примерно в один экран. Макет: холст, страница «Упрощение», экран 1.
  *Character:13, WEEK_SHORT:78, TodayCard:81, *plural:142
- **EntrySheet.tsx** (283) — «＋ Запись» — главный сценарий, цель 15 секунд. Макет: холст, страница «Упрощение», экраны 2–3.
  *EntryPreset:18, LAST_TYPE:20, loadType:21, PhotoPreview:30, *EntrySheet:40, .setType:60, .choosePrimary:98, .addSecondary:107, .onFiles:114, .save:125
- **Journal.tsx** (45)
  *Journal:7
- **Metrics.tsx** (485) — Замеры и рубежи. Макет: холст, страница «Замеры и рубежи». ARCHITECTURE.md §8.
  Info:17, *MetricInfo:18, *metricToasts:20, *Sparkline:25, deltaText:41, *Metrics:47, *MilestoneCard:104, Chart:141, *MetricDetail:180, *usesSets:250, *lastSetsOf:253, *recordHintFor:261, *BigNumber:271, PhotoThumb:288, AddValueSheet:298, MilestoneSheet:352, bestRepsAtOf:425, NewMetricSheet:431, *SkillMetrics:468
- **More.tsx** (50)
  SOON:7, *More:15
- **Quests.tsx** (447) — Квесты. Макет: холст, страница «Квесты». ARCHITECTURE.md §6.
  KIND_TITLE:14, daysToMonday:16, *QuestCard:22, WeeklyRow:43, *Quests:64, *QuestDetail:148, stepKindLabel:228, DraftKind:232, NewQuestSheet:234, StepBuilder:313, *QuestsBlock:412
- **Settings.tsx** (216) — Настройки: персонаж, тема, недельные квесты, резервная копия, о приложении, стереть данные.
  THEMES:17, Toggle:23, Group:32, *Settings:41, AboutRow:116, hiddenThisSession:135, *UpdateCard:136, AiBlock:169
- **Skill.tsx** (436)
  *stagesToast:23, Fold:26, word:27, *Skill:31, .toggle:61, .onFocus:63, FoldRow:193, WorkoutCard:207, SkillMenu:242, GoalRow:279, Goals:292, Notes:371, GalleryItem:411, FullPhoto:416, Gallery:426
- **Tree.tsx** (289)
  Editor:13, loadExpanded:18, *Tree:26, .toggle:37, .skillCount:55, .skillsIn:58, .menuBtn:61, .renderChildren:67, .renderNode:77, KIND_LABEL:215, NodeEditor:217

## src/styles

- **base.css** (161) — Тёмная тема по макету: золото = XP, у направлений свои цвета.
  Тёмная тема по макету: золото = XP, у направлений свои цвета.:1, Светлая тема (макет: холст, «Настройки и обновления»). Соответствие цветов — tools/light_palette.py.:44, текст:108, раскладка:119, полоски:132, нижняя панель:139, всплывашки:147
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
- **more.css** (78) — резервная копия
  резервная копия:1, «скоро» в «Ещё»:21, достижения:28, что нового:40, настройки, тема, обновление (0.7):60
- **quests.css** (34) — квесты
  квесты:1
- **skill.css** (115) — навык
  навык:1, навык: фокус, требования, ступени:21, навык 0.6: шапка, тренировка, сворачиваемые блоки, меню ⋯:58, AI-помощник целей:93
- **tree.css** (86) — дерево
  дерево:1, дерево: направления-карточки, ветви-линии, навыки-узлы:20, вложенные ветки — короткий отступ, линия идёт от ромбика:38, туман: навык ещё не исследован:64, ржавчина: 60+ дней без записей:68
