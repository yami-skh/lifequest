// Сравнение версий «0.5.1» и выбор того, что показать в «Что нового».

export function cmpVersion(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Выпуски новее `seen` и не новее `current` (порядок как в списке). */
export function unseenReleases<T extends { version: string }>(list: T[], seen: string, current: string) {
  return list.filter((r) => cmpVersion(r.version, seen) > 0 && cmpVersion(r.version, current) <= 0);
}
