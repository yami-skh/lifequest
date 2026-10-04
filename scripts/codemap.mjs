// Генерирует docs/CODEMAP.md: файлы src/ с назначением и номерами строк объявлений.
// Нужна, чтобы читать нужный кусок файла (Read offset/limit), а не файл целиком. Запуск: npm run map.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const src = join(root, 'src');

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
const files = walk(src).filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith('.d.ts')).sort();

const DECL = /^(export\s+)?(default\s+)?(async\s+)?(function|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
const out = [
  '# Карта кода',
  '',
  'Сгенерировано `npm run map` — не править руками, перегенерировать после изменений.',
  '`имя:строка` — объявление верхнего уровня (`*` — экспорт). Читать кусок: Read с offset = строка.',
  '',
];

let dirNow = '';
for (const f of files) {
  const rel = relative(root, f).replace(/\\/g, '/');
  const dir = rel.split('/').slice(0, -1).join('/');
  if (dir !== dirNow) {
    out.push('', `## ${dir}`, '');
    dirNow = dir;
  }
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  const first = lines.find((l) => l.trim());
  const purpose = first && /^\s*(\/\/|\/\*)/.test(first) ? first.replace(/^\s*(\/\/|\/\*+)\s*/, '').replace(/\*\/\s*$/, '').trim() : '';
  let items;
  if (f.endsWith('.css')) {
    items = lines.map((l, i) => (/^\/\* (.+?) \*\//.test(l) ? `${l.match(/^\/\* (.+?) \*\//)[1]}:${i + 1}` : null)).filter(Boolean);
  } else {
    const top = lines.map((l, i) => {
      const m = l.match(DECL);
      return m ? { name: `${m[1] ? '*' : ''}${m[5]}`, line: i + 1 } : null;
    }).filter(Boolean);
    // У длинных (150+ строк) объявлений показываем и вложенные функции: «.имя:строка».
    items = top.flatMap((d, k) => {
      const end = k + 1 < top.length ? top[k + 1].line - 1 : lines.length;
      const res = [`${d.name}:${d.line}`];
      if (end - d.line < 150) return res;
      for (let i = d.line; i < end; i++) {
        const m = lines[i].match(/^ {2}(?:const|function)\s+([A-Za-z_$][\w$]*)\s*(?:=\s*(?:async\s*)?\(|=\s*[a-z]\w*\s*=>|\()/);
        if (m) res.push(`.${m[1]}:${i + 1}`);
      }
      return res;
    });
  }
  out.push(`- **${rel.split('/').pop()}** (${lines.length})${purpose ? ` — ${purpose}` : ''}`);
  if (items.length) out.push(`  ${items.join(', ')}`);
}

writeFileSync(join(root, 'docs', 'CODEMAP.md'), out.join('\n') + '\n');
console.log(`CODEMAP: ${files.length} файлов`);
