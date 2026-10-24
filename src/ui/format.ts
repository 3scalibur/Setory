// Тексти інтерфейсу і форматування чисел, дат, підходів.

import type { PRType } from '@/domain/records';
import type {
  Equipment,
  ExerciseType,
  Mechanic,
  MuscleGroup,
  SessionSource,
  SetKind,
  SetValues,
  TargetSet,
} from '@/domain/types';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Груди',
  lats: 'Найширші',
  upper_back: 'Верх спини',
  lower_back: 'Поперек',
  traps: 'Трапеції',
  neck: 'Шия',
  front_delts: 'Передні дельти',
  side_delts: 'Середні дельти',
  rear_delts: 'Задні дельти',
  biceps: 'Біцепс',
  triceps: 'Трицепс',
  forearms: 'Передпліччя',
  abs: 'Прес',
  quads: 'Квадрицепси',
  hamstrings: 'Біцепс стегна',
  glutes: 'Сідниці',
  calves: 'Ікри',
  adductors: 'Привідні',
  abductors: 'Відвідні',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Штанга',
  dumbbell: 'Гантелі',
  machine: 'Тренажер',
  cable: 'Блок',
  bodyweight: 'Власна вага',
  kettlebell: 'Гиря',
  band: 'Резина',
  other: 'Інше',
};

export const TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Вага × повтори',
  bodyweight_reps: 'Власна вага',
  weighted_bodyweight: 'Власна вага + обтяження',
  assisted_bodyweight: 'З допомогою (гравітрон)',
  duration: 'Час',
  distance_duration: 'Дистанція і час',
};

export const MECHANIC_LABELS: Record<Mechanic, string> = {
  compound: 'Базова',
  isolation: 'Ізолююча',
};

export const KIND_LABELS: Record<SetKind, string> = {
  working: 'Робочий',
  warmup: 'Розминка',
  drop: 'Дроп',
  failure: 'До відмови',
};

/** Коротка позначка підходу в таблиці: номер робочого або літера. */
export const KIND_SHORT: Record<Exclude<SetKind, 'working'>, string> = {
  warmup: 'Р',
  drop: 'Д',
  failure: 'В',
};

export const NEXT_KIND: Record<SetKind, SetKind> = {
  working: 'warmup',
  warmup: 'drop',
  drop: 'failure',
  failure: 'working',
};

export const PR_LABELS: Record<PRType, string> = {
  max_weight: 'найбільша вага',
  max_reps_at_weight: 'найбільше повторів з цією вагою',
  e1rm: 'розрахунковий 1ПМ',
  max_volume: 'найбільший об’єм підходу',
  max_reps: 'найбільше повторів',
  min_assistance: 'найменша допомога',
  max_reps_at_assistance: 'найбільше повторів з цією допомогою',
  max_duration: 'найдовший час',
  max_distance: 'найбільша дистанція',
};

export function musclesText(muscles: readonly MuscleGroup[]): string {
  return muscles.map((m) => MUSCLE_LABELS[m]).join(', ');
}

/** «окремо», «день пропущених»… для «Минулого разу»; для програми — її назва. */
export function sourceLabel(source: SessionSource, title: string): string {
  switch (source) {
    case 'routine':
      return title;
    case 'single_exercise':
      return 'окремо';
    case 'catch_up':
      return 'день пропущених';
    case 'free':
      return 'вільне тренування';
  }
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.round(total % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** «60 × 8», «12 повт.», «1:30», «2000 м · 10:00», «−20 кг × 8». */
export function formatSet(v: SetValues, type: ExerciseType): string {
  const reps = v.reps !== undefined ? String(v.reps) : '—';
  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight':
      return `${v.weightKg !== undefined ? formatNumber(v.weightKg) : '—'} × ${reps}`;
    case 'assisted_bodyweight':
      return `−${v.weightKg !== undefined ? formatNumber(v.weightKg) : '—'} × ${reps}`;
    case 'bodyweight_reps':
      return `${reps} повт.`;
    case 'duration':
      return v.durationSec !== undefined ? formatSeconds(v.durationSec) : '—';
    case 'distance_duration':
      return `${v.distanceM !== undefined ? formatNumber(v.distanceM) : '—'} м · ${v.durationSec !== undefined ? formatSeconds(v.durationSec) : '—'}`;
  }
}

export function formatReps(min?: number, max?: number): string {
  if (min === undefined) return '';
  return max !== undefined && max !== min ? `${min}–${max}` : String(min);
}

/** «ціль: 3 × 8–10», якщо робочі підходи однакові; інакше «ціль: 10, 8, 6». */
export function formatTarget(targets: readonly TargetSet[] | undefined): string | null {
  const working = (targets ?? []).filter((t) => t.kind !== 'warmup');
  if (working.length === 0) return null;
  const ranges = working.map((t) => formatReps(t.repsMin, t.repsMax) || formatDuration(t.durationSec));
  if (ranges.every((r) => r === '')) return null;
  return ranges.every((r) => r === ranges[0])
    ? `ціль: ${working.length} × ${ranges[0]}`
    : `ціль: ${ranges.join(', ')}`;
}

function formatDuration(sec?: number): string {
  return sec !== undefined ? formatSeconds(sec) : '';
}

const dateFormat = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' });
const dateTimeFormat = new Intl.DateTimeFormat('uk-UA', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(ms: number): string {
  return dateFormat.format(new Date(ms));
}

export function formatDateTime(ms: number): string {
  return dateTimeFormat.format(new Date(ms));
}

export function formatMinutes(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} год ${minutes % 60} хв` : `${minutes} хв`;
}

/** 1 день, 2 дні, 5 днів. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function daysAgo(ms: number, now: number): string {
  const days = Math.floor((now - ms) / 86_400_000);
  if (days <= 0) return 'сьогодні';
  if (days === 1) return 'вчора';
  return `${days} ${plural(days, 'день', 'дні', 'днів')} тому`;
}

/** Розбір введеного числа: «62,5» → 62.5; порожньо → null; не число → undefined (ігнорувати). */
export function parseNumber(text: string): number | null | undefined {
  const clean = text.replace(',', '.').trim();
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** «8» → {8, 8}; «8-10» / «8–10» → {8, 10}. */
export function parseRepRange(text: string): { repsMin?: number; repsMax?: number } | undefined {
  const clean = text.trim();
  if (clean === '') return {};
  const m = clean.match(/^(\d+)\s*(?:[-–—]\s*(\d+))?$/);
  if (!m) return undefined;
  const min = Number(m[1]);
  const max = m[2] !== undefined ? Number(m[2]) : min;
  return { repsMin: min, repsMax: max };
}
