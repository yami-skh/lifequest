// Переключить модель сервера и развернуть: npm run model -- opus | sonnet | haiku
// Opus 5.5 — лучшее качество; Sonnet 5.5 — примерно вдвое дешевле; Haiku 4.5 — самый дешёвый и быстрый.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MODELS = { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-4-5' };
const id = MODELS[process.argv[2]];
if (!id) {
  console.log(`Укажи модель: ${Object.keys(MODELS).join(' | ')}`);
  process.exit(1);
}
const toml = readFileSync('wrangler.toml', 'utf8').replace(/^MODEL = ".*"$/m, `MODEL = "${id}"`);
writeFileSync('wrangler.toml', toml);
execSync('npx wrangler deploy', { stdio: 'inherit' });
console.log(`Сервер работает на ${id}`);
