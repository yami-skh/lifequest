import { render } from 'preact';
import { App } from './App';
import { seedIfEmpty } from './db/seed';
import './styles.css';

async function start() {
  await seedIfEmpty();
  // Просим браузер не стирать данные сайта (особенно важно на iPhone). ARCHITECTURE.md §12.
  navigator.storage?.persist?.().catch(() => {});
  render(<App />, document.getElementById('app')!);
}

start();
