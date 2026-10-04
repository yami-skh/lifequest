import { useState } from 'preact/hooks';
import { isIos, useInstall } from '../lib/install';
import { Icon } from './Icon';

const HIDE_KEY = 'lq.installHidden';

export function InstallCard() {
  const { installed, canPrompt, install } = useInstall();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (installed || hidden) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, '1');
    } catch {
      /* не критично */
    }
  };

  return (
    <section class="install card">
      <div class="spread">
        <span class="strong">Установи LifeQuest на телефон</span>
        <button type="button" class="icon-btn" aria-label="Скрыть" onClick={hide}><Icon name="x" size={18} stroke={2.4} /></button>
      </div>
      <p class="muted small">Значок на главном экране, открывается как приложение и работает без интернета.</p>
      {canPrompt ? (
        <button type="button" class="btn primary" onClick={install}><Icon name="download" size={20} stroke={2.4} />Установить</button>
      ) : isIos() ? (
        <p class="small">В Safari: кнопка «Поделиться» внизу → «На экран Домой».</p>
      ) : (
        <p class="small">В Chrome: меню <b>⋮</b> вверху справа → «Добавить на главный экран» → «Установить». Если такого пункта нет, обнови страницу и подожди пару секунд.</p>
      )}
    </section>
  );
}
