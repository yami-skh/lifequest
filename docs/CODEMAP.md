# Карта кода

Сгенерировано `npm run map` — не править руками, перегенерировать после изменений.
`имя:строка` — объявление верхнего уровня (`*` — экспорт). Читать кусок: Read с offset = строка.


## src

- **App.tsx** (133)
  *App:25, useGameEvents:81, Toasts:115

## src/components

- **AiGoals.tsx** (137) — «Предложить цели» — кнопка на навыке и шторка: запрос → ожидание → предпросмотр с галочками.
  WISHES:12, *AiGoalsButton:15, Phase:27, AiGoalsSheet:29
- **EntryCard.tsx** (83)
  Thumb:12, *EntryCard:17
- **FocusAndHints.tsx** (79) — Главный экран: «В фокусе» и «Ближайшее». ARCHITECTURE.md §16, идеи 1 и 5.
  *FocusBlock:7, *HintsBlock:37
- **Icon.tsx** (75) — Контурные иконки 24×24, цвет берут из currentColor.
  PATHS:3, *IconName:66, *Icon:68
- **InstallCard.tsx** (46)
  HIDE_KEY:6, *InstallCard:9
- **NumPad.tsx** (79) — Крупная цифровая клавиатура для весов, повторов и целей.
  *NumPadProps:7, parse:21, *fmtInput:22, *NumPad:24, *numFrom:75
- **Reminders.tsx** (97) — Звуки и напоминания: блок настроек, окно «Включить напоминания?» и синхронизация расписания.
  Switch:9, *SoundSettings:19, *ReminderSettings:35, *ReminderPrompt:67, *ReminderSync:87
- **RequirementsSheet.tsx** (123) — Настройка требований навыка. ARCHITECTURE.md §16, идея 4.
  PRESETS:9, *RequirementsSheet:11
- **SetsEditor.tsx** (106) — Тренировка подходами: «вес × повторы», + подход, «как в прошлый раз».
  Field:9, *setsText:11, *SetsEditor:13
- **StarMap.tsx** (181) — Созвездие навыков: второй вид дерева (§16, идея 11). Макет: холст, «Созвездие и напоминания».
  Star:9, Cluster:10, View:11, RUST:13, *StarMap:15, .scale:65, .zoomAt:69, .onDown:75, .onMove:84, .onUp:100, .tap:104
- **ui.tsx** (128)
  *ProgressBar:9, *LevelBadge:17, *Ring:28, *AreaTile:49, *TopBar:58, *Sheet:73, *Confirm:100, *SectionLabel:114, *Check:123, *pctText:127

## src/data

- **changelog.ts** (168) — Что нового в версиях — для пользователя, простыми словами. Новые версии — сверху.
  *ChangeKind:4, *Change:5, *Release:6, *CHANGELOG:8, *SEEN_BEFORE_CHANGELOG:167

## src/db

- **actions.ts** (374) — Все изменения данных.
  *PhotoDraft:11, *EntryDraft:13, *primaryHistory:27, *saveEntry:34, *deleteEntry:81, *toggleGoal:93, *addGoal:100, *awardStages:109, *toggleFocus:133, *setRequirements:141, *deleteGoal:143, *addNode:147, *renameNode:159, *deleteNode:162, *addNote:180, *toggleNoteStudied:184, *deleteNote:189, *toggleExperiment:194, *setAiCode:198, *setSeenVersion:199, *setName:200, *unlockAchievements:202, *resetAll:207, *createQuest:214, *toggleCustomStep:220, *abandonQuest:228, *deleteQuest:229, *completeQuest:232, *maintainQuests:246, *toggleWeeklyTemplate:271, *addMetric:286, *deleteMetric:291, bonus:300, *addMetricValue:311, *deleteMetricValue:353, *setMilestone:363, *removeMilestone:370, *fmtNum:373
- **db.ts** (242) — Хранилище на устройстве. ARCHITECTURE.md §11.
  *NodeKind:7, *Profile:9, *Requirement:29, *Node:31, *Goal:49, *Entry:61, *EntrySkill:78, *Photo:80, *Unlocked:82, *Note:84, *QuestKind:96, *CountRule:98, *QuestStep:108, *Quest:115, *Metric:134, *MetricValue:145, *Milestone:159, *AREA_ICON_BY_TITLE:174, *AREA_ICONS:178, LifeQuestDB:180, *db:233, *uid:236, *nowIso:241
- **seed.ts** (150) — Стартовый набор. ARCHITECTURE.md §13.
  G:7, SeedNode:8, t:17, p:18, *AREA_COLORS:20, TREE:22, *seedIfEmpty:71, STARTER_VERSION:110, STARTER_METRICS:112, *ensureStarter:121
- **world.ts** (415) — Всё состояние разом и производные значения. Данных у одного человека немного,
  *World:17, *loadWorld:31, *LockReason:48, *derive:59, .primaryOf:103, .subtreeXp:106, .areaOf:115, .pathOf:120, .skillLevelOf:141, .requirementsOf:144, .lockReasons:157, .stagesOfSkill:175, .openGoalsOf:178, .rustDays:190, .explored:196, .unlocksOf:201, .stepState:222, .questProgress:246, .metricInfo:260, .hints:278, .stats:318, *Derived:406, *WorldContext:408, *useWorld:410

## src/engine

- **achievements.ts** (77) — Достижения. ARCHITECTURE.md §7.
  *Stats:3, *AchievementIcon:27, *AchievementDef:32, flag:44, *ACHIEVEMENTS:46, *evaluateAchievements:71
- **dates.ts** (55) — Даты храним как локальные YYYY-MM-DD.
  *localDate:3, *addDays:10, *daysBetween:16, MONTHS:22, *humanDate:24, *currentStreak:32, *bestStreak:43
- **engine.test.ts** (242)
- **experiments.ts** (17) — Флаг экспериментов: новый UX включается только у тех, кто сам включил эксперимент
  *EXPERIMENTS:5, *hasExp:10, *toggleExp:13
- **levels.ts** (44) — Уровни персонажа и навыков. ARCHITECTURE.md §4.3–4.4.
  *xpToNext:3, *characterLevel:5, *SKILL_LEVELS:17, *skillLevel:31
- **metrics.ts** (88) — Замеры, рекорды, прогноз рубежа. ARCHITECTURE.md §8.
  *RECORD_XP:4, *MILESTONE_XP:5, *ValueLike:7, *WorkSet:10, *bestSet:16, *valueFromSets:26, *bestRepsAt:33, *bestValue:43, *isRecord:53, *reached:60, *milestoneProgress:63, *forecastDate:72
- **progress.ts** (44) — Одна полоска прогресса. ARCHITECTURE.md §3.
  *GoalKind:3, *GOAL_WEIGHT:4, *GoalLike:6, *skillProgress:8, *NodeLike:19, *computeProgress:22
- **quests.ts** (47) — Квесты: шаблоны недельных, прогресс шагов. ARCHITECTURE.md §6.
  *QUEST_STEP_XP:4, *weekStart:7, *WeeklyTemplate:13, *WEEKLY_TEMPLATES:21, *EntryFacts:27, *countProgress:30
- **snapshots.ts** (10) — Снимки данных перед восстановлением копии: сколько хранить и какие удалить. Чистые функции.
  *SNAPSHOT_KEEP:4, *snapshotsToPrune:7
- **stages.ts** (51) — Ступени целей навыка. ARCHITECTURE.md §16, идея 2.
  *STAGE_NAMES:4, *stageName:5, *STAGE_BONUS:7, *StagedGoal:9, *StageInfo:11, *stagesOf:21, *currentStage:34, *assignStages:40
- **version.ts** (41) — Версии «0.9.2» и бета «0.10.0-beta.1»: сравнение, код версии Android, выбор того, что показать в «Что нового».
  *Version:3, *parseVersion:5, *cmpVersion:13, *androidVersionCode:28, *isBeta:33, *stableOf:35, *unseenReleases:38
- **xp.ts** (87) — Начисление XP за запись журнала. ARCHITECTURE.md §4.1–4.2.
  *EntryType:4, *Difficulty:5, *ENTRY_TYPES:7, *ENTRY_TYPE_LABEL:16, *BASE_XP:21, *DIFFICULTIES:25, *REPEAT_FREE_PER_DAY:32, *SECONDARY_SHARE:34, *XpContext:36, *RUST_DAYS:52, *XpFactor:54, *calcXp:56, *secondaryXp:71, *xpContextFromHistory:74

## src/lib

- **ai.ts** (41) — AI-помощник целей: запросы к серверу-посреднику (server/, Cloudflare Worker). Ключ Claude — только на сервере.
  *AI_URL:6, *AiGoal:8, *AiStage:9, *AiGoalsAnswer:10, *AiSkillInput:11, *AiError:19, call:25, *askGoals:37, *fetchQuota:40
- **backButton.ts** (60) — Системная кнопка «Назад» в APK: закрывает верхнее открытое (клавиатура, шторка, фото),
  stack:9, *useBackClose:12, EXIT_MS:26, exitArmedAt:27, *closeTop:30, *handleBack:37, *initBackButton:49
- **backup.ts** (192) — Резервная копия: всё в один .zip — data.json + фото. ARCHITECTURE.md §12.
  FORMAT:11, BackupData:13, *BackupSummary:32, summarize:34, *currentSummary:41, buildZip:47, toBase64:71, *exportBackup:83, download:113, *ParsedBackup:123, *readBackup:126, *restoreBackup:150, *takeSnapshot:180, *restoreSnapshot:186
- **channel.ts** (37) — Канал обновлений APK: «стабильная» (по умолчанию, у брата) или «бета» (каждая новая сборка).
  *Channel:9, KEY:10, *getChannel:12, *setChannel:25
- **install.ts** (52) — Установка PWA: ловим событие beforeinstallprompt от Chrome и показываем свою кнопку.
  InstallPromptEvent:5, deferred:10, listeners:11, emit:12, *isStandalone:24, *isIos:28, *useInstall:30
- **photo.ts** (72) — Сжатие фото перед сохранением: основное до 1600px, превью до 320px. ARCHITECTURE.md §9.
  decode:5, resize:21, *compressPhoto:34, *usePhotoUrl:42, *useBlobUrl:62
- **reminders.ts** (122) — Напоминания (только APK, плагин @capacitor/local-notifications). Фонового кода нет, поэтому
  *ReminderPrefs:11, KEY:12, DEFAULTS:13, listeners:14, *remindersSupported:15, *getReminderPrefs:17, *setReminderPrefs:25, *useReminderPrefs:35, *notificationsAllowed:45, at:52, IDS:59, channelReady:60, *rescheduleReminders:63
- **router.ts** (27) — Простой роутер на hash: работает на GitHub Pages без настройки сервера.
  parse:4, *useRoute:6, *go:19, *back:23
- **snapshots.ts** (31) — Хранилище снимков: отдельная база IndexedDB, чтобы очистка основной базы при восстановлении её не трогала.
  *SnapshotReason:6, *SnapshotSummary:7, *Snapshot:8, SnapshotDB:10, sdb:17, *saveSnapshot:20, *listSnapshots:29, *getSnapshot:30
- **sound.ts** (74) — Звуки наград — генерируются Web Audio, без файлов. Настройки — на устройстве (localStorage).
  *SoundPrefs:4, KEY:5, DEFAULTS:6, listeners:7, *getSoundPrefs:9, *setSoundPrefs:17, *useSoundPrefs:27, *SoundKind:36, MELODY:38, ctx:44, *play:46, *buzz:71
- **theme.ts** (51) — Тема оформления: «как в системе» (по умолчанию), тёмная или светлая. Выбор — на устройстве (localStorage),
  *ThemePref:5, KEY:6, media:7, listeners:8, *getThemePref:10, apply:19, *setThemePref:25, *initTheme:35, *useThemePref:40, *ac:50
- **toast.ts** (71) — Всплывашки: XP, новый уровень, достижения.
  *ToastKind:6, *Toast:7, MERGE_MS:10, LIFETIME:11, RANK:12, toasts:14, nextId:15, lastGame:16, timers:17, listeners:18, emit:19, schedule:21, *toast:30, *useToasts:61
- **update.ts** (118) — Автообновление APK. Сайт обновляется сам (service worker), здесь — только приложение.
  *SITE:16, channelSite:18, *Remote:19, *UpdateState:21, state:30, listeners:31, setState:32, *useUpdate:37, fetchRemote:46, *checkForUpdate:56, *installApk:83, *initUpdates:105

## src

- **main.tsx** (29)
  start:16

## src/screens

- **Achievements.tsx** (61)
  *Achievements:6
- **Backup.tsx** (250) — «Ещё» → «Резервная копия». Макет: холст, страница «Резервная копия».
  *Backup:15, agoText:147, *BackupReminder:155, fmtWhen:197, SnapshotCard:200
- **Changelog.tsx** (107) — «Что нового»: окно один раз после обновления и история версий в «Ещё». Макет: холст, страница «Что нового».
  KIND:11, ORDER:16, fmtDate:18, changesWord:19, *WhatsNew:22, ChangeRow:60, *Changelog:70, ReleaseCard:85
- **Character.tsx** (151) — Главный экран — всё важное примерно в один экран. Макет: холст, страница «Упрощение», экран 1.
  *Character:14, WEEK_SHORT:80, TodayCard:83, *plural:144
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
- **Settings.tsx** (310) — Настройки: персонаж, тема, недельные квесты, резервная копия, о приложении, стереть данные.
  THEMES:21, Toggle:27, Group:36, *Settings:45, AboutRow:153, hiddenThisSession:183, *UpdateCard:184, AiBlock:217, ChannelPicker:266
- **Skill.tsx** (436)
  *stagesToast:23, Fold:26, word:27, *Skill:31, .toggle:61, .onFocus:63, FoldRow:193, WorkoutCard:207, SkillMenu:242, GoalRow:279, Goals:292, Notes:371, GalleryItem:411, FullPhoto:416, Gallery:426
- **Tree.tsx** (313)
  Editor:14, loadExpanded:19, *Tree:27, .setMode:44, .toggle:53, .skillCount:71, .skillsIn:74, .menuBtn:77, .renderChildren:83, .renderNode:93, KIND_LABEL:239, NodeEditor:241

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
- **more.css** (89) — резервная копия
  резервная копия:1, «скоро» в «Ещё»:21, достижения:28, что нового:40, настройки, тема, обновление (0.7):60, звуки и напоминания (0.9):79, номер версии — скрытая кнопка «Эксперименты»:83, снимок перед восстановлением (фаза 0):86
- **quests.css** (34) — квесты
  квесты:1
- **skill.css** (115) — навык
  навык:1, навык: фокус, требования, ступени:21, навык 0.6: шапка, тренировка, сворачиваемые блоки, меню ⋯:58, AI-помощник целей:93
- **tree.css** (101) — дерево
  дерево:1, дерево: направления-карточки, ветви-линии, навыки-узлы:20, вложенные ветки — короткий отступ, линия идёт от ромбика:38, туман: навык ещё не исследован:64, ржавчина: 60+ дней без записей:68, созвездие (0.9): небо всегда тёмное, в любой теме:87
