// Залежності застосунку на телефоні. Тести сюди не дивляться — у них createTestDeps().

import { randomUUID } from 'expo-crypto';

import { db } from '@/db/client';

import type { Deps } from './deps';

export const appDeps: Deps = {
  db,
  now: () => Date.now(),
  newId: () => randomUUID(),
};
