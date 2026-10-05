# Карта кода

Сгенерировано `npm run map` — не править руками, перегенерировать после изменений.
`имя:строка` — объявление верхнего уровня (`*` — экспорт). Читать кусок: Read с offset = строка.


## src

- **App.tsx** (147)
  *App:28, useGameEvents:95, Toasts:129

## src/components

- **AiGoals.tsx** (139) — «Предложить цели» — кнопка на навыке и шторка: запрос → ожидание → предпросмотр с галочками.
  WISHES:13, *AiGoalsButton:16, Phase:28, AiGoalsSheet:30
- **EntryCard.tsx** (83)
  Thumb:12, *EntryCard:17
- **FocusAndHints.tsx** (79) — Главный экран: «В фокусе» и «Ближайшее». ARCHITECTURE.md §16, идеи 1 и 5.
  *FocusBlock:7, *HintsBlock:37
- **Icon.tsx** (79) — Контурные иконки 24×24, цвет берут из currentColor.
  PATHS:3, *IconName:70, *Icon:72
- **InstallCard.tsx** (46)
  HIDE_KEY:6, *InstallCard:9
- **NextAction.tsx** (103) — «Следующее действие» на главном (мастер-план §3, фаза 2, флаг next-action).
  *NextActionCard:15, ChoosePath:71
- **NumPad.tsx** (79) — Крупная цифровая клавиатура для весов, повторов и целей.
  *NumPadProps:7, parse:21, *fmtInput:22, *NumPad:24, *numFrom:75
- **Onboarding.tsx** (93) — Первый запуск: «Кем хочешь стать?» — выбор готовых путей вместо общего стартового дерева.
  SHOWN:13, *Onboarding:15
- **Reminders.tsx** (98) — Звуки и напоминания: блок настроек, окно «Включить напоминания?» и синхронизация расписания.
  Switch:10, *SoundSettings:20, *ReminderSettings:36, *ReminderPrompt:68, *ReminderSync:88
- **RequirementsSheet.tsx** (123) — Настройка требований навыка. ARCHITECTURE.md §16, идея 4.
  PRESETS:9, *RequirementsSheet:11
- **SetsEditor.tsx** (106) — Тренировка подходами: «вес × повторы», + подход, «как в прошлый раз».
  Field:9, *setsText:11, *SetsEditor:13
- **StarMap.tsx** (203) — Созвездие навыков: второй вид дерева (§16, идея 11). Макет: холст, «Созвездие и напоминания».
  Star:9, Cluster:10, View:11, RUST:13, *StarMap:15, .scale:67, .zoomAt:71, .onDown:77, .onMove:86, .onUp:102, .tap:106, *useSkyHeight:188
- **StarMap3D.tsx** (390) — Объёмное созвездие (мастер-план §12, решения 05.10.2026; флаг stars-3d, только бета).
  State:11, Star3:12, Area3:13, RUST:15, HOME:16, AUTO_KEY:17, FONT:18, loadAuto:20, *StarMap3D:28, .local:279, .onDown:283, .onMove:297, .onUp:321, .onWheel:343, .setAuto:348
- **Templates.tsx** (252) — «Готовые пути» — шаблоны навыков (мастер-план §12, фаза 1). Макет: холст, страница «Шаблоны».
  Phase:16, goalsWord:18, skillsWord:19, *TemplatesSheet:21, AreaChip:40, Catalog:45, Preview:85, Paste:191
- **ui.tsx** (133)
  *ProgressBar:9, *LevelBadge:17, *Ring:28, *AreaTile:49, *TopBar:58, *Sheet:73, *Confirm:105, *SectionLabel:119, *Check:128, *pctText:132

## src/data

- **changelog.ts** (205) — Что нового в версиях — для пользователя, простыми словами. Новые версии — сверху.
  *ChangeKind:4, *Change:5, *Release:6, *CHANGELOG:8, *SEEN_BEFORE_CHANGELOG:204
- **presets.test.ts** (40)
  AREAS:6
- **presets.ts** (48) — Готовые навыки при ручном добавлении (мастер-план §12): навыки шаблонов, сгруппированные по направлениям,
  T:6, P:7, sk:8, EXTRA:13, norm:29, *presetsFor:32
- **templatePrompt.ts** (39) — Запрос для «любой нейросети»: она составляет путь в формате шаблона (engine/templates.ts).
  *TEMPLATE_PROMPT:4
- **templates.test.ts** (49)
  goalsOf:5
- **templates.ts** (246) — Готовые шаблоны путей (мастер-план §12). Формат — engine/templates.ts.
  T:5, P:6, sk:9, M:18, BODY:31, MIND:32, TECH:33, ART:34, MONEY:35, PEOPLE:36, CALM:37, HOME:38, WORK:39, ORDER:47, BASE:49, *TEMPLATES:242

## src/db

- **actions.ts** (469) — Все изменения данных.
  *PhotoDraft:13, *EntryDraft:15, *primaryHistory:31, *saveEntry:38, *deleteEntry:87, *toggleGoal:99, *addGoal:106, *awardStages:115, *toggleFocus:139, *setRequirements:147, *deleteGoal:149, *addNode:153, *renameNode:165, *deleteNode:168, *addNote:186, *toggleNoteStudied:190, *deleteNote:195, *toggleExperiment:200, *setAiCode:204, *setSeenVersion:205, *setPlayer:207, *setFriendsShare:208, *setName:209, *unlockAchievements:211, *resetAll:216, *createQuest:223, *toggleCustomStep:229, *abandonQuest:237, *deleteQuest:238, *completeQuest:241, *maintainQuests:255, *toggleWeeklyTemplate:280, *addMetric:295, *deleteMetric:300, bonus:309, *addMetricValue:320, *deleteMetricValue:362, *setMilestone:372, *removeMilestone:379, *fmtNum:382, *previewTemplate:387, *previewTemplates:392, freeAreaColor:398, *importTemplate:404, *finishOnboarding:447, *addPresetSkill:455
- **db.test.ts** (215) — Тесты базы: действия (actions.ts) и производные значения (world.ts → derive) на настоящей Dexie
  world:23, skillWithGoals:26, draft:37, .tpl:145
- **db.ts** (250) — Хранилище на устройстве. ARCHITECTURE.md §11.
  *NodeKind:7, *Profile:9, *Requirement:35, *Node:37, *Goal:55, *Entry:67, *EntrySkill:86, *Photo:88, *Unlocked:90, *Note:92, *QuestKind:104, *CountRule:106, *QuestStep:116, *Quest:123, *Metric:142, *MetricValue:153, *Milestone:167, *AREA_ICON_BY_TITLE:182, *AREA_ICONS:186, LifeQuestDB:188, *db:241, *uid:244, *nowIso:249
- **seed.ts** (66) — Стартовое содержимое. ARCHITECTURE.md §13. Дерево новичок выбирает сам (шаблоны, components/Onboarding.tsx);
  *AREA_COLORS:6, STARTER_VERSION:9, *seedIfEmpty:12, STARTER_METRICS:20, *ensureStarter:29, addStarterQuestIn:51, *addStarterQuest:65
- **world.ts** (421) — Всё состояние разом и производные значения. Данных у одного человека немного,
  *World:18, *loadWorld:32, *LockReason:49, *derive:60, .primaryOf:104, .subtreeXp:107, .areaOf:116, .pathOf:121, .skillLevelOf:142, .requirementsOf:145, .lockReasons:158, .stagesOfSkill:176, .openGoalsOf:179, .rustDays:191, .explored:197, .naSkill:200, .unlocksOf:203, .stepState:224, .questProgress:248, .metricInfo:262, .hints:280, .stats:320, *Derived:412, *WorldContext:414, *useWorld:416

## src/engine

- **achievements.ts** (77) — Достижения. ARCHITECTURE.md §7.
  *Stats:3, *AchievementIcon:27, *AchievementDef:32, flag:44, *ACHIEVEMENTS:46, *evaluateAchievements:71
- **dates.ts** (55) — Даты храним как локальные YYYY-MM-DD.
  *localDate:3, *addDays:10, *daysBetween:16, MONTHS:22, *humanDate:24, *currentStreak:32, *bestStreak:43
- **engine.test.ts** (244)
- **experiments.ts** (25) — Флаг экспериментов: новый UX включается только у тех, кто сам включил эксперимент
  *IS_BETA:7, *EXPERIMENTS:10, *hasExp:18, *toggleExp:21
- **friends.test.ts** (53)
  base:5
- **friends.ts** (72) — Друзья: что уходит на сервер — карточка недели (docs/arch/11-friends.md). Чистая функция, без базы.
  *WeekCard:7, *FriendsShare:21, *DEFAULT_SHARE:22, *CardInput:24, plural:36, *buildWeekCard:39
- **levels.ts** (44) — Уровни персонажа и навыков. ARCHITECTURE.md §4.3–4.4.
  *xpToNext:3, *characterLevel:5, *SKILL_LEVELS:17, *skillLevel:31
- **metrics.ts** (88) — Замеры, рекорды, прогноз рубежа. ARCHITECTURE.md §8.
  *RECORD_XP:4, *MILESTONE_XP:5, *ValueLike:7, *WorkSet:10, *bestSet:16, *valueFromSets:26, *bestRepsAt:33, *bestValue:43, *isRecord:53, *reached:60, *milestoneProgress:63, *forecastDate:72
- **nextAction.test.ts** (45)
  g:4, sk:5
- **nextAction.ts** (56) — «Следующее действие» (мастер-план §3, фаза 2): что делать сейчас — вычисляется, не хранится.
  *NAGoal:7, *NASkill:8, *NAEntry:9, *NextAction:11, *nextActions:21, *suggestPaths:40, *agoText:52
- **progress.ts** (44) — Одна полоска прогресса. ARCHITECTURE.md §3.
  *GoalKind:3, *GOAL_WEIGHT:4, *GoalLike:6, *skillProgress:8, *NodeLike:19, *computeProgress:22
- **quests.ts** (47) — Квесты: шаблоны недельных, прогресс шагов. ARCHITECTURE.md §6.
  *QUEST_STEP_XP:4, *weekStart:7, *WeeklyTemplate:13, *WEEKLY_TEMPLATES:21, *EntryFacts:27, *countProgress:30
- **sky3d.test.ts** (44)
  cam:4
- **sky3d.ts** (90) — Объёмное созвездие (мастер-план §12, решения 05.10.2026): раскладка в пространстве, проекция, масштаб к точке.
  *V3:4, *Camera:5, *Projected:6, *ZOOM_MIN:8, *ZOOM_MAX:9, *PITCH_MAX:10, *SKY_R:12, CAM_D:13, *spherePoints:16, *clusterPoints:28, *project:40, *clampZoom:59, *clampPitch:60, *zoomAt:63, *backgroundStars:70, *flashWaves:82
- **snapshots.ts** (10) — Снимки данных перед восстановлением копии: сколько хранить и какие удалить. Чистые функции.
  *SNAPSHOT_KEEP:4, *snapshotsToPrune:7
- **stages.ts** (51) — Ступени целей навыка. ARCHITECTURE.md §16, идея 2.
  *STAGE_NAMES:4, *stageName:5, *STAGE_BONUS:7, *StagedGoal:9, *StageInfo:11, *stagesOf:21, *currentStage:34, *assignStages:40
- **templates.test.ts** (118)
  tpl:4, n:21, id:22, empty:23
- **templates.ts** (224) — Шаблон пути — единый JSON-формат для готовых шаблонов, ответа «любой нейросети» и будущего AI /path
  *TplGoalKind:4, *TplCheck:6, *TplGoal:8, *TplStage:9, *TplMetric:10, *TplSkill:11, *TplBranch:20, *TplArea:21, *TplCampaign:22, *Template:23, isStr:34, *validateTemplate:36, *ExistingNode:78, *ExistingGoal:79, *ExistingMetric:80, *ExistingQuest:81, *PlanNode:83, *PlanGoal:84, *PlanMetric:85, *ImportPlan:86, norm:97, *planImport:100, *parseTemplateText:177, *templateSkills:191, *templateStats:203, *planImportMany:213
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
- **channel.ts** (63) — Канал обновлений APK: «стабильная» (по умолчанию, у брата) или «бета» (каждая новая сборка).
  *Channel:11, KEY:12, *SITE:13, *getChannel:15, remember:24, *setChannel:38
- **errorlog.ts** (90) — Журнал ошибок: 50 последних сбоев на устройстве. Наружу — только по кнопке «Отправить отчёт»,
  *LoggedError:8, KEY:9, MAX:10, listeners:11, *getErrors:13, save:21, *logError:31, *clearErrors:44, *useErrors:46, *initErrorLog:56, *buildReport:61, *shareReport:73
- **friends.ts** (101) — «Друзья»: ключ игрока и запросы к серверу (server/src/friends.ts, docs/arch/11-friends.md).
  *Player:10, *EMOJI:11, *FriendView:13, *FriendsError:21, call:25, randomSecret:41, *ensurePlayer:44, *prettyCode:55, *inviteLink:56, *listFriends:58, *addFriend:59, *removeFriend:60, *react:61, *newCode:64, *leave:72, *myCard:77, SENT_KEY:91, *pushCard:93
- **hscroll.ts** (44) — Горизонтальные ленты (.type-row в шторке «+», .chips.scroll-x) на ПК: пальцем они листаются сами,
  SEL:3, scrollable:5, *initHScroll:10
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
- **update.ts** (119) — Автообновление APK. Сайт обновляется сам (service worker), здесь — только приложение.
  channelSite:19, *Remote:20, *UpdateState:22, state:31, listeners:32, setState:33, *useUpdate:38, fetchRemote:47, *checkForUpdate:57, *installApk:84, *initUpdates:106

## src

- **main.tsx** (33)
  start:18

## src/screens

- **Achievements.tsx** (61)
  *Achievements:6
- **Backup.tsx** (251) — «Ещё» → «Резервная копия». Макет: холст, страница «Резервная копия».
  *Backup:16, agoText:148, *BackupReminder:156, fmtWhen:198, SnapshotCard:201
- **Changelog.tsx** (107) — «Что нового»: окно один раз после обновления и история версий в «Ещё». Макет: холст, страница «Что нового».
  KIND:11, ORDER:16, fmtDate:18, changesWord:19, *WhatsNew:22, ChangeRow:60, *Changelog:70, ReleaseCard:85
- **Character.tsx** (243) — Главный экран — всё важное примерно в один экран. Макет: холст, страница «Упрощение», экран 1.
  *Character:16, NextHome:85, WEEK_SHORT:172, TodayCard:175, *plural:236
- **EntrySheet.tsx** (288) — «＋ Запись» — главный сценарий, цель 15 секунд. Макет: холст, страница «Упрощение», экраны 2–3.
  *EntryPreset:20, LAST_TYPE:22, loadType:23, PhotoPreview:32, *EntrySheet:42, .setType:64, .choosePrimary:102, .addSecondary:111, .onFiles:118, .save:129
- **Friends.tsx** (354) — «Друзья» (эксперимент friends): напарники по коду, итоги недели и реакции. Макет: холст, страница «Друзья».
  MONTHS:24, short:25, weekLabel:26, sinceLabel:27, Load:29, useFriends:32, *Friends:54, FriendsMain:60, shareInvite:81, Invite:93, AddByCode:113, Privacy:145, Dots:151, Reactions:155, Avatar:177, FriendsList:182, FriendWeek:221, WeekBlock:255, ShareSettings:279, AddByLink:329
- **Journal.tsx** (45)
  *Journal:7
- **Metrics.tsx** (485) — Замеры и рубежи. Макет: холст, страница «Замеры и рубежи». ARCHITECTURE.md §8.
  Info:17, *MetricInfo:18, *metricToasts:20, *Sparkline:25, deltaText:41, *Metrics:47, *MilestoneCard:104, Chart:141, *MetricDetail:180, *usesSets:250, *lastSetsOf:253, *recordHintFor:261, *BigNumber:271, PhotoThumb:288, AddValueSheet:298, MilestoneSheet:352, bestRepsAtOf:425, NewMetricSheet:431, *SkillMetrics:468
- **More.tsx** (58)
  SOON:10, *More:18
- **Quests.tsx** (447) — Квесты. Макет: холст, страница «Квесты». ARCHITECTURE.md §6.
  KIND_TITLE:14, daysToMonday:16, *QuestCard:22, WeeklyRow:43, *Quests:64, *QuestDetail:148, stepKindLabel:228, DraftKind:232, NewQuestSheet:234, StepBuilder:313, *QuestsBlock:412
- **Settings.tsx** (359) — Настройки: персонаж, тема, недельные квесты, резервная копия, о приложении, стереть данные.
  THEMES:23, *Toggle:29, Group:38, *Settings:47, AboutRow:162, hiddenThisSession:192, *UpdateCard:193, AiBlock:226, ChannelPicker:275, ErrorLogRow:322
- **Skill.tsx** (436)
  *stagesToast:23, Fold:26, word:27, *Skill:31, .toggle:61, .onFocus:63, FoldRow:193, WorkoutCard:207, SkillMenu:242, GoalRow:279, Goals:292, Notes:371, GalleryItem:411, FullPhoto:416, Gallery:426
- **Tree.tsx** (391)
  Editor:18, loadExpanded:23, *Tree:31, .setMode:51, .toggle:60, .skillCount:78, .skillsIn:81, .menuBtn:84, .renderChildren:90, .renderNode:100, KIND_LABEL:259, NodeEditor:261

## src/styles

- **base.css** (161) — Тёмная тема по макету: золото = XP, у направлений свои цвета.
  Тёмная тема по макету: золото = XP, у направлений свои цвета.:1, Светлая тема (макет: холст, «Настройки и обновления»). Соответствие цветов — tools/light_palette.py.:44, текст:108, раскладка:119, полоски:132, нижняя панель:139, всплывашки:147
- **common.css** (90) — записи
  записи:1, чипы:16, кнопки:26, поля:43, фото:53, шторка:65
- **entry.css** (50) — шторка записи (0.5)
  шторка записи (0.5):1, подходы и клавиатура (0.5):16
- **friends.css** (33) — «Друзья» (screens/Friends.tsx). Макет: холст, страница «Друзья».
  «Друзья» (screens/Friends.tsx). Макет: холст, страница «Друзья».:1
- **home.css** (88) — главный: фокус и подсказки
  главный: фокус и подсказки:1, установка:13, персонаж:17, главный, компактный (0.5):31, «Следующее действие» и главный фазы 2 (флаг next-action) — components/NextAction.tsx, Character.tsx NextHome:61
- **index.css** (12) — Порядок важен: база → общие компоненты → экраны.
  Порядок важен: база → общие компоненты → экраны.:1
- **metrics.css** (35) — замеры
  замеры:1
- **more.css** (97) — резервная копия
  резервная копия:1, «скоро» в «Ещё»:21, достижения:28, что нового:40, настройки, тема, обновление (0.7):60, звуки и напоминания (0.9):79, номер версии — скрытая кнопка «Эксперименты»:83, снимок перед восстановлением (фаза 0):86, журнал ошибок (фаза 0):90
- **quests.css** (34) — квесты
  квесты:1
- **skill.css** (115) — навык
  навык:1, навык: фокус, требования, ступени:21, навык 0.6: шапка, тренировка, сворачиваемые блоки, меню ⋯:58, AI-помощник целей:93
- **tree.css** (169) — дерево
  дерево:1, дерево: направления-карточки, ветви-линии, навыки-узлы:20, вложенные ветки — короткий отступ, линия идёт от ромбика:38, туман: навык ещё не исследован:64, ржавчина: 60+ дней без записей:68, созвездие (0.9): небо всегда тёмное, в любой теме:87, готовые пути (шаблоны) — components/Templates.tsx:103, готовые навыки в «Новый навык» (data/presets.ts):141, первый запуск (components/Onboarding.tsx):151, объёмное созвездие (components/StarMap3D.tsx):163
