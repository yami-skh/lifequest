"""Добавляет артборды на страницу холста (design/project/canvas.json).

Запуск из корня проекта:
  python tools/canvas_page.py <page_id> "Имя страницы" "Заголовок" Файл.dc.html|Подпись|x|h ...
Потом опубликовать: Artifact url=<холст из CLAUDE.md>, root=design, files={project/canvas.json, project/<Файл>.dc.html}.
"""
import json
import sys
from pathlib import Path

canvas = Path(__file__).resolve().parent.parent / 'design' / 'project' / 'canvas.json'
page, page_name, title = sys.argv[1:4]
c = json.loads(canvas.read_text(encoding='utf-8'))
if not any(p['id'] == page for p in c['pages']):
    c['pages'].append({'id': page, 'name': page_name})
c['notes'][page + 'Title'] = {'kind': 'title1', 'maxW': 1720, 'page': page, 'text': title, 'x': 0, 'y': -260}
c['launch'] = {'view': 'canvas', 'page': page}
for arg in sys.argv[4:]:
    f, t, x, h = arg.split('|')
    c['boards'][f] = {'h': int(h), 'page': page, 'radius': 28, 'title': t, 'w': 390, 'x': int(x), 'y': 0}
    if f not in c['order']:
        c['order'].append(f)
canvas.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding='utf-8')
print('boards:', len(c['boards']))
