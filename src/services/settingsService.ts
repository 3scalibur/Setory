import { getSettings, setSetting, type UserSettings } from '@/data/settings';

import type { Deps } from './deps';

export type { UserSettings };

export function getUserSettings(deps: Deps): UserSettings {
  return getSettings(deps.db);
}

export function updateUserSetting<K extends keyof UserSettings>(deps: Deps, key: K, value: UserSettings[K]): void {
  setSetting(deps.db, key, value, deps.now());
}
