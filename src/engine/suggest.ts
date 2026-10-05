// Подсказки при вводе: отбор и порядок (макет: холст, «Подсказки при вводе»). Чистая функция.
// Источники по приоритету: mine (прошлые записи, твои названия) → goal (цели навыка из путей) → idea (общий запас).

export type SuggestSrc = 'mine' | 'goal' | 'idea';
export interface SuggestItem { text: string; src: SuggestSrc }

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const RANK: Record<SuggestSrc, number> = { mine: 0, goal: 1, idea: 2 };

/**
 * До `limit` подсказок под запрос. Пустой запрос — первые по приоритету источника.
 * Совпадение с начала слова важнее совпадения в середине. Точное совпадение с запросом и `exclude` (уже есть) не предлагаем.
 */
export function suggest(query: string, items: SuggestItem[], opts: { limit?: number; exclude?: string[] } = {}): SuggestItem[] {
  const limit = opts.limit ?? 8;
  const q = norm(query);
  const skip = new Set((opts.exclude ?? []).map(norm));
  const seen = new Set<string>();
  const scored: { item: SuggestItem; score: number; i: number }[] = [];
  items.forEach((item, i) => {
    const t = norm(item.text);
    if (!t || seen.has(t) || skip.has(t) || t === q) return;
    let score: number;
    if (!q) score = RANK[item.src];
    else {
      const at = t.indexOf(q);
      if (at < 0) {
        // Все слова запроса встречаются в любом порядке: «3 км бег» → «Бег 3 км».
        const words = q.split(' ');
        if (words.length < 2 || !words.every((w) => t.includes(w))) return;
        score = 20 + RANK[item.src];
      } else score = (at === 0 ? 0 : t[at - 1] === ' ' ? 5 : 10) + RANK[item.src];
    }
    seen.add(t);
    scored.push({ item, score, i });
  });
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).slice(0, limit).map((x) => x.item);
}

/** Удобно собирать источники: suggestFrom({ mine: […], goal: […], idea: […] }). */
export const items = (src: Partial<Record<SuggestSrc, string[]>>): SuggestItem[] =>
  (['mine', 'goal', 'idea'] as SuggestSrc[]).flatMap((s) => (src[s] ?? []).map((text) => ({ text, src: s })));
