import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon';
import { back } from '../lib/router';
import type { Node } from '../db/db';
import { useBackClose } from '../lib/backButton';
import { ac } from '../lib/theme';

export function ProgressBar({ pct, color = 'var(--green)', height = 8 }: { pct: number; color?: string; height?: number }) {
  return (
    <div class="bar" style={{ height: `${height}px` }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div class="bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

export function LevelBadge({ level, name, pct, left }: { level: number; name: string; pct: number; left: number }) {
  return (
    <div class="level-badge">
      <span class="level-badge-title">ур. {level} · {name}</span>
      <ProgressBar pct={pct} color="var(--gold)" height={4} />
      <span class="level-badge-sub">{level >= 10 ? 'максимум' : `до ур. ${level + 1} ещё ${left} XP`}</span>
    </div>
  );
}

/** Кольцо прогресса с подписью в центре. */
export function Ring({ pct, size = 44, stroke = 4, color = 'var(--gold)', children }: {
  pct: number; size?: number; stroke?: number; color?: string; children?: ComponentChildren;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  const mid = size / 2;
  return (
    <span class="ring" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--line)" stroke-width={stroke} />
        {v > 0 && (
          <circle cx={mid} cy={mid} r={r} fill="none" stroke={color} stroke-width={stroke} stroke-linecap="round"
            stroke-dasharray={`${(c * v) / 100} ${c}`} transform={`rotate(-90 ${mid} ${mid})`} />
        )}
      </svg>
      <span class="ring-label">{children}</span>
    </span>
  );
}

export function AreaTile({ node, size = 40 }: { node: Node | undefined; size?: number }) {
  const color = ac(node?.color) ?? 'var(--muted)';
  return (
    <span class="area-tile" style={{ width: `${size}px`, height: `${size}px`, color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
      {node?.icon ? <Icon name={node.icon} size={Math.round(size * 0.55)} /> : node?.title.slice(0, 1) ?? '?'}
    </span>
  );
}

export function TopBar({ title, crumbs, right }: { title?: string; crumbs?: string; right?: ComponentChildren }) {
  return (
    <div class="topbar">
      <button type="button" class="icon-btn" aria-label="Назад" onClick={() => back()}>
        <Icon name="back" />
      </button>
      <div class="topbar-text">
        {crumbs && <div class="crumbs">{crumbs}</div>}
        {title && <div class="topbar-title">{title}</div>}
      </div>
      {right}
    </div>
  );
}

/**
 * Закрыть шторку свайпом вниз. Тянуть можно за полоску/заголовок всегда, за остальное — когда шторка прокручена к самому верху
 * (иначе свайп — это прокрутка). Горизонтальные ленты и поля ввода не перехватываем.
 */
function useSwipeClose(ref: { current: HTMLDivElement | null }, open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    let s: { y: number; x: number; t: number; head: boolean; drag: boolean } | null = null;
    let dy = 0;
    const backdrop = el.parentElement;
    const start = (e: TouchEvent) => {
      const tg = e.target as HTMLElement;
      if (e.touches.length !== 1 || tg.closest('input, textarea, .type-row, .scroll-x, .sg-list')) { s = null; return; }
      s = { y: e.touches[0].clientY, x: e.touches[0].clientX, t: Date.now(), head: !!tg.closest('.sheet-handle, .sheet-head'), drag: false };
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (!s) return;
      dy = e.touches[0].clientY - s.y;
      const dx = e.touches[0].clientX - s.x;
      if (!s.drag) {
        if (dy < 8 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
        if (!s.head && el.scrollTop > 0) { s = null; return; }
        s.drag = true;
        el.style.transition = 'none';
      }
      e.preventDefault();
      el.style.transform = `translateY(${Math.max(0, dy)}px)`;
      if (backdrop) backdrop.style.opacity = String(Math.max(0.35, 1 - dy / 600));
    };
    const end = () => {
      if (!s?.drag) { s = null; return; }
      const fast = dy / Math.max(1, Date.now() - s.t) > 0.6;
      el.style.transition = 'transform .18s ease';
      if (dy > 110 || (fast && dy > 40)) {
        el.style.transform = 'translateY(100%)';
        setTimeout(() => close.current(), 160);
      } else {
        el.style.transform = '';
        if (backdrop) backdrop.style.opacity = '';
      }
      s = null;
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [open]);
}

const CLOSE_MS = 160;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Sheet({ open, onClose, onBack, title, children, class: cls, tall }: { open: boolean; onClose: () => void; onBack?: () => void; title: string; children: ComponentChildren; class?: string; tall?: number }) {
  // Постоянная высота шторки с полями ввода — чтобы не прыгала, когда открывается/закрывается клавиатура
  // и когда всплывают подсказки. Замер — один раз при открытии (до клавиатуры): содержимое, но не меньше доли экрана
  // (tall, по умолчанию 0,6 для форм) и не больше 94%. Шторки без полей (меню, подтверждения) — по содержимому, как раньше.
  const [tallPx, setTallPx] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!open || !el) return;
    const hasField = !!el.querySelector('input:not([type=file]):not([type=checkbox]):not([type=radio]):not([hidden]), textarea');
    if (!tall && !hasField) return setTallPx(0);
    const vh = window.innerHeight;
    el.style.height = '';
    setTallPx(Math.round(Math.min(vh * 0.94, Math.max(el.scrollHeight, vh * (tall ?? 0.6)))));
    // title — та же шторка может сменить содержимое (меню → «Новая ветка»): мерим заново.
  }, [open, title]);
  // Закрытие крестиком, тапом мимо и кнопкой «назад» — шторка уезжает вниз (чуть быстрее, чем открывается).
  const [closing, setClosing] = useState(false);
  useEffect(() => setClosing(false), [open]);
  const requestClose = () => {
    if (closing) return;
    if (reducedMotion()) return onClose();
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };
  useBackClose(open, requestClose);
  useSwipeClose(sheetRef, open, onClose);
  // Поле в фокусе — всегда над закреплённой кнопкой: клавиатура сжимает шторку, а прокрутка сама к полю не едет
  // (поле оказывалось под «Добавить»). Отступ под кнопку — scroll-padding-bottom у .sheet.
  useEffect(() => {
    const el = sheetRef.current;
    if (!open || !el) return;
    let t = 0;
    const reveal = () => {
      clearTimeout(t);
      t = window.setTimeout(() => {
        const a = document.activeElement as HTMLElement | null;
        // Поле со своими кнопками (свой шаг квеста: «Отмена»/«Добавить») — показываем весь блок, а не только поле.
        if (a && el.contains(a) && a.matches('input, textarea')) (a.closest('.new-req') ?? a).scrollIntoView({ block: 'nearest' });
      }, 80);
    };
    el.addEventListener('focusin', reveal);
    window.visualViewport?.addEventListener('resize', reveal);
    window.addEventListener('resize', reveal);
    return () => {
      clearTimeout(t);
      el.removeEventListener('focusin', reveal);
      window.visualViewport?.removeEventListener('resize', reveal);
      window.removeEventListener('resize', reveal);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div class={closing ? 'sheet-backdrop closing' : 'sheet-backdrop'} onClick={(e) => e.target === e.currentTarget && requestClose()}>
      <div class={cls ? `sheet ${cls}` : 'sheet'} role="dialog" aria-modal="true" aria-label={title} ref={sheetRef} style={tallPx ? { height: `${tallPx}px` } : undefined}>
        <div class="sheet-handle" />
        <div class="sheet-head">
          {onBack ? (
            <div class="sheet-head-l">
              <button type="button" class="icon-btn sheet-back" aria-label="Назад" onClick={onBack}><Icon name="back" /></button>
              <h2 class="sheet-title">{title}</h2>
            </div>
          ) : <h2 class="sheet-title">{title}</h2>}
          <button type="button" class="icon-btn round" aria-label="Закрыть" onClick={requestClose}>
            <Icon name="x" size={20} stroke={2.4} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ open, title, text, action, onConfirm, onClose }: {
  open: boolean; title: string; text: string; action: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p class="muted">{text}</p>
      <div class="row-2">
        <button type="button" class="btn ghost" onClick={onClose}>Отмена</button>
        <button type="button" class="btn danger" onClick={() => { onConfirm(); onClose(); }}>{action}</button>
      </div>
    </Sheet>
  );
}

export function SectionLabel({ children, right }: { children: ComponentChildren; right?: ComponentChildren }) {
  return (
    <div class="section-label">
      <span>{children}</span>
      {right}
    </div>
  );
}

export function Check({ done }: { done: boolean }) {
  // «just» — только когда галочку поставили сейчас (было не отмечено): анимация штриха, а не при каждом показе списка.
  const prev = useRef(done);
  const just = done && !prev.current;
  useEffect(() => { prev.current = done; }, [done]);
  return <span class={done ? (just ? 'check on just' : 'check on') : 'check'}>{done && <Icon name="check" size={16} stroke={3} />}</span>;
}

export const pctText = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);
