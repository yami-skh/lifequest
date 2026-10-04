// Даты храним как локальные YYYY-MM-DD.

export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function humanDate(date: string, today = localDate()) {
  if (date === today) return 'Сегодня';
  if (date === addDays(today, -1)) return 'Вчера';
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Серия: дни подряд с записью, заканчивая сегодня или вчера. */
export function currentStreak(dates: Iterable<string>, today = localDate()) {
  const set = new Set(dates);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(dates: Iterable<string>) {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
