// Выкладка на GitHub Pages (ветка gh-pages). Два канала (CLAUDE.md, «Каналы»):
//   node scripts/deploy.mjs         — стабильная: корень сайта, version.json (её получает брат)
//   node scripts/deploy.mjs --beta  — бета: папка beta/, beta/version.json; стабильная не трогается
// Рядом с сайтом — обновление для APK: bundle-<version>.zip (веб-часть) и version.json (src/lib/update.ts).
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import JSZip from 'jszip';

const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const beta = process.argv.includes('--beta');
const isBetaVersion = pkg.version.includes('-beta.');
if (beta !== isBetaVersion) {
  throw new Error(beta ? `Для беты версия должна быть вида 0.10.0-beta.1, сейчас ${pkg.version}` : `Версия ${pkg.version} — бета: выкладывай через npm run deploy:beta или переведи npm run promote`);
}

run('npm test');
rmSync('dist', { recursive: true, force: true });
run('npm run build');

// Архив веб-части: index.html в корне архива; без служебных файлов и прошлых архивов.
const walk = (dir) => readdirSync(dir).filter((f) => f !== '.git' && !/^bundle-.*\.zip$/.test(f))
  .flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const zip = new JSZip();
for (const f of walk('dist')) zip.file(relative('dist', f).replace(/\\/g, '/'), readFileSync(f));
const bundle = `bundle-${pkg.version}.zip`;
const zipped = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
if (zipped.length > 5_000_000) throw new Error(`Архив обновления ${(zipped.length / 1e6).toFixed(1)} МБ — подозрительно большой, выкладка остановлена`);
writeFileSync(join('dist', bundle), zipped);
writeFileSync('dist/version.json', JSON.stringify({
  version: pkg.version,
  native: pkg.nativeVersion,
  bundle,
  // Плагин обновлений без контрольной суммы архив не принимает.
  checksum: createHash('sha256').update(zipped).digest('hex'),
  apk: beta
    ? `https://github.com/yami-skh/lifequest/releases/download/v${pkg.nativeVersion}/LifeQuest-${pkg.nativeVersion}.apk`
    : 'https://github.com/yami-skh/lifequest/releases/latest/download/LifeQuest.apk',
}, null, 2));

// Берём текущее содержимое gh-pages и меняем только свой канал.
const remote = execSync('git remote get-url origin').toString().trim();
const site = '.deploy';
rmSync(site, { recursive: true, force: true });
try {
  run(`git clone -q --depth 1 --branch gh-pages ${remote} ${site}`);
} catch {
  mkdirSync(site, { recursive: true });
}
rmSync(join(site, '.git'), { recursive: true, force: true });
if (beta) {
  rmSync(join(site, 'beta'), { recursive: true, force: true });
  cpSync('dist', join(site, 'beta'), { recursive: true });
} else {
  for (const f of readdirSync(site)) if (f !== 'beta') rmSync(join(site, f), { recursive: true, force: true });
  cpSync('dist', site, { recursive: true });
}
writeFileSync(join(site, '.nojekyll'), '');

// Одна свежая версия ветки без истории: архивы обновлений не копятся.
run('git init -q -b gh-pages', site);
run('git add -A', site);
run(`git commit -q -m "deploy ${pkg.version} ${new Date().toISOString()}"`, site);
run(`git push -q -f ${remote} gh-pages`, site);
rmSync(site, { recursive: true, force: true });
console.log(`Выложено (${beta ? 'бета' : 'стабильная'}): https://yami-skh.github.io/lifequest/${beta ? 'beta/' : ''} (${pkg.version}, APK от ${pkg.nativeVersion})`);
