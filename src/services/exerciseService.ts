// Каталог: пошук, власні вправи, картка вправи (SPEC.md, розділ 10).

import * as data from '@/data/exercises';
import { loadHistorySets } from '@/data/history';
import { lastPerformance, type LastPerformance } from '@/domain/performance';
import { rebuildPRs, currentBests, type PRType } from '@/domain/records';
import { searchExercises, similarExercises, type SearchFilters } from '@/domain/search';
import type { Equipment, ExerciseType, Mechanic, MuscleGroup, PerformedSet, SessionSource } from '@/domain/types';

import { inTransaction, UserError, type Deps } from './deps';
import { groupBy } from './sessionService';

export function searchCatalog(deps: Deps, query: string, filters: SearchFilters = {}): data.ExerciseRow[] {
  return searchExercises(query, data.listExercises(deps.db), data.exerciseUsage(deps.db), filters);
}

/** Схожі назви — попередження перед створенням власної вправи, щоб не роздвоїти історію. */
export function findSimilarExercises(deps: Deps, name: string): data.ExerciseRow[] {
  return similarExercises(name, data.listExercises(deps.db).filter((e) => !e.archivedAt));
}

export interface CustomExerciseInput {
  name: string;
  type: ExerciseType;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment;
  mechanic: Mechanic;
  aliases?: string[];
  instructions?: string;
  mediaUrl?: string;
}

export function createCustomExercise(deps: Deps, input: CustomExerciseInput): string {
  const fields = validate(input);
  return inTransaction(deps, (d) => {
    const id = d.newId();
    data.insertExercise(d.db, id, fields, d.now());
    return id;
  });
}

/** Тип вправи не можна змінити, якщо вже є історія. */
export function updateCustomExercise(deps: Deps, id: string, input: CustomExerciseInput): void {
  const fields = validate(input);
  inTransaction(deps, (d) => {
    const existing = requireCustom(d, id);
    if (existing.type !== fields.type && data.hasHistory(d.db, id)) {
      throw new UserError('Тип вправи не можна змінити: у неї вже є історія.');
    }
    data.updateExercise(d.db, id, fields, d.now());
  });
}

/** Видалення вправи, на яку щось посилається, = архівація (історія лишається). */
export function removeCustomExercise(deps: Deps, id: string): 'archived' | 'deleted' {
  return inTransaction(deps, (d) => {
    requireCustom(d, id);
    if (data.isReferenced(d.db, id)) {
      data.archiveExercise(d.db, id, d.now());
      return 'archived';
    }
    data.softDeleteExercise(d.db, id, d.now());
    return 'deleted';
  });
}

export interface ExerciseCard {
  exercise: data.ExerciseRow;
  /** Поточні рекорди: найбільша вага, 1ПМ, об'єм… */
  bests: Partial<Record<PRType, number>>;
  /** Усі виконання, нові зверху, з позначкою джерела і 🏆 на свій момент. */
  history: {
    sessionId: string;
    source: SessionSource;
    sessionTitle: string;
    finishedAt: number;
    sets: (PerformedSet & { id: string; prs: PRType[] })[];
  }[];
}

export function getExerciseCard(deps: Deps, id: string): ExerciseCard | null {
  const exercise = data.getExercise(deps.db, id);
  if (!exercise || exercise.deletedAt !== null) return null;
  const sets = loadHistorySets(deps.db, [id]);
  const records = rebuildPRs(sets, exercise.type);
  const bySession = groupBy(
    [...sets].sort((a, b) => a.exercisePosition - b.exercisePosition || a.position - b.position),
    (s) => s.sessionId,
  );

  return {
    exercise,
    bests: currentBests(sets, exercise.type),
    history: [...bySession.values()]
      .map((list) => ({
        sessionId: list[0].sessionId,
        source: list[0].source,
        sessionTitle: list[0].sessionTitle,
        finishedAt: list[0].finishedAt,
        sets: list.map((s) => ({
          id: s.id,
          kind: s.kind,
          weightKg: s.weightKg,
          reps: s.reps,
          durationSec: s.durationSec,
          distanceM: s.distanceM,
          prs: records.get(s.id) ?? [],
        })),
      }))
      .sort((a, b) => b.finishedAt - a.finishedAt),
  };
}

function validate(input: CustomExerciseInput): data.ExerciseFields {
  const name = input.name.trim();
  if (!name) throw new UserError('Вкажи назву вправи.');
  if (input.primaryMuscles.length === 0) throw new UserError('Обери хоча б один основний м’яз.');
  return {
    name,
    aliases: (input.aliases ?? []).map((a) => a.trim()).filter(Boolean),
    primaryMuscles: input.primaryMuscles,
    secondaryMuscles: (input.secondaryMuscles ?? []).filter((m) => !input.primaryMuscles.includes(m)),
    equipment: input.equipment,
    type: input.type,
    mechanic: input.mechanic,
    instructions: input.instructions?.trim() || undefined,
    mediaUrl: input.mediaUrl?.trim() || undefined,
  };
}

function requireCustom(d: Deps, id: string) {
  const e = data.getExercise(d.db, id);
  if (!e || e.deletedAt !== null) throw new UserError('Вправу не знайдено.');
  if (!e.isCustom) throw new UserError('Вбудовані вправи змінювати не можна.');
  return e;
}

export interface ExerciseBrief {
  id: string;
  name: string;
  type: ExerciseType;
  mechanic: Mechanic;
  primaryMuscles: MuscleGroup[];
  equipment: Equipment;
  isCustom: boolean;
}

/** Коротка інформація про вправи за id (для конструктора програми). */
export function getExerciseBriefs(deps: Deps, ids: readonly string[]): Map<string, ExerciseBrief> {
  const wanted = new Set(ids);
  return new Map(
    data
      .listExercises(deps.db)
      .filter((e) => wanted.has(e.id))
      .map((e) => [
        e.id,
        { id: e.id, name: e.name, type: e.type, mechanic: e.mechanic, primaryMuscles: e.primaryMuscles, equipment: e.equipment, isCustom: e.isCustom },
      ]),
  );
}

/** «Минулого разу» для кількох вправ одразу. */
export function getLastPerformances(deps: Deps, ids: readonly string[]): Map<string, LastPerformance | null> {
  const history = loadHistorySets(deps.db, ids);
  return new Map(ids.map((id) => [id, lastPerformance(id, history)]));
}
