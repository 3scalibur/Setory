// Наскрізний прогін справжніх екранів у тестовому роутері Expo: створити програму → тренування → підсумок
// → наступного разу цифри підставлено. База — справжня SQLite у Node; нативні модулі замінено.

import { Alert } from 'react-native';
import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// ---------- Підміна нативного ----------

// Повідомлення «БД змінилась» для useLive: тест викликає їх після кожного запису.
const mockListeners = new Set<() => void>();
jest.mock('expo-sqlite', () => ({
  addDatabaseChangeListener: (listener: () => void) => {
    mockListeners.add(listener);
    return { remove: () => mockListeners.delete(listener) };
  },
}));

jest.mock('@/db/use-database-ready', () => ({ useDatabaseReady: () => ({ status: 'ready' }) }));

jest.mock('@/services/app-deps', () => {
  const { createTestDeps } = jest.requireActual('@/services/test-deps');
  const appDeps = {};
  /** Свіжа БД для кожного тесту. Кожен записуючий запит → «зміна в БД», як sqlite3_update_hook на телефоні. */
  const reset = () => {
    const test = createTestDeps();
    const prepare = test.sqlite.prepare.bind(test.sqlite);
    test.sqlite.prepare = (sql: string) => {
      const statement = prepare(sql);
      const run = statement.run.bind(statement);
      statement.run = (...args: unknown[]) => {
        const result = run(...args);
        mockListeners.forEach((l) => l());
        return result;
      };
      return statement;
    };
    Object.assign(appDeps, test.deps);
  };
  reset();
  return { appDeps, resetTestDb: reset };
});

// Нативні вкладки замінені простим Slot: вкладку відкриваємо за адресою.
const app = { appDir: 'src/app', overrides: { '(tabs)/_layout': () => <Slot /> } };

/** Підтверджувати всі діалоги «Завершити?» / «Видалити?» основною кнопкою. */
beforeEach(() => {
  jest.requireMock('@/services/app-deps').resetTestDb();
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.style !== 'cancel')?.onPress?.();
  });
});

/** Дочекатися, поки екрани перерахують дані після запису в БД. */
async function settle() {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
}

async function press(name: string | RegExp, index = 0) {
  fireEvent.press(screen.getAllByText(name)[index]);
  await settle();
}

describe('наскрізний сценарій', () => {
  it('програма → тренування → підсумок → наступного разу цифри з минулого разу', async () => {
    renderRouter(app, { initialUrl: '/' });
    await settle();

    expect(screen.getByText('Тренування')).toBeOnTheScreen();
    expect(screen.getByText('Мої програми')).toBeOnTheScreen();

    // Нова програма через конструктор і вибір вправи.
    await press('+ Програма');
    fireEvent.changeText(screen.getByPlaceholderText('Назва: Push, Pull, Legs…'), 'Push');
    await press('+ Додати вправи');
    fireEvent.changeText(screen.getByPlaceholderText('Жим лежачи, присед, bench…'), 'bench');
    await settle();
    await press('Жим штанги лежачи');
    await press('Додати (1)');
    expect(screen.getByText('Жим штанги лежачи')).toBeOnTheScreen();
    await press('Зберегти');

    // На вкладці — папка з програмою і «Наступне: Push».
    expect(screen.getAllByText('Push').length).toBeGreaterThan(0);
    expect(screen.getByText('Жим штанги лежачи')).toBeOnTheScreen();

    // Тренування: 1-й підхід 60 × 8, позначити виконаним, завершити.
    await press('Почати');
    expect(screen.getByText('Ще не виконувалась')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('кг, підхід 1'), '60');
    fireEvent.changeText(screen.getByLabelText('повт, підхід 1'), '8');
    await settle();
    fireEvent.press(screen.getAllByLabelText('Позначити виконаним')[0]);
    await settle();
    expect(screen.getByLabelText('Зняти позначку')).toBeOnTheScreen();
    await press('Завершити');

    // Підсумок.
    expect(screen.getByText('Рекорди: 0 · Прогрес у 0 вправах')).toBeOnTheScreen();
    await press('Готово');

    // Знову Push: підставлено 60 × 8 з минулого разу, «Попереднє» показує 60 × 8.
    await press('Почати');
    expect(screen.getByLabelText('кг, підхід 1')).toHaveDisplayValue('60');
    expect(screen.getByLabelText('повт, підхід 1')).toHaveDisplayValue('8');
    expect(screen.getByText(/Минулого разу:/)).toBeOnTheScreen();
    expect(screen.getAllByText('60 × 8').length).toBeGreaterThan(0);

    // Краще, ніж минулого разу → 🏆 (і новий рекорд у підсумку).
    fireEvent.changeText(screen.getByLabelText('кг, підхід 1'), '62.5');
    await settle();
    fireEvent.press(screen.getAllByLabelText('Позначити виконаним')[0]);
    await settle();
    expect(screen.getByText(/🏆/)).toBeOnTheScreen();
    await press('Завершити');
    expect(screen.getByText('Рекорди: 1 · Прогрес у 1 вправах')).toBeOnTheScreen();
  });

  it('вкладка «Вправи» → «Виконати» → окреме тренування; історія і пропущені відкриваються', async () => {
    renderRouter(app, { initialUrl: '/exercises' });
    await settle();

    fireEvent.changeText(screen.getByPlaceholderText('Жим лежачи, присед, bench…'), 'присед');
    await settle();
    expect(screen.getByText('Присідання зі штангою')).toBeOnTheScreen();
    await press('Виконати');
    expect(screen.getByText('Ще не виконувалась')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('кг, підхід 1'), '80');
    fireEvent.changeText(screen.getByLabelText('повт, підхід 1'), '6');
    await settle();
    fireEvent.press(screen.getAllByLabelText('Позначити виконаним')[0]);
    await settle();
    await press('Завершити');
    await press('Готово');

    await act(async () => {
      const { router } = jest.requireActual('expo-router');
      router.navigate('/history');
    });
    await settle();
    expect(screen.getByText('Окрема вправа')).toBeOnTheScreen();
    expect(screen.getByText('Присідання зі штангою — 1 підхід')).toBeOnTheScreen();

    await act(async () => {
      const { router } = jest.requireActual('expo-router');
      router.navigate('/backlog');
    });
    await settle();
    expect(screen.getByText('Пропущених немає 💪')).toBeOnTheScreen();
  });

  it('не можна позначити виконаним без цифр — зрозуміла помилка', async () => {
    renderRouter(app, { initialUrl: '/exercises' });
    await settle();

    await press('Виконати');
    fireEvent.press(screen.getAllByLabelText('Позначити виконаним')[0]);
    await settle();

    expect(Alert.alert).toHaveBeenCalledWith('Не вийшло', 'Вкажи вагу і повтори.');
  });
  it('прибрати вправу з програми → вона в пропущених → день пропущених її пропонує', async () => {
    const { appDeps } = jest.requireMock('@/services/app-deps');
    const { saveRoutine } = jest.requireActual('@/services/routineService');
    const { folderForNewRoutine } = jest.requireActual('@/services/folderService');
    const { ex } = jest.requireActual('@/services/test-deps');
    saveRoutine(appDeps, {
      folderId: folderForNewRoutine(appDeps),
      name: 'Pull',
      exercises: [
        { exerciseId: ex('pull up'), sets: [{ kind: 'working', repsMin: 8 }] },
        { exerciseId: ex('bicep curl (dumbbell)'), sets: [{ kind: 'working', repsMin: 12 }] },
      ],
    });
    renderRouter(app, { initialUrl: '/' });
    await settle();

    await press('Почати');
    fireEvent.changeText(screen.getAllByLabelText('повт, підхід 1')[0], '10');
    await settle();
    fireEvent.press(screen.getAllByLabelText('Позначити виконаним')[0]);
    await settle();
    // Біцепс прибираємо: друга кнопка «Прибрати» (перша — у підтягувань).
    await press('Прибрати', 1);
    expect(screen.getByText('Прибрані')).toBeOnTheScreen();
    expect(screen.getByText('Повернути')).toBeOnTheScreen();
    await press('Завершити');
    await press('Готово');

    expect(screen.getByText('Пропущені вправи')).toBeOnTheScreen();
    await press('Пропущені вправи');
    expect(screen.getByText('Згинання рук з гантелями (біцепс)')).toBeOnTheScreen();
    expect(screen.getByText(/Пропущено ×1, останній раз сьогодні \(Pull\)/)).toBeOnTheScreen();

    await press('Зібрати день пропущених');
    expect(screen.getByText('Згинання рук з гантелями (біцепс)')).toBeOnTheScreen();
    await press('Почати');
    expect(screen.getByText('Ще не виконувалась')).toBeOnTheScreen();
  });

  it('нова папка і власна вправа з попередженням про схожу назву', async () => {
    renderRouter(app, { initialUrl: '/' });
    await settle();

    await press('+ Папка');
    fireEvent.changeText(screen.getByPlaceholderText('Назва: PPL, Додаткове…'), 'PPL');
    await press('Створити');
    expect(screen.getByText('PPL')).toBeOnTheScreen();

    await act(async () => {
      const { router } = jest.requireActual('expo-router');
      router.push('/exercise/edit');
    });
    await settle();
    fireEvent.changeText(screen.getByPlaceholderText('Назва'), 'Жим штанги лежачі');
    await press('Груди');
    await press('Створити');
    // Діалог «Схожа вправа вже є» підтверджено → вправу створено і відкрито її картку.
    expect(Alert.alert).toHaveBeenCalledWith('Схожа вправа вже є', expect.stringContaining('Жим штанги лежачи'), expect.anything());
    expect(screen.getByText('Власна вправа')).toBeOnTheScreen();
  });
});
