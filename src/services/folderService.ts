// Папки (SPEC.md, розділ 10б). Видалення папки не чіпає історію — вона належить вправам.

import { DEFAULT_FOLDER_NAME } from '@/config';
import * as data from '@/data/folders';
import { positionsFrom } from '@/data/util';

import { inTransaction, UserError, type Deps } from './deps';

export function createFolder(deps: Deps, name: string): string {
  const clean = requireName(name);
  return inTransaction(deps, (d) => {
    const id = d.newId();
    const isFirstLive = data.getActiveFolder(d.db) === undefined;
    data.insertFolder(d.db, { id, name: clean, position: data.nextFolderPosition(d.db), isActive: isFirstLive }, d.now());
    return id;
  });
}

export function renameFolder(deps: Deps, id: string, name: string): void {
  const clean = requireName(name);
  inTransaction(deps, (d) => {
    requireFolder(d, id);
    data.updateFolder(d.db, id, { name: clean }, d.now());
  });
}

export function reorderFolders(deps: Deps, orderedIds: readonly string[]): void {
  inTransaction(deps, (d) => {
    const positions = positionsFrom(orderedIds);
    const now = d.now();
    for (const f of data.listFolders(d.db)) {
      const position = positions.get(f.id);
      if (position !== undefined && position !== f.position) data.updateFolder(d.db, f.id, { position }, now);
    }
  });
}

/** Активна папка одна: з неї рахується «Наступне». */
export function setActiveFolder(deps: Deps, id: string): void {
  inTransaction(deps, (d) => {
    requireFolder(d, id);
    const current = data.getActiveFolder(d.db);
    if (current?.id === id) return;
    const now = d.now();
    if (current) data.updateFolder(d.db, current.id, { isActive: false }, now);
    data.updateFolder(d.db, id, { isActive: true }, now);
  });
}

/** Видаляє папку разом з її програмами. Якщо вона була активною — активною стає перша з решти. */
export function deleteFolder(deps: Deps, id: string): void {
  inTransaction(deps, (d) => {
    const folder = requireFolder(d, id);
    const now = d.now();
    data.softDeleteFolderRoutines(d.db, id, now);
    data.updateFolder(d.db, id, { deletedAt: now, isActive: false }, now);
    if (folder.isActive) {
      const next = data.listFolders(d.db)[0];
      if (next) data.updateFolder(d.db, next.id, { isActive: true }, now);
    }
  });
}

/** Папка для нової програми: активна, інакше перша, інакше створюємо «Мої програми». */
export function folderForNewRoutine(deps: Deps): string {
  return inTransaction(deps, (d) => {
    const existing = data.getActiveFolder(d.db) ?? data.listFolders(d.db)[0];
    return existing?.id ?? createFolder(d, DEFAULT_FOLDER_NAME);
  });
}

function requireName(name: string): string {
  const clean = name.trim();
  if (!clean) throw new UserError('Вкажи назву папки.');
  return clean;
}

function requireFolder(d: Deps, id: string) {
  const folder = data.getFolder(d.db, id);
  if (!folder) throw new UserError('Папку не знайдено.');
  return folder;
}
