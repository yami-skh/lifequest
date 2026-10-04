"""Светлая тема: соответствие цветов тёмной → светлой.
Используется для светлых версий макетов (python tools/light_palette.py Исходный.dc.html Новый.dc.html)
и как справка для набора переменных [data-theme=light] в src/styles/base.css.
"""
import re
import sys
from pathlib import Path

DARK_TO_LIGHT = {
    '#0E1015': '#F4F2ED',  # --bg
    '#07080B': '#E9E6DF',  # подложка под шторкой
    '#0F1116': '#F7F5F1',  # поля ввода
    '#171A21': '#FFFFFF',  # --surface
    '#1E222B': '#EFECE6',  # --surface-2
    '#252A35': '#E3DFD7',  # --line, дорожки полосок
    '#2A2F3B': '#E3DFD7',  # --surface-3
    '#3A404D': '#CFC9BE',  # --line-2
    '#4A5160': '#B5AEA2',
    '#ECEDF1': '#1B1D23',  # --fg
    '#C9CDD6': '#3A3F4A',  # --fg-2
    '#A3A9B6': '#626877',  # --muted
    '#8B92A0': '#7C8290',  # --muted-2
    '#F2B544': '#A86A08',  # --gold (текст и кнопки; контраст с белым ~4.4)
    '#FFD27A': '#A86A08',
    '#2B2414': '#FBF0DA',  # --gold-bg
    '#2A1E14': '#FCEBDD',
    '#14161C': '#FFFFFF',  # --on-gold
    '#4CC9A0': '#1E9E73',  # --green
    '#6FE0BA': '#137A57',  # --green-fg
    '#12201B': '#E3F4EC',
    '#7AA7FF': '#2F66D0',
    '#B9A4FF': '#6B4FD8',
    '#E08AE8': '#A93DB5',
    '#FF8A5B': '#D9561F',
    '#FF9A5C': '#D9561F',
}

def lighten(text: str) -> str:
    def sub(m):
        return DARK_TO_LIGHT.get(m.group(0).upper(), m.group(0))
    text = re.sub(r'#[0-9A-Fa-f]{6}\b', sub, text)
    return text.replace('rgba(255,138,91,0.08)', 'rgba(217,86,31,0.08)').replace('rgba(255, 138, 91, 0.08)', 'rgba(217, 86, 31, 0.08)')

if __name__ == '__main__':
    src, dst, *title = sys.argv[1:]
    d = Path(__file__).resolve().parent.parent / 'design' / 'project'
    t = lighten((d / src).read_text(encoding='utf-8'))
    if title:
        t = re.sub(r'<title>.*?</title>', f'<title>{title[0]}</title>', t, count=1)
    (d / dst).write_text(t, encoding='utf-8')
    print('ok', dst)
