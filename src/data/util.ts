/** БД повертає null там, де в домені «немає значення» = undefined. */
export function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

/** Новий порядок: позиція = індекс у списку. */
export function positionsFrom(ids: readonly string[]): Map<string, number> {
  return new Map(ids.map((id, index) => [id, index]));
}
