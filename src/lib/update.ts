// Автообновление APK. Сайт обновляется сам (service worker), здесь — только приложение.
// version.json на GitHub Pages: { version, native, bundle, checksum, apk } — пишет scripts/deploy.mjs.
//  - веб-часть новее, а APK подходит → тихо качаем bundle, включится при сворачивании/перезапуске;
//  - нужен новый APK (появились нативные плагины) → карточка «Доступна версия» (useUpdate).
import { useEffect, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileTransfer } from '@capacitor/file-transfer';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { cmpVersion } from '../engine/version';
import { getChannel } from './channel';
import { toast } from './toast';
import { logError } from './errorlog';

export const SITE = 'https://yami-skh.github.io/lifequest/';
/** Канал APK: стабильная — корень сайта, бета — папка beta/ (scripts/deploy.mjs --beta). */
const channelSite = () => (getChannel() === 'beta' ? `${SITE}beta/` : SITE);
export interface Remote { version: string; native: string; bundle: string; checksum: string; apk: string }

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest' }
  | { kind: 'web'; version: string } // скачано, включится при следующем запуске
  | { kind: 'apk'; remote: Remote } // нужен новый APK
  | { kind: 'downloading'; remote: Remote; pct: number }
  | { kind: 'error'; remote?: Remote };

let state: UpdateState = { kind: 'idle' };
const listeners = new Set<(s: UpdateState) => void>();
const setState = (s: UpdateState) => {
  state = s;
  listeners.forEach((l) => l(s));
};

export function useUpdate() {
  const [s, set] = useState(state);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return s;
}

async function fetchRemote(): Promise<Remote | null> {
  try {
    const r = await fetch(`${channelSite()}version.json?t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? ((await r.json()) as Remote) : null;
  } catch {
    return null;
  }
}

/** Проверка обновлений. В браузере ничего не делает. manual — нажали «Проверить»: сказать, что нашли. */
export async function checkForUpdate(manual = false) {
  if (!Capacitor.isNativePlatform()) return;
  if (state.kind === 'checking' || state.kind === 'downloading') return;
  setState({ kind: 'checking' });
  const remote = await fetchRemote();
  if (!remote) {
    if (manual) toast({ kind: 'info', title: 'Не удалось проверить', sub: 'Нет интернета?' });
    return setState({ kind: 'idle' });
  }
  const apk = (await App.getInfo()).version;
  if (cmpVersion(remote.native, apk) > 0) return setState({ kind: 'apk', remote });
  if (cmpVersion(remote.version, __APP_VERSION__) <= 0) {
    if (manual) toast({ kind: 'info', title: 'Это последняя версия' });
    return setState({ kind: 'latest' });
  }
  try {
    const bundle = await CapacitorUpdater.download({ url: new URL(remote.bundle, channelSite()).href, version: remote.version, checksum: remote.checksum });
    await CapacitorUpdater.next({ id: bundle.id });
    setState({ kind: 'web', version: remote.version });
    if (manual) toast({ kind: 'info', title: `Скачана версия ${remote.version}`, sub: 'Включится при следующем запуске' });
  } catch (e) {
    logError(e, 'Обновление');
    setState({ kind: 'idle' });
  }
}

/** Скачать новый APK и открыть установщик Android. */
export async function installApk() {
  if (state.kind !== 'apk' && state.kind !== 'error') return;
  const remote = state.remote;
  if (!remote) return;
  setState({ kind: 'downloading', remote, pct: 0 });
  const progress = await FileTransfer.addListener('progress', (p) => {
    if (p.lengthComputable && p.contentLength) setState({ kind: 'downloading', remote, pct: Math.round((p.bytes / p.contentLength) * 100) });
  });
  try {
    const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: 'LifeQuest-update.apk' });
    await FileTransfer.downloadFile({ url: remote.apk, path: uri, progress: true });
    await FileOpener.openFile({ path: uri, mimeType: 'application/vnd.android.package-archive' });
    setState({ kind: 'apk', remote });
  } catch (e) {
    logError(e, 'Скачивание APK');
    setState({ kind: 'error', remote });
  } finally {
    progress.remove();
  }
}

/** При запуске APK: подтвердить, что текущая сборка жива (иначе плагин откатит), и проверить обновления. */
export function initUpdates() {
  if (!Capacitor.isNativePlatform()) return;
  CapacitorUpdater.notifyAppReady().catch(() => {});
  checkForUpdate();
  // Проверяем и при возвращении в приложение, но не чаще раза в 6 часов.
  let last = Date.now();
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive && Date.now() - last > 6 * 3600_000) {
      last = Date.now();
      checkForUpdate();
    }
  });
}
