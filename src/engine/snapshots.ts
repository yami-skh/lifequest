// Снимки данных перед восстановлением копии: сколько хранить и какие удалить. Чистые функции.

/** Сколько последних снимков хранить на устройстве. */
export const SNAPSHOT_KEEP = 3;

/** id снимков, которые надо удалить: всё, кроме `keep` самых новых. */
export function snapshotsToPrune(list: readonly { id: string; createdAt: string }[], keep = SNAPSHOT_KEEP): string[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(keep).map((s) => s.id);
}
