// Перевод беты в стабильную: 0.10.0-beta.3 → 0.10.0 (тот же код), «Что нового» беты → стабильная, выкладка.
// Перед этим: 3–7 дней в бете без критических багов, чек-лист раздела 8 мастер-плана.
// Если в бете менялась нативная часть: после promote ещё npm run apk и npm run release (уже стабильный APK).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (!pkg.version.includes('-beta.')) throw new Error(`Версия ${pkg.version} — не бета, переводить нечего`);
const stable = pkg.version.split('-')[0];

// Все записи «Что нового» этой беты (0.10.0-beta.N) сливаются в одну запись 0.10.0.
const file = 'src/data/changelog.ts';
let src = readFileSync(file, 'utf8');
src = src.replace(new RegExp(`version: '${stable.replace(/\./g, '\\.')}-beta\\.\\d+'`, 'g'), `version: '${stable}'`);
writeFileSync(file, src);

pkg.version = stable;
if (pkg.nativeVersion?.includes('-beta.')) pkg.nativeVersion = stable;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`Версия: ${stable}. Проверь src/data/changelog.ts — записи бет объединить в одну.`);
run('node scripts/deploy.mjs');
