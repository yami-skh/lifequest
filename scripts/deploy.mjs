// Сборка и выкладка dist/ в ветку gh-pages (GitHub Pages).
// Заодно кладёт рядом обновление для APK: bundle-<version>.zip (веб-часть) и version.json (src/lib/update.ts).
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import JSZip from 'jszip';

const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

run('npm test');
run('npm run build');

// Архив веб-части: index.html в корне архива.
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const zip = new JSZip();
for (const f of walk('dist')) zip.file(relative('dist', f).replace(/\\/g, '/'), readFileSync(f));
const bundle = `bundle-${pkg.version}.zip`;
writeFileSync(join('dist', bundle), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
writeFileSync('dist/version.json', JSON.stringify({
  version: pkg.version,
  native: pkg.nativeVersion,
  bundle,
  apk: 'https://github.com/yami-skh/lifequest/releases/latest/download/LifeQuest.apk',
}, null, 2));

writeFileSync('dist/.nojekyll', '');
const remote = execSync('git remote get-url origin').toString().trim();
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run(`git commit -q -m "deploy ${pkg.version} ${new Date().toISOString()}"`, 'dist');
run(`git push -q -f ${remote} gh-pages`, 'dist');
console.log(`Выложено: https://yami-skh.github.io/lifequest/ (${pkg.version}, APK от ${pkg.nativeVersion})`);
