import { render } from 'preact';
import { App } from './App';
import { ensureStarter, seedIfEmpty } from './db/seed';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import { initBackButton } from './lib/backButton';
import './styles/index.css';

async function start() {
  await seedIfEmpty();
  await ensureStarter();
  // Просим браузер не стирать данные сайта (особенно важно на iPhone). ARCHITECTURE.md §12.
  navigator.storage?.persist?.().catch(() => {});
  // Сайт обновляется через service worker; APK — новой сборкой, кеш там только мешает.
  if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });
  initBackButton();
  render(<App />, document.getElementById('app')!);
}

start();
