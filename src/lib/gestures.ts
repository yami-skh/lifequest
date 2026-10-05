// Жесты в дереве: удержание (быстрое меню) и свайп по строке навыка (вправо — действие, влево — меню).
// Макет: холст, «Дерево: удержание». Один жест за раз — состояние общее для модуля.
// Свайп — только пальцем; удержание — и пальцем, и мышью. После удержания/свайпа клик по ссылке гасится.

const HOLD_MS = 450;
const MOVE_CANCEL = 10;
const SWIPE = 72;

interface G { id: number; x: number; y: number; el: HTMLElement; timer?: number; held: boolean; swiping: boolean; touch: boolean }
let g: G | null = null;
let suppressUntil = 0;

const buzz = () => {
  try {
    navigator.vibrate?.(15);
  } catch {
    /* нет вибрации */
  }
};

const reset = (el: HTMLElement) => {
  el.style.transition = 'transform .18s ease';
  el.style.transform = '';
  el.removeAttribute('data-swipe');
};

export interface GestureOpts { onHold: () => void; onSwipeRight?: () => void; onSwipeLeft?: () => void }

/** Обработчики для элемента строки. Вешать на сам кликабельный элемент. */
export interface GestureHandlers {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: () => void;
  onPointerLeave: (e: PointerEvent) => void;
  onContextMenu: (e: MouseEvent) => void;
  onClickCapture: (e: MouseEvent) => void;
}

export function gestures(o: GestureOpts): GestureHandlers {
  return {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      g = { id: e.pointerId, x: e.clientX, y: e.clientY, el, held: false, swiping: false, touch: e.pointerType !== 'mouse' };
      // Без перехода: строка должна идти за пальцем без задержки (в CSS есть короткий переход для отклика на нажатие).
      el.style.transition = 'none';
      g.timer = window.setTimeout(() => {
        if (!g || g.swiping) return;
        g.held = true;
        buzz();
        el.classList.add('held');
        setTimeout(() => el.classList.remove('held'), 260);
        suppressUntil = Date.now() + 700;
        o.onHold();
      }, HOLD_MS);
    },
    onPointerMove: (e) => {
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (!g.swiping && Math.hypot(dx, dy) > MOVE_CANCEL) clearTimeout(g.timer);
      if (!g.touch || g.held || (!o.onSwipeLeft && !o.onSwipeRight)) return;
      if (!g.swiping && Math.abs(dx) > MOVE_CANCEL && Math.abs(dx) > Math.abs(dy) * 1.5) g.swiping = true;
      if (g.swiping) {
        const lim = Math.max(-110, Math.min(110, dx));
        g.el.style.transform = `translateX(${lim}px)`;
        g.el.setAttribute('data-swipe', dx > SWIPE ? 'right' : dx < -SWIPE ? 'left' : '');
      }
    },
    onPointerUp: (e) => {
      if (!g || g.id !== e.pointerId) return;
      clearTimeout(g.timer);
      const dx = e.clientX - g.x;
      if (g.swiping) {
        suppressUntil = Date.now() + 400;
        if (dx > SWIPE && o.onSwipeRight) { buzz(); o.onSwipeRight(); }
        else if (dx < -SWIPE && o.onSwipeLeft) { buzz(); o.onSwipeLeft(); }
      }
      reset(g.el);
      g = null;
    },
    onPointerCancel: () => {
      if (!g) return;
      clearTimeout(g.timer);
      reset(g.el);
      g = null;
    },
    onPointerLeave: (e) => {
      if (g && g.id === e.pointerId && e.pointerType === 'mouse') {
        clearTimeout(g.timer);
        reset(g.el);
        g = null;
      }
    },
    // Долгое нажатие на ссылку в браузере телефона открывает своё меню — оно тут лишнее.
    onContextMenu: (e) => e.preventDefault(),
    onClickCapture: (e) => {
      if (Date.now() < suppressUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}
