// Версии «0.9.2» и бета «0.10.0-beta.1»: сравнение, код версии Android, выбор того, что показать в «Что нового».

export interface Version { major: number; minor: number; patch: number; beta: number | null }

export function parseVersion(v: string): Version {
  const [core, pre] = v.split('-');
  const [major = 0, minor = 0, patch = 0] = core.split('.').map((x) => Number(x) || 0);
  const m = pre?.match(/^beta\.(\d+)$/);
  return { major, minor, patch, beta: m ? Number(m[1]) : pre ? 0 : null };
}

/** <0, если a старше b. Бета старше своей стабильной: 0.10.0-beta.3 < 0.10.0, но новее 0.9.9. */
export function cmpVersion(a: string, b: string) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const d = pa.major - pb.major || pa.minor - pb.minor || pa.patch - pb.patch;
  if (d) return d;
  if (pa.beta === pb.beta) return 0;
  if (pa.beta === null) return 1;
  if (pb.beta === null) return -1;
  return pa.beta - pb.beta;
}

/**
 * versionCode для Android: должен расти с каждой версией, а бета — быть меньше своей стабильной.
 * (major·10000 + minor·100 + patch)·100 + (номер беты | 99). Повторяется в scripts/apk.mjs.
 */
export function androidVersionCode(v: string) {
  const p = parseVersion(v);
  return (p.major * 10000 + p.minor * 100 + p.patch) * 100 + (p.beta === null ? 99 : Math.min(p.beta, 98));
}

export const isBeta = (v: string) => parseVersion(v).beta !== null;
/** 0.10.0-beta.3 → 0.10.0 */
export const stableOf = (v: string) => v.split('-')[0];

/** Выпуски новее `seen` и не новее `current` (порядок как в списке). */
export function unseenReleases<T extends { version: string }>(list: T[], seen: string, current: string) {
  return list.filter((r) => cmpVersion(r.version, seen) > 0 && cmpVersion(r.version, current) <= 0);
}
