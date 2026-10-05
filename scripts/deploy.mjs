// Сборка и выкладка dist/ в ветку gh-pages (GitHub Pages).
// Заодно кладёт рядом обновление для APK: bundle-<version>.zip (веб-часть) и version.json (src/lib/update.ts).
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import JSZip from 'jszip';

const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

run('npm test');
// Vite при сборке оставляет dist/.git — начинаем историю ветки заново, иначе в архив попадут прошлые выкладки.
rmSync('dist/.git', { recursive: true, force: true });
run('npm run build');

// Архив веб-части: index.html в корне архива.
// Только файлы сайта: без служебной .git и без архивов обновлений (иначе архив растёт с каждой версией).
const walk = (dir) => readdirSync(dir).filter((f) => f !== '.git' && !/^bundle-.*\.zip$/.test(f))
  .flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const zip = new JSZip();
for (const f of walk('dist')) zip.file(relative('dist', f).replace(/\\/g, '/'), readFileSync(f));
const bundle = `bundle-${pkg.version}.zip`;
const zipped = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(join('dist', bundle), zipped);
if (zipped.length > 5_000_000) throw new Error(`Архив обновления ${(zipped.length / 1e6).toFixed(1)} МБ — подозрительно большой, выкладка остановлена`);
writeFileSync('dist/version.json', JSON.stringify({
  version: pkg.version,
  native: pkg.nativeVersion,
  bundle,
  // Плагин обновлений без контрольной суммы архив не принимает.
  checksum: createHash('sha256').update(zipped).digest('hex'),
  apk: 'https://github.com/yami-skh/lifequest/releases/latest/download/LifeQuest.apk',
}, null, 2));

writeFileSync('dist/.nojekyll', '');
const remote = execSync('git remote get-url origin').toString().trim();
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run(`git commit -q -m "deploy ${pkg.version} ${new Date().toISOString()}"`, 'dist');
run(`git push -q -f ${remote} gh-pages`, 'dist');
console.log(`Выложено: https://yami-skh.github.io/lifequest/ (${pkg.version}, APK от ${pkg.nativeVersion})`);
