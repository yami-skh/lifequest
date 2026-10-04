// Системная кнопка «Назад» в APK: закрывает верхнее открытое (клавиатура, шторка, фото),
// иначе возвращает на прошлый экран, а с главного выходит по второму нажатию.
import { useEffect, useRef } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { go } from './router';
import { toast } from './toast';

const stack: { close: () => void }[] = [];

/** Пока `active`, «Назад» вызывает `onClose` (последний открытый закрывается первым). */
export function useBackClose(active: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const item = { close: () => ref.current() };
    stack.push(item);
    return () => {
      const i = stack.lastIndexOf(item);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

const EXIT_MS = 2000;
let exitArmedAt = 0;

/** Закрыть верхнее открытое. false — закрывать нечего. */
export function closeTop() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export function handleBack(canGoBack: boolean, exit: () => void) {
  if (closeTop()) return;
  if (location.hash.replace(/^#\/?/, '') !== '') {
    if (canGoBack) history.back();
    else go('');
    return;
  }
  if (Date.now() - exitArmedAt < EXIT_MS) return exit();
  exitArmedAt = Date.now();
  toast({ kind: 'info', title: 'Нажми ещё раз, чтобы выйти' });
}

export function initBackButton() {
  if (Capacitor.isNativePlatform()) {
    App.addListener('backButton', ({ canGoBack }) => handleBack(canGoBack, () => App.exitApp()));
  } else {
    // На компьютере Esc закрывает верхнюю шторку.
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && closeTop()) e.preventDefault();
    });
  }
  if (import.meta.env.DEV) Object.assign(window, { __lqBack: () => handleBack(history.length > 1, () => console.log('exit')) });
}
