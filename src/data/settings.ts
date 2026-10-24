import { DEFAULT_SETTINGS } from '@/config';
import { settings } from '@/db/schema';
import type { Db } from '@/db/types';

export type UserSettings = typeof DEFAULT_SETTINGS;
type SettingKey = keyof UserSettings;

const KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

export function getSettings(db: Db): UserSettings {
  const stored = new Map(db.select().from(settings).all().map((r) => [r.key, r.value]));
  const out: UserSettings = { ...DEFAULT_SETTINGS };
  for (const key of KEYS) {
    if (stored.has(key)) Object.assign(out, { [key]: stored.get(key) });
  }
  return out;
}

export function setSetting<K extends SettingKey>(db: Db, key: K, value: UserSettings[K], now: number): void {
  db.insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
    .run();
}
