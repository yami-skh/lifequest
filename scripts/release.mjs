// Публикация APK в GitHub Releases: v<version> с файлами LifeQuest-<version>.apk и LifeQuest.apk
// (второй — постоянная ссылка releases/latest/download/LifeQuest.apk для обновления из приложения).
// Запуск после `npm run apk`, только когда менялась нативная часть (nativeVersion = version).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const apk = `D:/Android/release/LifeQuest-${pkg.version}.apk`;
if (!existsSync(apk)) throw new Error(`Нет ${apk} — сначала npm run apk`);
const latest = 'D:/Android/release/LifeQuest.apk';
copyFileSync(apk, latest);

// Заметки к выпуску — из «Что нового».
const src = readFileSync('src/data/changelog.ts', 'utf8');
const block = src.split(`version: '${pkg.version}'`)[1]?.split(/\n  \},/)[0] ?? '';
const mark = { new: '+', better: '↑', fix: '✓' };
const notes = [...block.matchAll(/kind: '(\w+)', title: '([^']+)'/g)].map(([, k, t]) => `${mark[k] ?? '•'} ${t}`).join('\n') || `LifeQuest ${pkg.version}`;
writeFileSync('D:/Android/release/notes.txt', notes);

execFileSync('gh', ['release', 'create', `v${pkg.version}`, apk, latest, '--title', `LifeQuest ${pkg.version}`, '--notes-file', 'D:/Android/release/notes.txt', '--latest'], { stdio: 'inherit' });
console.log(`Releases: https://github.com/yami-skh/lifequest/releases/tag/v${pkg.version}`);
