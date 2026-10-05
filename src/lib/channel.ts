// Канал обновлений APK: «стабильная» (по умолчанию, у брата) или «бета» (каждая новая сборка).
// Сайт: стабильная — https://yami-skh.github.io/lifequest/, бета — …/lifequest/beta/ (у них общие данные: один адрес сайта).
// Переход «бета → стабильная» — только через снимок данных: миграции базы идут лишь вперёд.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { db } from '../db/db';
import { cmpVersion } from '../engine/version';
import { takeSnapshot } from './backup';

export type Channel = 'stable' | 'beta';
const KEY = 'lq.channel';
export const SITE = 'https://yami-skh.github.io/lifequest/';

export function getChannel(): Channel {
  if (!Capacitor.isNativePlatform()) return location.pathname.includes('/beta/') ? 'beta' : 'stable';
  try {
    return localStorage.getItem(KEY) === 'beta' ? 'beta' : 'stable';
  } catch {
    return 'stable';
  }
}

const remember = (ch: Channel) => {
  try {
    localStorage.setItem(KEY, ch);
  } catch {
    /* не критично */
  }
};

/**
 * Сменить канал в APK. На бету — просто следующая проверка возьмёт бету.
 * На стабильную — снимок данных, скачать стабильную сборку и сразу включить её (приложение перезапустится).
 * Раньше тут был откат к сборке из APK — человек видел старую 0.9, пока не перезапустит ещё раз.
 * Нет интернета — канал не меняется (ошибка с понятным текстом).
 */
export async function setChannel(ch: Channel) {
  if (ch === 'beta' || !Capacitor.isNativePlatform()) return remember(ch);

  let remote: { version: string; native: string; bundle: string; checksum: string };
  try {
    const r = await fetch(`${SITE}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    remote = await r.json();
  } catch {
    throw new Error('Нет связи с сайтом — канал не сменён');
  }
  await takeSnapshot('before-channel');
  const apk = (await App.getInfo()).version;
  // Стабильной нужен APK новее установленного — только откат к сборке из APK, дальше обычное обновление.
  if (cmpVersion(remote.native, apk) > 0) {
    remember('stable');
    await db.close();
    await CapacitorUpdater.reset({ toLastSuccessful: false });
    return;
  }
  const bundle = await CapacitorUpdater.download({ url: new URL(remote.bundle, SITE).href, version: remote.version, checksum: remote.checksum });
  remember('stable');
  await db.close();
  await CapacitorUpdater.set({ id: bundle.id });
}
