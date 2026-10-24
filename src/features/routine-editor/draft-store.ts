// Чернетка програми, яку редагують кілька екранів (конструктор і вибір вправ).
// Живе в пам'яті до збереження; у БД потрапляє лише через saveRoutine.

import { useSyncExternalStore } from 'react';

import type { RoutineDraft, RoutineExerciseDraft, RoutineSetDraft } from '@/services/routineService';

export type EditorSet = RoutineSetDraft & { key: string };
export type EditorExercise = Omit<RoutineExerciseDraft, 'sets'> & { key: string; sets: EditorSet[] };
/** editorKey — якому відкритому екрану конструктора належить чернетка (щоб не показати чужу). */
export type EditorDraft = Omit<RoutineDraft, 'exercises'> & { exercises: EditorExercise[]; editorKey?: string };

let draft: EditorDraft | null = null;
let counter = 0;
const listeners = new Set<() => void>();

export const newKey = () => `k${++counter}`;

export const draftStore = {
  get: (): EditorDraft | null => draft,
  set(next: EditorDraft | null) {
    draft = next;
    listeners.forEach((l) => l());
  },
  update(fn: (d: EditorDraft) => EditorDraft) {
    if (draft) draftStore.set(fn(draft));
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useDraft(): EditorDraft | null {
  return useSyncExternalStore(draftStore.subscribe, draftStore.get, draftStore.get);
}

/** Чернетка з програми (або порожня) → чернетка редактора з ключами для списків. */
export function toEditorDraft(d: RoutineDraft): EditorDraft {
  return {
    ...d,
    exercises: d.exercises.map((e) => ({
      ...e,
      key: newKey(),
      sets: e.sets.map((s) => ({ ...s, key: newKey() })),
    })),
  };
}

/** Додати вправи з вибору: по 3 робочі підходи без цифр. */
export function addExercisesToDraft(exerciseIds: readonly string[]) {
  draftStore.update((d) => ({
    ...d,
    exercises: [
      ...d.exercises,
      ...exerciseIds.map((exerciseId) => ({
        key: newKey(),
        exerciseId,
        sets: [0, 1, 2].map(() => ({ key: newKey(), kind: 'working' as const })),
      })),
    ],
  }));
}
