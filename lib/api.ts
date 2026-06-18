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
}

export interface ClusterBucket {
  prob: number;
  count: number;
  price_low: number | null;
  price_high: number | null;
  price_mid: number | null;
  ret_pct: number | null;
}

export interface Cluster {
  bull: ClusterBucket;
  neutral: ClusterBucket;
  bear: ClusterBucket;
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
  cluster: Cluster | null;
  shap: Shap;
  detail: ReportDetail;
  map: MapInfo;
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
  areas: (gu: string, dong: string, complex_name: string) =>
    get<AreaItem[]>("/areas", { gu, dong, complex_name }),
  report: (gu: string, dong: string, complex_name: string, pyeong: string, months: number) =>
    get<Report>("/report", { gu, dong, complex_name, pyeong, months: String(months) }),
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
};
