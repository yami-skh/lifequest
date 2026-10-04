// Сборка и выкладка dist/ в ветку gh-pages (GitHub Pages).
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd });

run('npm test');
run('npm run build');
writeFileSync('dist/.nojekyll', '');
const remote = execSync('git remote get-url origin').toString().trim();
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run(`git commit -q -m "deploy ${new Date().toISOString()}"`, 'dist');
run(`git push -q -f ${remote} gh-pages`, 'dist');
console.log('Выложено: https://yami-skh.github.io/lifequest/');
