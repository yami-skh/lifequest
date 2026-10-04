// Сборка подписанного APK: веб-сборка → cap sync → gradle assembleRelease → D:/Android/release.
// Инструменты лежат на D: (JDK, Android SDK, кэш Gradle), ключ — D:/Android/keys.
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = 'D:/Android';
const env = {
  ...process.env,
  JAVA_HOME: `${ROOT}/jdk`,
  ANDROID_HOME: `${ROOT}/sdk`,
  GRADLE_USER_HOME: `${ROOT}/gradle`,
};
const run = (cmd, cwd = '.') => execSync(cmd, { stdio: 'inherit', cwd, env });

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const [major, minor, patch] = version.split('.').map(Number);
// versionCode должен расти с каждой версией, иначе Android не поставит обновление поверх.
const code = major * 10000 + minor * 100 + patch;

run('npm test');
run('npm run build');
run('npx cap sync android');
run(`"${resolve('android/gradlew.bat')}" assembleRelease --no-daemon -q -PappVersionName=${version} -PappVersionCode=${code}`, 'android');

mkdirSync(`${ROOT}/release`, { recursive: true });
const out = `${ROOT}/release/LifeQuest-${version}.apk`;
copyFileSync('android/app/build/outputs/apk/release/app-release.apk', out);
console.log(`APK: ${out} (versionCode ${code})`);
