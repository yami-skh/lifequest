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
  const list = useMemo(() => (on && open ? suggest(value, items, { limit, exclude }) : []), [on, open, value, items, exclude, limit]);
  // Новый запрос — список снова с начала (он листается сам по себе).
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [value]);
  return (
    <div class="sg">
      <input id={id} class={cls} placeholder={placeholder} value={value} autoComplete="off" autoFocus={autoFocus}
        onInput={(e) => { onValue(e.currentTarget.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        // Закрываем с задержкой: на телефоне фокус уходит раньше, чем доходит нажатие на строку списка.
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && onEnter) onEnter();
        }}
        aria-autocomplete="list" aria-controls={`${id}-sg`} aria-expanded={list.length > 0} />
      {list.length > 0 && (
        <ul class="sg-list" id={`${id}-sg`} role="listbox" ref={listRef}>
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
