// Поле с подсказками при вводе (макет: холст, «Подсказки при вводе»). Один элемент для всех мест добавления:
// пустое поле в фокусе — популярное, печатаешь — список сужается, нажал строку — текст подставился.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { suggest, type SuggestItem, type SuggestSrc } from '../engine/suggest';
import { Icon } from './Icon';
import { useWorld } from '../db/world';

const SRC: Record<SuggestSrc, [string, string]> = { mine: ['repeat', 'было'], goal: ['target', 'цель'], idea: ['spark', 'вариант'] };

function Hl({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().replace(/ё/g, 'е').indexOf(q.toLowerCase().replace(/ё/g, 'е').trim()) : -1;
  if (i < 0 || !q.trim()) return <>{text}</>;
  const n = q.trim().length;
  return <>{text.slice(0, i)}<b class="sg-hl">{text.slice(i, i + n)}</b>{text.slice(i + n)}</>;
}

export function SuggestInput({ id, value, onValue, items, exclude, placeholder, class: cls = 'input', limit = 20, autoFocus, onEnter }: {
  id: string;
  value: string;
  onValue: (v: string) => void;
  items: SuggestItem[];
  exclude?: string[];
  placeholder?: string;
  class?: string;
  limit?: number;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const on = useWorld().hasExp('suggest');
  const [open, setOpen] = useState(false);
  // Введённое совпало с вариантом (выбрал или допечатал сам) — нужное найдено, список прячем,
  // чтобы он не закрывал кнопку и не мешал. Сотрёшь букву — список вернётся.
  const exact = useMemo(() => {
    const v = value.toLowerCase().replace(/ё/g, 'е').trim();
    return !!v && items.some((s) => s.text.toLowerCase().replace(/ё/g, 'е').trim() === v);
  }, [value, items]);
  const list = useMemo(() => (on && open && !exact ? suggest(value, items, { limit, exclude }) : []), [on, open, exact, value, items, exclude, limit]);
  // Новый запрос — список снова с начала (он листается сам по себе).
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [value]);

  // Список не должен выходить за шторку (иначе шторка начинает листаться): меряем место до низа шторки
  // (над кнопкой «Сохранить») и сверху; где больше — туда и открываем, высоту подгоняем. Пересчёт — когда открывается клавиатура.
  const [place, setPlace] = useState<{ up: boolean; max: number }>({ up: false, max: 232 });
  const shown = list.length > 0;
  useEffect(() => {
    if (!shown) return;
    const measure = () => {
      const inp = inputRef.current;
      const sheet = inp?.closest('.sheet') as HTMLElement | null;
      if (!inp) return;
      const r = inp.getBoundingClientRect();
      const vh = window.visualViewport?.height ?? innerHeight;
      const box = sheet?.getBoundingClientRect();
      // Граница снизу — ближайшая кнопка подтверждения под полем («Сохранить», «Добавить»): список её не закрывает.
      const stops = sheet ? [...sheet.querySelectorAll('.save-zone, .btn.primary')].map((el) => el.getBoundingClientRect().top).filter((t) => t > r.bottom) : [];
      const bottom = Math.min(vh, stops.length ? Math.min(...stops) : box ? box.bottom : vh) - 8;
      // Сверху — не выше шапки шторки (она закреплена, список не должен её закрывать).
      const head = sheet?.querySelector('.sheet-head')?.getBoundingClientRect();
      const top = head ? Math.max(head.bottom + 4, 0) : box ? Math.max(box.top + 50, 0) : 8;
      const below = bottom - r.bottom - 4;
      const above = r.top - top - 4;
      const up = below < 150 && above > below;
      const max = Math.round(Math.max(96, Math.min(232, up ? above : below)));
      setPlace((p) => (p.up === up && p.max === max ? p : { up, max }));
    };
    measure();
    // Шторка доезжает до поля уже после открытия списка (ui.tsx, Sheet) — место пересчитываем и при прокрутке.
    const sheet = inputRef.current?.closest('.sheet');
    window.visualViewport?.addEventListener('resize', measure);
    addEventListener('resize', measure);
    sheet?.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.visualViewport?.removeEventListener('resize', measure);
      removeEventListener('resize', measure);
      sheet?.removeEventListener('scroll', measure);
    };
  }, [shown, value]);
  return (
    <div class="sg">
      <input ref={inputRef} id={id} class={cls} placeholder={placeholder} value={value} autoComplete="off" autoFocus={autoFocus}
        onInput={(e) => { onValue(e.currentTarget.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        // Закрываем с задержкой: на телефоне фокус уходит раньше, чем доходит нажатие на строку списка.
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter') { setOpen(false); onEnter?.(); }
        }}
        aria-autocomplete="list" aria-controls={`${id}-sg`} aria-expanded={list.length > 0} />
      {list.length > 0 && (
        <ul class={place.up ? 'sg-list up' : 'sg-list'} id={`${id}-sg`} role="listbox" ref={listRef} style={{ maxHeight: `${place.max}px` }}>
          {list.map((s) => (
            <li key={s.text} role="option" aria-selected={false}
              // mousedown + preventDefault: мышью поле не теряет фокус до выбора (pointerdown для этого не хватает).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onValue(s.text); setOpen(false); }}>
              <Icon name={SRC[s.src][0]} size={15} />
              <span class="sg-text"><Hl text={s.text} q={value} /></span>
              <span class="sg-src">{SRC[s.src][1]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
