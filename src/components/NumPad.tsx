// Крупная цифровая клавиатура для весов, повторов и целей.
// Макет: холст, страница «Упрощение», экран 3.
import { useEffect, useState } from 'preact/hooks';
import { Icon } from './Icon';

export interface NumPadProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Шаг для кнопок −/+ (например 1 для повторов, 2,5 для веса). */
  step: number;
  decimal?: boolean;
  /** Главная кнопка: «Готово» или «Дальше → подход 4». */
  doneLabel?: string;
  onDone: () => void;
  /** Закрыть (с сохранением введённого). */
  onClose: () => void;
}

const parse = (v: string) => parseFloat(v.replace(',', '.'));
export const fmtInput = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');

export function NumPad({ label, value, onChange, step, decimal = false, doneLabel = 'Готово', onDone, onClose }: NumPadProps) {
  // Первая цифра заменяет подставленное значение (как в калькуляторе), дальше — дописывается.
  const [fresh, setFresh] = useState(true);
  useEffect(() => setFresh(true), [label]);

  const type = (k: string) => {
    if (fresh) {
      setFresh(false);
      return onChange(k === ',' ? '0,' : k);
    }
    if (k === ',' && value.includes(',')) return;
    if (value.length >= 6) return;
    onChange(value === '0' && k !== ',' ? k : value + k);
  };
  const back = () => {
    setFresh(false);
    onChange(value.slice(0, -1));
  };
  const bump = (d: number) => {
    setFresh(false);
    const n = parse(value);
    onChange(fmtInput(Math.max(0, (Number.isFinite(n) ? n : 0) + d)));
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const showSecond = doneLabel !== 'Готово';

  return (
    <div class="numpad-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="numpad" role="dialog" aria-label={label}>
        <div class="spread">
          <span class="muted small strong">{label}</span>
          {showSecond && <button type="button" class="link small" onClick={onClose}>Готово</button>}
        </div>
        <div class={fresh ? 'numpad-value fresh' : 'numpad-value'} aria-live="polite">{value || '—'}</div>
        <div class="numpad-grid">
          {keys.slice(0, 3).map((k) => <button type="button" key={k} class="np-key" onClick={() => type(k)}>{k}</button>)}
          <button type="button" class="np-key fn" onClick={() => bump(-step)}>−{fmtInput(step)}</button>
          {keys.slice(3, 6).map((k) => <button type="button" key={k} class="np-key" onClick={() => type(k)}>{k}</button>)}
          <button type="button" class="np-key fn" onClick={() => bump(step)}>+{fmtInput(step)}</button>
          {keys.slice(6).map((k) => <button type="button" key={k} class="np-key" onClick={() => type(k)}>{k}</button>)}
          <button type="button" class="np-key fn" aria-label="Стереть" onClick={back}><Icon name="backspace" size={20} /></button>
          {decimal ? <button type="button" class="np-key" onClick={() => type(',')}>,</button> : <span />}
          <button type="button" class="np-key" onClick={() => type('0')}>0</button>
          <button type="button" class="np-key done" onClick={onDone}>{doneLabel}</button>
        </div>
      </div>
    </div>
  );
}

export const numFrom = (v: string): number | null => {
  const n = parse(v);
  return Number.isFinite(n) ? n : null;
};
