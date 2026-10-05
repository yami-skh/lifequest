// Канал обновлений APK: «стабильная» (по умолчанию, у брата) или «бета» (каждая новая сборка).
// Сайт: стабильная — https://yami-skh.github.io/lifequest/, бета — …/lifequest/beta/ (у них общие данные: один адрес сайта).
// Переход «бета → стабильная» — только через снимок данных: миграции базы идут лишь вперёд.
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { db } from '../db/db';
import { takeSnapshot } from './backup';

export type Channel = 'stable' | 'beta';
const KEY = 'lq.channel';

export function getChannel(): Channel {
  if (!Capacitor.isNativePlatform()) return location.pathname.includes('/beta/') ? 'beta' : 'stable';
  try {
    return localStorage.getItem(KEY) === 'beta' ? 'beta' : 'stable';
  } catch {
    return 'stable';
  }
}

/**
 * Сменить канал в APK. На бету — просто следующая проверка возьмёт бету.
 * На стабильную — снимок данных, затем откат к сборке из APK; дальше обновится до стабильной.
 */
export async function setChannel(ch: Channel) {
  try {
    localStorage.setItem(KEY, ch);
  } catch {
    /* не критично */
  }
  if (ch === 'stable' && Capacitor.isNativePlatform()) {
    await takeSnapshot('before-channel');
    await db.close();
    await CapacitorUpdater.reset({ toLastSuccessful: false });
  }
}
