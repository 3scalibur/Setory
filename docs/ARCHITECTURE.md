# Setory — архітектура (етап 1)

Результат етапу 1 з `SPEC.md`: стек, структура папок, схема БД, доменні функції і рішення, які треба погодити до першого рядка коду. Після погодження цей файл — опора для етапів 2–5.

## 1. Назви: ТЗ → код

В інтерфейсі «Папка» містить «Програми» (Push / Pull / Legs). Щоб код читався так само, як екран, і збігався з термінами Hevy, у коді беремо ці назви, а не `Program` / `ProgramDay` з ТЗ:

| У ТЗ | В інтерфейсі | У коді / БД |
|---|---|---|
| `Program` | Папка | `Folder` / `folders` |
| `ProgramDay` | Програма | `Routine` / `routines` |
| `ProgramDayExercise` | Вправа в програмі | `RoutineExercise` / `routine_exercises` |
| `ProgramDaySet` | Підхід у програмі | `RoutineSet` / `routine_sets` |
| `source: 'program_day'` | Запуск програми | `source: 'routine'` |
| `nextProgramDay`, `fitProgramDayToBudget` | — | `nextRoutine`, `fitRoutineToBudget` |

Решта назв (`WorkoutSession`, `SetEntry`, `buildPrefill`…) — як у ТЗ.

## 2. Стек

| Що | Вибір | Версія на 14.10.2026 |
|---|---|---|
| Фреймворк | Expo + React Native, TypeScript strict | Expo SDK 57 |
| Навігація | Expo Router (екран = файл у `app/`) | 57.x |
| База | expo-sqlite + Drizzle ORM, міграції drizzle-kit | 57.x / 0.45 / 0.31 |
| UUID | expo-crypto `randomUUID()` | 57.x |
| Пошук | Власний: нормалізація + відстань редагування (без залежностей) | — |
| Тести | Jest: домен — `jest-expo`; репозиторії — Node + better-sqlite3 з тією ж схемою | — |

Усе працює в **Expo Go**: ставиш застосунок на телефон, скануєш QR — і бачиш апку без збирання. Окремої бібліотеки стану немає: стан — це SQLite, екрани підписуються на зміни через `useLiveQuery` з Drizzle.

## 3. Шари і правило залежностей

```
src/app/ (екрани) ──► features/ (компоненти, хуки) ──► services/ (SessionService) ──► data/ (репозиторії, SQL) ──► db/ (схема)
                                  │                          │
                                  └──────────► domain/ ◄─────┘   (чисті функції, НЕ імпортують нічого з RN, БД чи UI)
```

- **domain/** — уся логіка ТЗ: prefill, рекорди, ↑, backlog, день пропущених, ротація, пошук. Отримує дані аргументами, повертає результат, без побічних ефектів. Тому покривається тестами без телефона.
- **data/** — єдине місце з SQL-запитами. Віддає дані у формі, яку чекає domain.
- **services/** — сценарії «почати тренування», «виконати підхід», «завершити»: беруть дані з data/, рахують через domain/, записують через data/.
- **src/app/** — екрани тонкі: лише розкладка й виклики хуків. Ні SQL, ні правил ТЗ.

## 4. Структура папок

Екрани лежать у `src/app/` — так з Expo SDK 57 влаштований стандартний шаблон.

```
Setory/
├─ src/
│  ├─ app/                           # Expo Router: екрани
│  │  ├─ _layout.tsx                 # БД, міграції, seed, тема
│  │  ├─ (tabs)/
│  │  │  ├─ _layout.tsx              # нижні вкладки
│  │  │  ├─ index.tsx                # «Тренування»: папки, програми, «Наступне», пропущені
│  │  │  ├─ history.tsx              # історія тренувань
│  │  │  ├─ exercises.tsx            # каталог і пошук
│  │  │  └─ profile.tsx              # налаштування
│  │  ├─ session/[id].tsx            # активне або завершене тренування
│  │  ├─ session/[id]/summary.tsx    # підсумок: 🏆 і ↑
│  │  ├─ routine/[id].tsx            # конструктор програми
│  │  ├─ folder/[id].tsx             # папка: перейменувати, порядок програм
│  │  ├─ exercise/[id].tsx           # картка вправи: історія, рекорди
│  │  ├─ exercise/new.tsx            # власна вправа
│  │  ├─ backlog.tsx                 # пропущені
│  │  └─ catch-up.tsx                # пропозиція дня пропущених
│  ├─ config.ts                      # константи з ТЗ (DONE_THRESHOLD, BACKLOG_EXPIRY_DAYS…)
│  ├─ domain/                        # чисті функції + *.test.ts поруч
│  │  ├─ types.ts
│  │  ├─ text.ts                     # нормалізація тексту
│  │  ├─ sets.ts                     # робочий підхід, округлення ваги, 1ПМ, валідація
│  │  ├─ performance.ts              # lastPerformance, buildPrefill
│  │  ├─ progress.ts                 # compareWithPrevious
│  │  ├─ records.ts                  # evaluateSetPRs, rebuildPRs
│  │  ├─ backlog.ts                  # computeBacklog
│  │  ├─ catchUp.ts                  # estimateMinutes, suggestCatchUp, fitRoutineToBudget
│  │  ├─ rotation.ts                 # nextRoutine
│  │  ├─ search.ts                   # пошук і попередження про дубль
│  │  ├─ session.ts                  # завершення тренування, забуте тренування
│  │  └─ __fixtures__/               # готові історії для тестів
│  ├─ db/
│  │  ├─ schema.ts                   # таблиці Drizzle
│  │  ├─ client.ts                   # відкриття БД (expo-sqlite)
│  │  ├─ types.ts                    # тип Db: спільний для застосунку і тестів
│  │  ├─ test-db.ts                  # SQLite у Node для тестів
│  │  ├─ use-database-ready.ts       # міграції + підготовка на старті
│  │  └─ seed/                       # 65 вбудованих вправ, папка «Мої програми»
│  ├─ data/                          # репозиторії: exercises, folders, routines, sessions, history, backlog, settings
│  ├─ services/                      # сценарії для екранів (тести — на справжній SQLite)
│  │  ├─ deps.ts                     # Deps (db, годинник, id), UserError, транзакції
│  │  ├─ app-deps.ts                 # справжні залежності на телефоні
│  │  ├─ sessionService.ts           # старт у 4 режимах, підходи, завершення, продовження
│  │  ├─ sessionView.ts              # екран тренування: «Попереднє», 🏆, ↑, підсумок
│  │  ├─ folderService.ts            # папки
│  │  ├─ routineService.ts           # конструктор і картка програми, вкладка «Тренування»
│  │  ├─ backlogService.ts           # пропущені, день пропущених, «маю N хвилин»
│  │  ├─ exerciseService.ts          # пошук, власні вправи, картка вправи
│  │  └─ historyService.ts           # вкладка «Історія»
│  ├─ features/                      # workout-tab, routine-editor, session, exercise-search, backlog
│  └─ ui/                            # базові компоненти (екран, тема)
├─ drizzle/                          # згенеровані міграції (не редагуються руками)
├─ docs/ARCHITECTURE.md
├─ SPEC.md
├─ CLAUDE.md                         # правила проєкту для Claude
└─ AGENTS.md                         # загальні правила Expo з шаблону
```

## 5. Схема БД

Спільне для всіх таблиць: `id TEXT PRIMARY KEY` (UUID), `created_at`, `updated_at` (мс, UTC), `deleted_at` (м'яке видалення). Вага — `REAL` у кг, тривалість — секунди, дистанція — метри.

```sql
-- Каталог
exercises
  name               TEXT NOT NULL              -- українська назва
  aliases            TEXT NOT NULL DEFAULT '[]' -- JSON: «жим лежа», «bench press»
  primary_muscles    TEXT NOT NULL              -- JSON: MuscleGroup[]
  secondary_muscles  TEXT NOT NULL DEFAULT '[]'
  equipment          TEXT NOT NULL
  type               TEXT NOT NULL              -- weight_reps | bodyweight_reps | weighted_bodyweight | assisted_bodyweight | duration | distance_duration
  mechanic           TEXT NOT NULL              -- compound | isolation
  instructions       TEXT
  media_url          TEXT
  is_custom          INTEGER NOT NULL DEFAULT 0
  archived_at        INTEGER                    -- вправа з історією не видаляється, а архівується

-- Шаблони
folders
  name               TEXT NOT NULL
  position           INTEGER NOT NULL
  is_active          INTEGER NOT NULL DEFAULT 0
  UNIQUE (is_active) WHERE is_active = 1 AND deleted_at IS NULL   -- активна папка лише одна

routines                                        -- «програма» в папці
  folder_id          TEXT NOT NULL → folders
  name               TEXT NOT NULL
  position           INTEGER NOT NULL
  note               TEXT
  INDEX (folder_id, position)

routine_exercises
  routine_id         TEXT NOT NULL → routines
  exercise_id        TEXT NOT NULL → exercises
  position           INTEGER NOT NULL
  rest_sec           INTEGER NOT NULL
  note               TEXT
  INDEX (routine_id)

routine_sets                                    -- кожен підхід програми окремим рядком
  routine_exercise_id TEXT NOT NULL → routine_exercises
  position           INTEGER NOT NULL
  kind               TEXT NOT NULL              -- warmup | working | drop | failure
  weight_kg          REAL                       -- стартова вага: лише поки вправу не виконували
  reps_min, reps_max INTEGER                    -- 8 → 8/8; діапазон 8–10
  duration_sec       INTEGER
  distance_m         REAL
  INDEX (routine_exercise_id)

-- Журнал (єдине джерело правди)
workout_sessions
  source             TEXT NOT NULL              -- routine | single_exercise | catch_up | free
  folder_id          TEXT → folders             -- лише для routine
  routine_id         TEXT → routines            -- лише для routine
  title              TEXT NOT NULL              -- знімок назви на момент старту: «Push», «Окрема вправа»
  status             TEXT NOT NULL              -- active | finished | discarded
  started_at         INTEGER NOT NULL
  finished_at        INTEGER
  note               TEXT
  INDEX (status, finished_at)
  UNIQUE (status) WHERE status = 'active' AND deleted_at IS NULL  -- активне тренування лише одне

session_exercises
  session_id         TEXT NOT NULL → workout_sessions
  exercise_id        TEXT NOT NULL → exercises
  position           INTEGER NOT NULL
  routine_exercise_id TEXT → routine_exercises  -- який слот програми виконує (для backlog)
  skipped            INTEGER NOT NULL DEFAULT 0
  targets_snapshot   TEXT                       -- JSON: копія routine_sets на момент старту
  rest_sec           INTEGER
  INDEX (session_id), INDEX (exercise_id)

set_entries
  session_exercise_id TEXT NOT NULL → session_exercises
  position           INTEGER NOT NULL
  kind               TEXT NOT NULL              -- warmup | working | drop | failure
  weight_kg          REAL                       -- для assisted_bodyweight — допомога
  reps               INTEGER
  duration_sec       INTEGER
  distance_m         REAL
  rpe                REAL
  completed          INTEGER NOT NULL DEFAULT 0
  completed_at       INTEGER
  INDEX (session_exercise_id)

-- Службове
backlog_dismissals
  exercise_id        TEXT NOT NULL → exercises
  dismissed_at       INTEGER NOT NULL
  INDEX (exercise_id)

settings
  key                TEXT PRIMARY KEY
  value              TEXT NOT NULL              -- JSON
```

Окремої таблиці рекордів немає: усе в розділі 6 рахується з журналу.

## 6. Похідні дані: що звідки береться

| Що бачить користувач | З чого рахується | Функція (domain/) |
|---|---|---|
| Підставлені кг/повтори, «Минулого разу» в тренуванні й у програмі | робочі підходи останнього завершеного виконання вправи | `lastPerformance`, `buildPrefill` |
| ↑ Прогрес | підхід з тим самим номером минулого разу | `compareWithPrevious` |
| 🏆 Рекорд | усі робочі підходи вправи до цього моменту | `evaluateSetPRs`, `rebuildPRs` |
| Пропущені | `routine`-сесії за останні 2 × `BACKLOG_EXPIRY_DAYS` + `backlog_dismissals` | `computeBacklog` |
| «Наступне: Push» | остання завершена `routine`-сесія цієї папки | `nextRoutine` |
| День пропущених, «маю N хвилин» | backlog + коли тренувався кожен м'яз | `suggestCatchUp`, `fitRoutineToBudget`, `estimateMinutes` |

Доменні функції приймають дані, а не id. У ТЗ є `rebuildPRs(exerciseId)`; у коді це `rebuildPRs(sets, exerciseType)`, а підходи вправи дістає репозиторій. Дві форми вхідних даних — `HistorySet` (плаский журнал виконаних підходів для prefill, ↑, 🏆) і `HistorySession` (зведення по сесіях для пропущених, ротації, «коли тренувався м'яз»). Точні поля — у `src/domain/types.ts`. Шар даних віддає лише виконані підходи із завершених сесій без м'якого видалення.

Решта доменних функцій: `searchExercises`, `similarExercises` (пошук і попередження про дубль), `canCompleteSet` (валідація підходу), `planFinish` (що прибрати при «Завершити»), `staleSessionFinishAt` (забуте тренування).

### Сценарії ТЗ → тести

| Сценарії (SPEC.md, розділ 12) | Де перевіряються |
|---|---|
| 1, 2, 18, 19 | `src/domain/performance.test.ts` |
| 3–10 | `src/domain/backlog.test.ts` |
| 11–13 | `src/domain/records.test.ts` |
| 14, 23 | `src/domain/rotation.test.ts` |
| 15, 16 | `src/domain/catchUp.test.ts` |
| 20, 21 | `src/domain/progress.test.ts` |
| 17 (апку вбито посеред сесії) | `src/services/sessionService.test.ts` |
| 22 (видалення папки) | `src/services/routines.test.ts` |

## 7. Рішення, які я прийняв сам

Можеш заперечити будь-яке, поки немає коду.

1. **Назви в коді як в інтерфейсі** (розділ 1). Зараз перейменування безкоштовне, після першого коду — дороге.
2. **Тестуємо в Expo Go.** Нативних модулів у MVP немає. Live Activity, годинник і віджети потребують окремої збірки — це пізніше.
3. **Немає бібліотеки стану.** Менше коду й менше місць, де дані можуть розійтися. Zustand додамо, лише якщо знадобиться таймер відпочинку.
4. **Рекорди не зберігаються, а рахуються.** Історія однієї вправи — сотні підходів, це мілісекунди. Кеш додамо, тільки якщо стане повільно (ТЗ це дозволяє, розділ 2).
5. **М'язи — JSON у таблиці вправ.** Каталог маленький, тому він повністю завантажується в пам'ять, і фільтри працюють у JS.
6. **Вбудовані вправи мають фіксовані id у seed-файлі.** Оновлення каталогу в новій версії не створить дублікатів і не відірве історію.
7. **Знімок назви в сесії** (`title`). Якщо перейменуєш або видалиш програму, історія все одно покаже «12 вер, Push».
8. **«Одне активне тренування» і «одна активна папка» гарантує сама БД** (часткові унікальні індекси), а не лише код.
9. **Вага округлюється до 0.01 кг при записі.** Так «рівний результат — не рекорд» не ламається через похибки дробових чисел.
10. **Номер підходу для «Минулого разу» і ↑ рахується серед робочих.** Розминка не зсуває нумерацію: 1-й робочий порівнюється з 1-м робочим.
11. **«Наступне» після видалення програми:** береться наступна за місцем видаленої (рядок лишається в БД, тому місце відоме).
12. **Видалили активну папку** → активною стає перша з решти. Немає жодної → «Мої програми» створюється, коли додаєш програму.
13. **Додано м'яз «шия» (`neck`)** — у твоїх програмах є вправи на шию, а в ТЗ такої групи не було.
14. **Репозиторії тестуються справжнім SQL** у Node (better-sqlite3 + та сама схема Drizzle), а не лише руками на телефоні.

### Етап 3: уточнення правил ТЗ

Усі уточнення поведінки записані в самому `SPEC.md` (позначка «уточнено 15.10»), щоб уся логіка апки була в одному місці. Тут лише технічне: пошук зроблено без Fuse.js — власне нечітке порівняння дає точно ті рівні ранжування, що в ТЗ, і не додає залежність.

## 8. Етапи і як перевіряти кожен

| Етап | Результат | Перевірка |
|---|---|---|
| 2. Каркас | Expo-проєкт, схема, міграції, seed, `config.ts`, `CLAUDE.md` | `npm run check` (typecheck + lint + тести) зелений; Expo Go відкриває апку і показує кількість вправ у каталозі |
| 3. Домен | Усі функції розділу 6 | сценарії ТЗ 1–23 — зелені тести |
| 4. Дані і сервіс | Репозиторії, `SessionService` | тести репозиторіїв на справжній SQLite |
| 5. Технічний UI | Екрани з розділу 4 без дизайну | ручний сценарій: створити папку і програму → тренування → 🏆 і ↑ у підсумку |

Кожен етап — окремий коміт з номером етапу в назві («каркас проєкту (етап 2)»), щоб завжди можна було знайти робочу версію й відкотитися до неї.
