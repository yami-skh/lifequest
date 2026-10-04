// Резервная копия: всё в один .zip — data.json + фото. ARCHITECTURE.md §12.
import JSZip from 'jszip';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db, nowIso, type Entry, type EntrySkill, type Goal, type Node, type Note, type Photo, type Profile, type Unlocked } from '../db/db';
import { characterLevel } from '../engine/levels';
import { localDate } from '../engine/dates';

const FORMAT = 1;

interface BackupData {
  app: 'lifequest';
  format: number;
  exportedAt: string;
  profile: Profile | undefined;
  nodes: Node[];
  goals: Goal[];
  entries: Entry[];
  entrySkills: EntrySkill[];
  unlocked: Unlocked[];
  notes: Note[];
  photos: Omit<Photo, 'blob' | 'thumb'>[];
}

export interface BackupSummary { level: number; entries: number; photos: number; date?: string }

const summarize = (entries: Entry[], entrySkills: EntrySkill[], photos: number, date?: string): BackupSummary => ({
  level: characterLevel(entrySkills.filter((s) => s.role === 'primary').reduce((a, s) => a + s.xp, 0)).level,
  entries: entries.filter((e) => e.type !== 'bonus').length,
  photos,
  date,
});

export async function currentSummary(): Promise<BackupSummary> {
  const [entries, entrySkills, photos] = await Promise.all([db.entries.toArray(), db.entrySkills.toArray(), db.photos.count()]);
  return summarize(entries, entrySkills, photos);
}

async function buildZip() {
  const [profile, nodes, goals, entries, entrySkills, unlocked, notes, photos] = await Promise.all([
    db.profile.get('me'), db.nodes.toArray(), db.goals.toArray(), db.entries.toArray(),
    db.entrySkills.toArray(), db.unlocked.toArray(), db.notes.toArray(), db.photos.toArray(),
  ]);
  const exportedAt = nowIso();
  const data: BackupData = {
    app: 'lifequest', format: FORMAT, exportedAt,
    profile: profile ? { ...profile, lastBackupAt: exportedAt } : profile,
    nodes, goals, entries, entrySkills, unlocked, notes,
    photos: photos.map(({ blob: _b, thumb: _t, ...meta }) => meta),
  };
  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(data));
  for (const p of photos) {
    // Фото уже сжаты в JPEG: повторное сжатие их не уменьшает, только тратит время.
    zip.file(`photos/${p.id}.jpg`, p.blob, { compression: 'STORE' });
    zip.file(`photos/${p.id}.thumb.jpg`, p.thumb, { compression: 'STORE' });
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { blob, exportedAt, name: `lifequest-backup-${localDate()}.zip` };
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Сохраняет копию и открывает «Поделиться».
 * Возвращает 'shared' | 'downloaded' | 'cancelled'. Отметку о копии ставим только при успехе.
 */
export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const { blob, exportedAt, name } = await buildZip();
  let result: 'shared' | 'downloaded' | 'cancelled';

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache });
    try {
      await Share.share({ title: 'Резервная копия LifeQuest', files: [uri] });
      result = 'shared';
    } catch {
      result = 'cancelled';
    }
  } else {
    const file = new File([blob], name, { type: 'application/zip' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Резервная копия LifeQuest' });
        result = 'shared';
      } catch (e) {
        result = (e as DOMException)?.name === 'AbortError' ? 'cancelled' : download(blob, name);
      }
    } else {
      result = download(blob, name);
    }
  }

  if (result !== 'cancelled') await db.profile.update('me', { lastBackupAt: exportedAt });
  return result;
}

function download(blob: Blob, name: string): 'downloaded' {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export interface ParsedBackup { data: BackupData; zip: JSZip; summary: BackupSummary; fileName: string }

/** Читает файл копии и проверяет его. Бросает Error с понятным текстом. */
export async function readBackup(file: File): Promise<ParsedBackup> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('Это не архив .zip. Выбери файл lifequest-backup-….zip');
  }
  const json = zip.file('data.json');
  if (!json) throw new Error('В архиве нет data.json — это не копия LifeQuest');
  let data: BackupData;
  try {
    data = JSON.parse(await json.async('string'));
  } catch {
    throw new Error('Файл копии повреждён');
  }
  if (data.app !== 'lifequest') throw new Error('Это копия другого приложения');
  if (data.format > FORMAT) throw new Error('Копия сделана в более новой версии — сначала обнови приложение');
  return { data, zip, fileName: file.name, summary: summarize(data.entries, data.entrySkills, data.photos.length, data.exportedAt.slice(0, 10)) };
}

/** Полностью заменяет данные на устройстве данными из копии. */
export async function restoreBackup({ data, zip }: ParsedBackup) {
  const photos: Photo[] = [];
  for (const meta of data.photos) {
    const main = zip.file(`photos/${meta.id}.jpg`);
    const thumb = zip.file(`photos/${meta.id}.thumb.jpg`);
    if (!main || !thumb) continue;
    const [b, t] = await Promise.all([main.async('blob'), thumb.async('blob')]);
    photos.push({ ...meta, blob: new Blob([b], { type: 'image/jpeg' }), thumb: new Blob([t], { type: 'image/jpeg' }) });
  }
  const tables = [db.profile, db.nodes, db.goals, db.entries, db.entrySkills, db.unlocked, db.notes, db.photos];
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    if (data.profile) await db.profile.add({ ...data.profile, lastBackupAt: data.exportedAt });
    await db.nodes.bulkAdd(data.nodes);
    await db.goals.bulkAdd(data.goals);
    await db.entries.bulkAdd(data.entries);
    await db.entrySkills.bulkAdd(data.entrySkills);
    await db.unlocked.bulkAdd(data.unlocked);
    await db.notes.bulkAdd(data.notes);
    await db.photos.bulkAdd(photos);
  });
}
