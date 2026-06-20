// API 타입 정의 — 백엔드 응답 구조와 1:1 매핑

export interface SearchItem {
  si: string;
  gu: string;
  dong: string;
  complex_name: string;
  area_cnt: number;
}

export interface AreaItem {
  pyeong: string;
  current_price_eok: number | null;
  p50_final_eok: number | null;
  ret_p50_pct: number | null;
  n_scenarios: number;
  approval_year?: string | number | null;
  max_months?: number;
}

export interface FilterResponse {
  level: "si" | "gu" | "dong" | "complex";
  options: string[];
}

export interface FanPoint {
  ts: string;
  price?: number | null;
  p10?: number;
  p50?: number;
  p90?: number;
  point?: number | null;
}

export interface TopFeature {
  feature: string;
  name: string;
  desc: string;
  group: string;
  icon: string;
  impact: number;
  impact_pct: number;
  direction: "up" | "down";
}

export interface VsnPoint {
  h_step: number;
  ts: string;
  [group: string]: number | string;
}

export interface Shap {
  top_features: TopFeature[];
  vsn_series: VsnPoint[];
  groups: { name: string; color: string }[];
}

export interface ReportDetail {
  approval_year: string | null;
  household: string | null;
  builder: string | null;
  elementary_schools: string | null;
  subways: string | null;
  rail_catalyst: string | null;
  devel_catalyst: string | null;
  static?: Record<string, string | number>;
}

export interface SubwayMarker {
  name: string;
  lines: string[];
  dist_m: number | null;
  walk_min: number | null;
}

export interface SchoolMarker {
  name: string;
  dist_m: number | null;
  walk_min: number | null;
}

export interface CatalystMarker {
  name: string;
  kind: string;
  station: string | null;
  raw: string;
}

export interface MapInfo {
  address: string;
  region: string;
  center_query: string;
  complex_name: string;
  vworld_key: string;
  subways: SubwayMarker[];
  schools: SchoolMarker[];
  catalysts: CatalystMarker[];
}

export interface ReportListing {
  si: string;
  gu: string;
  dong: string;
  complex_name: string;
  pyeong: string;
  current_price_eok: number | null;
  last_date: string | null;
  horizon: number;
  max_months: number;
  months: number;
  years: number;
  n_scenarios: number;
  p50_final_eok: number | null;
  ret_p50_pct: number | null;
}

export interface Report {
  listing: ReportListing;
  fan: { history: FanPoint[]; forecast: FanPoint[]; anchor: FanPoint | null };
  shap: Shap;
  detail: ReportDetail;
  map: MapInfo;
}

// ---- 구(區) 단위 전망 분석 (지수 기반) ----
export interface GuItem {
  si: string;
  gu: string;
  ret_bvarx_pct: number | null;
}

export interface IndexPoint {
  ts: string;
  value: number;
}

export interface BandPoint {
  ts: string;
  p1: number;
  p10: number;
  p50: number;
  p90: number;
  p99: number;
}

export interface GuTopFeature {
  feature: string;
  name: string;
  desc: string;
  group: string;
  icon: string;
  impact: number;
  impact_pct: number;
  direction: "up" | "down";
}

export interface GuReport {
  gu: string;
  si: string;
  months: number;
  years: number;
  last_date: string | null;
  last_index: number | null;
  point_end: number | null;
  ret_point_pct: number | null;
  tft_band_end: { p10: number; p90: number } | null;
  history: IndexPoint[];
  point: IndexPoint[];
  tft: { forecast: BandPoint[]; anchor: { ts: string | null; value: number | null } };
  rw: { forecast: BandPoint[]; anchor: { ts: string | null; value: number | null } };
  shap_point: GuTopFeature[];
  shap_band: GuTopFeature[];
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`/api${path}${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  search: (q: string) => get<SearchItem[]>("/search", { q }),
  filters: (params: Record<string, string>) => get<FilterResponse>("/filters", params),
  areas: (gu: string, dong: string, complex_name: string, months?: number) =>
    get<AreaItem[]>("/areas", {
      gu,
      dong,
      complex_name,
      ...(months ? { months: String(months) } : {}),
    }),
  report: (gu: string, dong: string, complex_name: string, pyeong: string, months: number) =>
    get<Report>("/report", { gu, dong, complex_name, pyeong, months: String(months) }),
  guList: () => get<GuItem[]>("/gu/list"),
  guReport: (gu: string, months: number) =>
    get<GuReport>("/gu/report", { gu, months: String(months) }),
  aiInsight: async (body: {
    gu: string;
    dong: string;
    complex_name: string;
    pyeong: string;
    months: number;
  }) => {
    const res = await fetch("/api/ai-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("ai-insight failed");
    return (await res.json()) as { insight: string };
  },
  guInsight: async (body: { gu: string }) => {
    const res = await fetch("/api/gu/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("gu-insight failed");
    return (await res.json()) as { insight: string };
  },
};
