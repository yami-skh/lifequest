import { render } from 'preact';
import { App } from './App';
import { ensureStarter, seedIfEmpty } from './db/seed';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import { initBackButton } from './lib/backButton';
import { initUpdates } from './lib/update';
import { initTheme } from './lib/theme';
// Шрифты внутри сборки: APK и сайт без интернета выглядят как в макете.
import '@fontsource-variable/manrope';
import '@fontsource-variable/unbounded';
import './styles/index.css';
import { initErrorLog } from './lib/errorlog';

initTheme();

async function start() {
  await seedIfEmpty();
  await ensureStarter();
  // Просим браузер не стирать данные сайта (особенно важно на iPhone). ARCHITECTURE.md §12.
  navigator.storage?.persist?.().catch(() => {});
  // Сайт обновляется через service worker; APK — новой сборкой, кеш там только мешает.
  if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });
  initBackButton();
  initErrorLog();
  initUpdates();
  render(<App />, document.getElementById('app')!);
}

start();
