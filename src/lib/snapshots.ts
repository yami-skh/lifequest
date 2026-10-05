// Хранилище снимков: отдельная база IndexedDB, чтобы очистка основной базы при восстановлении её не трогала.
// Снимок = тот же .zip, что и резервная копия (data.json + фото). Делается сам перед каждым восстановлением.
import Dexie, { type Table } from 'dexie';
import { snapshotsToPrune } from '../engine/snapshots';

export type SnapshotReason = 'before-restore' | 'before-undo' | 'before-channel';
export interface SnapshotSummary { level: number; entries: number; photos: number }
export interface Snapshot { id: string; createdAt: string; reason: SnapshotReason; version: string; summary: SnapshotSummary; blob: Blob }

class SnapshotDB extends Dexie {
  snapshots!: Table<Snapshot, string>;
  constructor() {
    super('lifequest-snapshots');
    this.version(1).stores({ snapshots: 'id, createdAt' });
  }
}
const sdb = new SnapshotDB();

/** Сохранить снимок и удалить лишние старые. Ошибка пробрасывается — восстановление без снимка не начинается. */
export async function saveSnapshot(blob: Blob, reason: SnapshotReason, summary: SnapshotSummary) {
  const snap: Snapshot = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), reason, version: __APP_VERSION__, summary, blob };
  await sdb.snapshots.add(snap);
  const prune = snapshotsToPrune(await sdb.snapshots.toArray());
  if (prune.length) await sdb.snapshots.bulkDelete(prune);
  return snap;
}

/** Снимки, новые сверху. */
export const listSnapshots = () => sdb.snapshots.orderBy('createdAt').reverse().toArray();
export const getSnapshot = (id: string) => sdb.snapshots.get(id);
