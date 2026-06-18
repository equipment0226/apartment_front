// 표기 헬퍼

/** 억 단위 숫자 → "33.0억" 같은 한국어 표기 */
export function eok(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  return `${v.toFixed(digits)}억`;
}

/** 퍼센트 표기 (+/- 부호) */
export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(digits)}%`;
}

/** 확률(0~1) → 정수 % */
export function prob(v: number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return Math.round(v * 100);
}

/** "2026-06-01" → "26.06" */
export function shortDate(ts: string): string {
  const [y, m] = ts.split("-");
  return `${y.slice(2)}.${m}`;
}

/** "2026-06-01" → "2026년 6월" */
export function longDate(ts: string): string {
  const [y, m] = ts.split("-");
  return `${y}년 ${parseInt(m, 10)}월`;
}

/** 파이프(|)로 구분된 지하철 문자열 → 역명 배열 */
export function parseSubways(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 첫 번째 역명만 짧게 (배지용) */
export function firstStation(raw: string | null): string | null {
  const list = parseSubways(raw);
  if (!list.length) return null;
  const m = list[0].match(/^([^()]+)/);
  return m ? m[1].trim() : list[0];
}
