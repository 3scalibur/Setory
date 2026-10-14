// Пошук вправ (SPEC.md, розділ 10): назва + синоніми укр/рос/англ, нормалізація, толерантність до одруків.
// Ранжування: збіг з початку назви > початок слова > «містить» > нечіткий збіг;
// при рівності — ті, що робив нещодавно і частіше, потім точніший збіг, потім за абеткою.

import { normalizeText } from './text';
import type { Equipment, MuscleGroup } from './types';

export interface SearchableExercise {
  id: string;
  name: string;
  aliases: readonly string[];
  primaryMuscles: readonly MuscleGroup[];
  equipment: Equipment;
  archivedAt?: number | null;
}

export interface ExerciseUsage {
  lastDoneAt: number;
  count: number;
}

export interface SearchFilters {
  muscle?: MuscleGroup;
  equipment?: Equipment;
}

const TIER_WHOLE_PREFIX = 0;
const TIER_WORD_PREFIX = 1;
const TIER_CONTAINS = 2;
const TIER_FUZZY = 3;

/**
 * Порожній запит → спершу вправи, які вже робив (недавні вище), далі решта за абеткою.
 * Архівні вправи не показуються.
 */
export function searchExercises<T extends SearchableExercise>(
  query: string,
  catalog: readonly T[],
  usage: ReadonlyMap<string, ExerciseUsage>,
  filters: SearchFilters = {},
): T[] {
  const visible = catalog.filter(
    (e) =>
      !e.archivedAt &&
      (!filters.muscle || e.primaryMuscles.includes(filters.muscle)) &&
      (!filters.equipment || e.equipment === filters.equipment),
  );
  const byUsage = (a: T, b: T) => {
    const ua = usage.get(a.id);
    const ub = usage.get(b.id);
    return (ub?.lastDoneAt ?? -Infinity) - (ua?.lastDoneAt ?? -Infinity) || (ub?.count ?? 0) - (ua?.count ?? 0);
  };
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'uk');

  const q = normalizeText(query);
  if (!q) return [...visible].sort((a, b) => byUsage(a, b) || byName(a, b));

  const tokens = words(q);
  const scored: { e: T; tier: number; length: number }[] = [];
  for (const e of visible) {
    let best: { tier: number; length: number } | null = null;
    for (const term of termsOf(e)) {
      const tier = matchTier(q, tokens, term);
      if (tier === null) continue;
      if (!best || tier < best.tier || (tier === best.tier && term.length < best.length)) {
        best = { tier, length: term.length };
      }
    }
    if (best) scored.push({ e, ...best });
  }

  return scored
    .sort((a, b) => a.tier - b.tier || byUsage(a.e, b.e) || a.length - b.length || byName(a.e, b.e))
    .map((s) => s.e);
}

/** Вправи з такою самою або майже такою самою назвою — попередження при створенні власної. */
export function similarExercises<T extends SearchableExercise>(name: string, catalog: readonly T[]): T[] {
  const n = normalizeText(name);
  if (!n) return [];
  const maxDistance = n.length >= 8 ? 2 : 1;
  return catalog.filter((e) => termsOf(e).some((term) => term === n || editDistance(n, term) <= maxDistance));
}

function matchTier(query: string, tokens: string[], term: string): number | null {
  if (term.startsWith(query)) return TIER_WHOLE_PREFIX;
  const termWords = words(term);
  let worst = TIER_WORD_PREFIX;
  for (const token of tokens) {
    let tier: number | null = null;
    if (termWords.some((w) => w.startsWith(token))) tier = TIER_WORD_PREFIX;
    else if (term.includes(token)) tier = TIER_CONTAINS;
    else if (fuzzyWordMatch(token, termWords)) tier = TIER_FUZZY;
    if (tier === null) return null;
    worst = Math.max(worst, tier);
  }
  return worst;
}

/** Одрук: слово (або його початок) відрізняється на 1 символ, для довгих слів — на 2. Короткі слова — лише точно. */
function fuzzyWordMatch(token: string, termWords: string[]): boolean {
  if (token.length < 4) return false;
  const maxDistance = token.length >= 7 ? 2 : 1;
  return termWords.some(
    (w) => Math.min(editDistance(token, w.slice(0, token.length)), editDistance(token, w)) <= maxDistance,
  );
}

// Цифри, латиниця і кирилиця (укр/рос). Явний набір замість \p{L}: так надійніше в рушії Hermes на телефоні.
const NON_WORD = /[^0-9a-zа-џґ]+/;

/** Текст уже нормалізований (нижній регістр). */
function words(text: string): string[] {
  return text.split(NON_WORD).filter(Boolean);
}

const termsCache = new WeakMap<SearchableExercise, string[]>();

function termsOf(e: SearchableExercise): string[] {
  let terms = termsCache.get(e);
  if (!terms) {
    terms = [...new Set([e.name, ...e.aliases].map(normalizeText))];
    termsCache.set(e, terms);
  }
  return terms;
}

/** Відстань редагування (вставка, видалення, заміна, перестановка сусідніх символів). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}
