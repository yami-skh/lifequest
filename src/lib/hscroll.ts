// Горизонтальные ленты (.type-row в шторке «+», .chips.scroll-x) на ПК: пальцем они листаются сами,
// а мышью — нет. Колесо листает ленту вбок, мышью можно тянуть; после перетаскивания клик не срабатывает.
const SEL = '.type-row, .scroll-x';

const scrollable = (el: Element | null): HTMLElement | null => {
  const box = el?.closest<HTMLElement>(SEL) ?? null;
  return box && box.scrollWidth > box.clientWidth + 1 ? box : null;
};

export function initHScroll() {
  document.addEventListener('wheel', (e) => {
    const box = scrollable(e.target as Element);
    if (!box || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const max = box.scrollWidth - box.clientWidth;
    // У края ленты отдаём колесо странице, чтобы она прокручивалась дальше.
    if ((e.deltaY < 0 && box.scrollLeft <= 0) || (e.deltaY > 0 && box.scrollLeft >= max - 1)) return;
    e.preventDefault();
    box.scrollLeft += e.deltaY;
  }, { passive: false });

  let drag: { box: HTMLElement; x: number; left: number; moved: boolean } | null = null;
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const box = scrollable(e.target as Element);
    if (box) drag = { box, x: e.clientX, left: box.scrollLeft, moved: false };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) drag.moved = true;
    if (drag.moved) drag.box.scrollLeft = drag.left - dx;
  });
  document.addEventListener('pointerup', () => {
    if (drag?.moved) {
      // Гасим клик, который браузер пошлёт после отпускания кнопки.
      // Если клика не будет (отпустили вне ленты) — снимаем перехват, чтобы не съесть следующий настоящий клик.
      const stop = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', stop, { capture: true }), 0);
    }
    drag = null;
  });
}
