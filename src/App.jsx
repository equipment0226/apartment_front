import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Area, Legend,
} from "recharts";
import nubjukImg from "./nubjuk.png";

const API_BASE = "https://apartmentprediction-production.up.railway.app";

// ---------------------------------------------------------------------------
// Deepseek 설정 (일반인용 6-섹션 스토리텔링 리포트 생성)
// ⚠ 보안: 프론트엔드 번들에 LLM 키를 절대 포함하지 마세요.
//   Vite 의 VITE_* 환경변수도 빌드 시 그대로 번들에 인라인되어 노출됩니다.
//   반드시 백엔드 프록시(예: /api/llm)를 통해 호출하세요.
//   임시로 로컬 개발에만 import.meta.env.VITE_DEEPSEEK_KEY 를 사용할 수 있지만,
//   .env 파일은 .gitignore 에 포함되어야 하고 빌드 산출물을 외부에 배포해서는 안 됩니다.
// ---------------------------------------------------------------------------
const DEEPSEEK_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_DEEPSEEK_KEY) || "";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

// ---------------------------------------------------------------------------
// 포맷 헬퍼
// ---------------------------------------------------------------------------
function formatNumber(v) {
  return Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}
function formatManwon(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}
function formatPct(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return `${Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
}

const INDICATOR_LABELS_KO = {
  apt_sale_avg_price: "아파트 매매 평균가격",
  apt_jeonse_avg_price: "아파트 전세 평균가격",
  apt_jeonse_supply_demand: "아파트 전세 수급지수",
  apt_monthly_rent_supply_demand: "아파트 월세 수급지수",
  apt_sale_index: "아파트 매매지수",
  apt_sale_supply_demand: "아파트 매매 수급지수",
  land_price_change_rate: "지가 변동률",
  base_rate: "기준금리",
  cd_91d_rate: "CD(91일) 금리",
  cpi_housing: "주택 CPI",
  mortgage_rate_new: "신규 주담대 금리",
  unemployment_rate: "실업률",
};
function rawIndicatorName(name = "") {
  const parts = String(name).split("__");
  return parts[parts.length - 1] || String(name);
}
function isTargetIndicator(name = "") {
  return rawIndicatorName(name) === "apt_sale_avg_price";
}
function indicatorLabel(name = "") {
  const raw = rawIndicatorName(name);
  return INDICATOR_LABELS_KO[raw] || raw;
}
function normalizeTsLabel(ts = "") {
  const txt = String(ts);
  if (/^\d{6}$/.test(txt)) return `${txt.slice(0, 4)}-${txt.slice(4, 6)}`;
  return txt;
}

// ---------------------------------------------------------------------------
// SVG 트렌드 차트 헬퍼
// ---------------------------------------------------------------------------
function buildTrendPathFromIndices(points, xIndexMap, width, height, minY, maxY) {
  if (!points?.length) return "";
  const denom = Math.max(maxY - minY, 1e-9);
  return points
    .map((p, idx) => {
      const key = normalizeTsLabel(p.timestamp || `idx-${idx}`);
      const x = xIndexMap.has(key) ? xIndexMap.get(key) : idx;
      const y = height - ((Number(p.price) - minY) / denom) * height;
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// 공통: 아파트 선택 필터
// ---------------------------------------------------------------------------
function ApartmentFilter({ aptGu, setAptGu, aptDong, setAptDong, aptComplex, setAptComplex, aptBuilding, setAptBuilding, aptFloor, setAptFloor, filters, filterError }) {
  return (
    <>
      {filters.encoding_warning ? <p className="sim-error">{filters.encoding_warning}</p> : null}
      {filterError ? <p className="sim-error">{filterError}</p> : null}
      <div className="sim-apartment-grid">
        <label className="sim-field">
          <span>구</span>
          <select value={aptGu} onChange={(e) => { setAptGu(e.target.value); setAptDong(""); setAptComplex(""); setAptBuilding(""); setAptFloor(""); }}>
            <option value="">선택</option>
            {(filters.gu_options || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="sim-field">
          <span>동</span>
          <select value={aptDong} onChange={(e) => { setAptDong(e.target.value); setAptComplex(""); setAptBuilding(""); setAptFloor(""); }}>
            <option value="">선택</option>
            {(filters.dong_options || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="sim-field">
          <span>단지명</span>
          <select value={aptComplex} onChange={(e) => { setAptComplex(e.target.value); setAptBuilding(""); setAptFloor(""); }}>
            <option value="">선택</option>
            {(filters.complex_options || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="sim-field">
          <span>동/층</span>
          <select value={aptBuilding} onChange={(e) => setAptBuilding(e.target.value)}>
            <option value="">동 선택</option>
            {(filters.building_options || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={aptFloor} onChange={(e) => setAptFloor(e.target.value)}>
            <option value="">층 선택</option>
            {(filters.floor_options || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <p className="sim-meta-inline">기준시세: <strong>{formatManwon(filters.base_price_manwon)}</strong> · 매칭 {filters.matched_rows || 0}건</p>
    </>
  );
}

// ---------------------------------------------------------------------------
// 공통: P10/P50/P90 기반 확률 카드 + 리스크
// ---------------------------------------------------------------------------
function QuantileResultCard({ probabilities, risk, returnP10, returnP50, returnP90, basePriceManwon, estimatedPriceManwon, scenarioId, scenarioLabel }) {
  if (!probabilities) return null;
  const dominant = Object.entries(probabilities).reduce((a, b) => a[1] >= b[1] ? a : b)?.[0] || "보합";
  const colorMap = { "상승": "up", "보합": "flat", "하락": "down" };

  return (
    <div className="qtl-result">
      <div className="sim-prob-grid">
        {["상승", "보합", "하락"].map((label) => (
          <article key={label} className={`prob-card ${colorMap[label]} ${dominant === label ? "active" : ""}`}>
            <p>{label}</p>
            <strong>{formatPct(probabilities[label])}</strong>
            <small>P10/P50/P90 분위수 기반</small>
          </article>
        ))}
      </div>

      <div className="qtl-band">
        <span className="qtl-label">수익률 분위수</span>
        <div className="qtl-values">
          <span>P10 <strong className="down-txt">{formatPct(returnP10)}</strong></span>
          <span>P50 <strong>{formatPct(returnP50)}</strong></span>
          <span>P90 <strong className="up-txt">{formatPct(returnP90)}</strong></span>
        </div>
        {risk && (
          <div className="qtl-risk">
            <span>밴드폭 {formatPct(risk.bandwidth_pct)}</span>
            <span>신뢰도 {risk.risk_grade}</span>
          </div>
        )}
      </div>

      {(basePriceManwon || estimatedPriceManwon) && (
        <div className="qtl-price">
          <span>기준시세 <strong>{formatManwon(basePriceManwon)}</strong></span>
          <span>→</span>
          <span>예상가격 <strong>{formatManwon(estimatedPriceManwon)}</strong></span>
        </div>
      )}

      {scenarioId && (
        <p className="qtl-meta">시나리오: {scenarioId}{scenarioLabel ? ` (${scenarioLabel})` : ""}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 공통: 트렌드 차트
// ---------------------------------------------------------------------------
function TrendChart({ historyPoints, forecastPoints, label }) {
  const allPts = useMemo(() => [
    ...(historyPoints || []).map((p) => ({ ...p, type: "history" })),
    ...(forecastPoints || []).map((p) => ({ ...p, type: "forecast" })),
  ], [historyPoints, forecastPoints]);

  const timeline = useMemo(() => {
    const labels = allPts.map((p) => normalizeTsLabel(p.timestamp));
    return [...new Set(labels)].filter(Boolean);
  }, [allPts]);

  const { minY, maxY } = useMemo(() => {
    const vals = allPts.map((p) => Number(p.price)).filter(Number.isFinite);
    if (!vals.length) return { minY: 0, maxY: 1 };
    return { minY: Math.min(...vals), maxY: Math.max(...vals) };
  }, [allPts]);

  if (!allPts.length) return <p className="sim-placeholder">차트 데이터 없음</p>;

  const plot = { x: 56, y: 16, w: 680, h: 220 };
  const xIndexMap = new Map();
  timeline.forEach((lbl, i) => {
    const x = plot.x + (timeline.length > 1 ? (i * plot.w) / (timeline.length - 1) : plot.w / 2);
    xIndexMap.set(lbl, x);
  });

  const tickCount = Math.min(6, timeline.length);
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const idx = Math.round((i * (timeline.length - 1)) / Math.max(tickCount - 1, 1));
    return { idx, label: timeline[idx] };
  });

  const histPts = allPts.filter((p) => p.type === "history");
  const fcastPts = allPts.filter((p) => p.type === "forecast");
  // connect forecast from last history point
  const fcastFull = histPts.length ? [histPts[histPts.length - 1], ...fcastPts] : fcastPts;

  const denom = Math.max(maxY - minY, 1e-9);
  const makePath = (pts) => pts.map((p, i) => {
    const key = normalizeTsLabel(p.timestamp);
    const x = xIndexMap.has(key) ? xIndexMap.get(key) : plot.x + i;
    const y = plot.y + plot.h - ((Number(p.price) - minY) / denom) * plot.h;
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  return (
    <div className="sim-trend-chart">
      <svg viewBox="0 0 760 268" preserveAspectRatio="none" role="img" aria-label={`${label || ""} trend chart`}>
        <line x1={plot.x} y1={plot.y + plot.h} x2={plot.x + plot.w} y2={plot.y + plot.h} className="sim-axis" />
        <line x1={plot.x} y1={plot.y} x2={plot.x} y2={plot.y + plot.h} className="sim-axis" />
        {ticks.map((t) => {
          const x = xIndexMap.get(t.label) ?? plot.x;
          return (
            <g key={`${t.label}-${t.idx}`}>
              <line x1={x} y1={plot.y + plot.h} x2={x} y2={plot.y + plot.h + 5} className="sim-axis-tick" />
              <text x={x} y={plot.y + plot.h + 18} textAnchor="middle" className="sim-axis-label">{t.label}</text>
            </g>
          );
        })}
        {/* Y-axis labels */}
        {[0, 0.5, 1].map((frac) => {
          const val = minY + frac * (maxY - minY);
          const y = plot.y + plot.h - frac * plot.h;
          return (
            <text key={frac} x={plot.x - 4} y={y + 4} textAnchor="end" className="sim-axis-label">
              {formatNumber(Math.round(val))}
            </text>
          );
        })}
        {histPts.length > 1 && <path d={makePath(histPts)} className="sim-line history best" />}
        {fcastFull.length > 1 && <path d={makePath(fcastFull)} className="sim-line forecast best" />}
      </svg>
      <small>실선: 과거 실거래 환산 | 점선: TFT 예측 (P50 중앙값)</small>
    </div>
  );
}

// ---------------------------------------------------------------------------
// useApartmentFilters 훅
// ---------------------------------------------------------------------------
function useApartmentFilters(aptGu, aptDong, aptComplex, aptBuilding, aptFloor) {
  const [filters, setFilters] = useState({
    gu_options: [], dong_options: [], complex_options: [], building_options: [], floor_options: [],
    matched_rows: 0, base_price_manwon: null, encoding_warning: "",
  });
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFilterError("");
      try {
        const params = new URLSearchParams();
        if (aptGu) params.set("gu", aptGu);
        if (aptDong) params.set("dong", aptDong);
        if (aptComplex) params.set("complex_name", aptComplex);
        if (aptBuilding) params.set("building", aptBuilding);
        if (aptFloor) params.set("floor", aptFloor);
        const res = await fetch(`${API_BASE}/apartment/filters${params.toString() ? `?${params}` : ""}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "아파트 필터 오류");
        if (!cancelled) setFilters(data);
      } catch (e) {
        if (!cancelled) setFilterError(e.message || "아파트 필터 조회 오류");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [aptGu, aptDong, aptComplex, aptBuilding, aptFloor]);

  return { filters, filterError };
}

// ===========================================================================
// Tab 1: User 분석 (Diffusion-TFT + 자연어 쿼리)
// ===========================================================================
function UserAnalysisTab() {
  const [aptGu, setAptGu] = useState("");
  const [aptDong, setAptDong] = useState("");
  const [aptComplex, setAptComplex] = useState("");
  const [aptBuilding, setAptBuilding] = useState("");
  const [aptFloor, setAptFloor] = useState("");
  const { filters, filterError } = useApartmentFilters(aptGu, aptDong, aptComplex, aptBuilding, aptFloor);

  const [queryText, setQueryText] = useState("");
  const [targetMonths, setTargetMonths] = useState(12);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function handleSearch() {
    if (!queryText.trim()) { setError("분석 조건을 입력해 주세요."); return; }
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/simulation/text-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText.trim(),
          target_months: targetMonths,
          apartment: {
            gu: aptGu || undefined,
            dong: aptDong || undefined,
            complex_name: aptComplex || undefined,
            building: aptBuilding || undefined,
            floor: aptFloor || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "분석 실패");
      setResult(data);
    } catch (e) {
      setError(e.message || "알 수 없는 오류");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="sim-grid">
      {/* 입력 패널 */}
      <div className="sim-panel">
        <h2>분석 조건</h2>

        <div className="sim-indicator-head">
          <h3>서울 아파트 선택</h3>
        </div>
        <ApartmentFilter
          aptGu={aptGu} setAptGu={setAptGu}
          aptDong={aptDong} setAptDong={setAptDong}
          aptComplex={aptComplex} setAptComplex={setAptComplex}
          aptBuilding={aptBuilding} setAptBuilding={setAptBuilding}
          aptFloor={aptFloor} setAptFloor={setAptFloor}
          filters={filters} filterError={filterError}
        />

        <div className="sim-indicator-head" style={{ marginTop: 20 }}>
          <h3>상세 분석 조건</h3>
          <small>챗봇에게 원하는 검색 조건을 입력해주세요.</small>
        </div>
        <QueryChatbot
          finalizedQuery={queryText}
          onFinalize={(q) => setQueryText(q)}
          onReset={() => setQueryText("")}
        />

        <label className="sim-field" style={{ marginTop: 12 }}>
          <span>예측 기간: <strong>{targetMonths}개월</strong></span>
          <input
            type="range" min={1} max={120} value={targetMonths}
            onChange={(e) => setTargetMonths(Number(e.target.value))}
          />
        </label>

        <button className="sim-run-btn" onClick={handleSearch} disabled={running || !queryText.trim()}>
          {running ? "최유사 Diffusion-TFT 시나리오 탐색 중..." : "유사 시나리오 검색 및 분석"}
        </button>
        {error ? <p className="sim-error">{error}</p> : null}
      </div>

      {/* 결과 패널 */}
      <div className="sim-panel sim-result">
        <h2>분석 결과 리포트</h2>
        {!result ? (
          <p className="sim-placeholder">아파트 선정 후 세부 검색 조건을 입력하면 결과가 표시됩니다.</p>
        ) : (
          <>
            {result.region_warning && (
              <div className="region-warning">
                <span className="region-warning-icon">⚠</span>
                {result.region_warning}
              </div>
            )}

            {/* 자연어 파싱 결과 */}
            {result.text_matched === false && (
              <div className="region-warning" style={{ background: "rgba(255,243,205,0.9)", borderColor: "rgba(200,150,0,0.3)" }}>
                <span className="region-warning-icon">ℹ</span>
                쿼리에서 거시 지표를 인식하지 못했습니다. 인식 예시: <em>"금리 인상", "집값 하락", "경기 침체", "물가 상승"</em> 등의 키워드를 포함해 주세요.
              </div>
            )}

            {result.direction_intent && result.direction_intent !== "neutral" && (
              <div className="direction-badge-wrap">
                <span className={`direction-badge direction-${result.direction_intent}`}>
                  {result.direction_intent === "bull" ? "▲ 강세 시나리오 우선 선택" : "▼ 약세 시나리오 우선 선택"}
                </span>
              </div>
            )}

            {/* 🆕 6-섹션 일반인용 스토리텔링 리포트 (Deepseek) */}
            <StorytellingReport
              result={result}
              apt={{ gu: aptGu, dong: aptDong, complex_name: aptComplex, building: aptBuilding, floor: aptFloor }}
              targetMonths={targetMonths}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// 군집 분석 탭 — ClusterAnalysisTab (대표 시나리오 분석)
const PHASE_KO = { A: "경착륙·침체", B: "과열 Bull", C: "전세 불안", D: "스태그플레이션", E: "안정·연착륙" };
const PHASE_COLOR = { A: "#9e2a2e", B: "#1d6e4a", C: "#7c4b00", D: "#6e3a8e", E: "#1a3f6f" };
const DIR_KO = { bull: "낙관", neutral: "중립", bear: "비관" };
const CLUSTER_PALETTE = ["#4361ee", "#f77f00", "#1d6e4a", "#9e2a2e"];

function SparklineSvg({ data, color = "#4361ee" }) {
  if (!data || data.length < 2) return <div className="sparkline-empty">데이터 없음</div>;
  const vals = data.map((d) => d.v);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const W = 120, H = 40, PAD = 4;
  const pts = vals.map((v, i) => [
    PAD + (i / (vals.length - 1)) * (W - 2 * PAD),
    PAD + ((maxV - v) / range) * (H - 2 * PAD),
  ]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sparkline-svg" aria-hidden="true">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="2" />
      <path d={`${d} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`}
        fill={color} fillOpacity="0.12" />
    </svg>
  );
}

function ClusterCard({ cluster, isActive, palette, onClick }) {
  const minPct = cluster.min_return_pct;
  const maxPct = cluster.max_return_pct;
  const retLabel =
    minPct == null && maxPct == null
      ? "–"
      : minPct == null
      ? `${maxPct >= 0 ? "+" : ""}${maxPct.toFixed(1)}%`
      : maxPct == null
      ? `${minPct >= 0 ? "+" : ""}${minPct.toFixed(1)}%`
      : `${minPct >= 0 ? "+" : ""}${minPct.toFixed(1)}% ~ ${maxPct >= 0 ? "+" : ""}${maxPct.toFixed(1)}%`;
  const retMid = minPct != null && maxPct != null ? (minPct + maxPct) / 2 : (minPct ?? maxPct);
  const retCls = retMid == null ? "" : retMid >= 0 ? "up" : "down";
  const accentColor = palette;

  return (
    <div
      className={`cluster-card ${isActive ? "active" : ""}`}
      style={{ "--card-accent": accentColor }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-pressed={isActive}
    >
      <div className="cluster-card-header">
        <span className="cluster-badge" style={{ background: accentColor }}>
          Cluster {cluster.cluster_id + 1}
        </span>
        <span className={`cluster-phase-tag phase-${cluster.dominant_phase}`}>
          {cluster.dominant_phase}: {PHASE_KO[cluster.dominant_phase] || cluster.dominant_phase}
        </span>
      </div>
      <div className="cluster-card-title">{cluster.label}</div>
      <div className="cluster-card-stats">
        <div className="cluster-stat">
          <span className="cluster-stat-label">발생 확률</span>
          <span className="cluster-stat-value">{cluster.probability_pct}%</span>
          <span className="cluster-stat-note">({cluster.count}개 / {cluster.count})</span>
        </div>
        <div className="cluster-stat">
          <span className="cluster-stat-label">수익률 범위 (IQR)</span>
          <span className={`cluster-stat-value cluster-return ${retCls}`}>{retLabel}</span>
        </div>
      </div>
      <SparklineSvg data={cluster.sparkline} color={accentColor} />
      <div className="cluster-dir-dist">
        {Object.entries(cluster.direction_distribution || {}).map(([d, n]) => (
          <span key={d} className={`dir-chip dir-${d}`}>{DIR_KO[d] || d} {n}</span>
        ))}
      </div>
    </div>
  );
}

function DeepDiveChart({ cluster, palette, selectedSid, onSelectSid }) {
  if (!cluster) return null;
  const meanData = cluster.mean_trajectory || [];
  const trajectories = cluster.trajectories || [];

  const tsSet = new Set(meanData.map((d) => d.t));
  trajectories.forEach((t) => t.points.forEach((p) => tsSet.add(p.t)));
  const allTs = Array.from(tsSet).sort();

  const trajLookups = trajectories.map((traj) => ({
    sid: traj.scenario_id,
    ptMap: new Map(traj.points.map((p) => [p.t, p.v])),
  }));

  const chartData = useMemo(() => allTs.map((ts) => {
    const row = { t: ts };
    const mp = meanData.find((d) => d.t === ts);
    if (mp) row.__mean = mp.v;
    for (const { sid, ptMap } of trajLookups) {
      const v = ptMap.get(ts);
      if (v != null) row[sid] = v;
    }
    return row;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cluster]);

  const hasSelection = selectedSid != null;

  return (
    <div className="deepdive-chart-wrap">
      {hasSelection && (
        <div className="chart-selection-hint">
          <span className="selected-sid-label">선택됨: <strong>{selectedSid}</strong></span>
          <button className="deselect-btn" onClick={() => onSelectSid(null)}>✕ 선택 해제</button>
        </div>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#2a2e3d" strokeDasharray="4 2" />
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#9ba3b8" }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "#9ba3b8" }} width={60}
            tickFormatter={(v) => `${Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만`} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload) return null;
              // 선택된 시나리오가 있으면 그것만, 없으면 평균만 표시
              const targetKey = hasSelection ? selectedSid : "__mean";
              const entry = payload.find((p) => p.dataKey === targetKey);
              if (!entry || entry.value == null) return null;
              return (
                <div style={{ background: "#1a1f2e", border: "1px solid #3a3f52", padding: "6px 10px", borderRadius: 6, fontSize: 11 }}>
                  <p style={{ color: "#9ba3b8", margin: "0 0 4px 0" }}>시점: {label}</p>
                  <p style={{ color: entry.stroke || palette, margin: 0 }}>
                    {hasSelection ? `시나리오 ${selectedSid}` : "클러스터 평균"}:{" "}
                    {Number(entry.value).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              );
            }}
          />
          {/* 개별 시나리오 궤적 — 선택 상태에 따라 opacity/width 변화 */}
          {trajLookups.map(({ sid }) => {
            const isSelected = selectedSid === sid;
            const dimmed = hasSelection && !isSelected;
            return (
              <Line
                key={sid}
                type="linear"
                dataKey={sid}
                stroke={palette}
                strokeWidth={isSelected ? 2.5 : 0.8}
                strokeOpacity={dimmed ? 0.07 : isSelected ? 1.0 : 0.2}
                dot={false}
                isAnimationActive={false}
                legendType="none"
                connectNulls
                onClick={() => onSelectSid(isSelected ? null : sid)}
                style={{ cursor: "pointer" }}
              />
            );
          })}
          {/* 클러스터 평균: 선택된 시나리오가 있으면 반투명 처리 */}
          {meanData.length > 0 && (
            <Line
              type="monotone"
              dataKey="__mean"
              stroke={palette}
              strokeWidth={hasSelection ? 1.5 : 3}
              strokeOpacity={hasSelection ? 0.35 : 1.0}
              strokeDasharray={hasSelection ? "6 3" : undefined}
              dot={false}
              name="클러스터 평균"
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {!hasSelection && (
        <p style={{ fontSize: 11, color: "#6b7080", textAlign: "center", margin: "4px 0 0" }}>
          선 클릭 시 해당 시나리오 강조 + XAI 리포트 생성
        </p>
      )}
    </div>
  );
}

/* ── XAI 리포트 컴포넌트 ───────────────────────────────────────────────── */
const FEATURE_LABEL = {
  "ecos__base_rate": "기준금리",
  "ecos__cd_91d_rate": "CD 91일",
  "ecos__mortgage_rate_new": "주담대 금리(신규)",
  "ecos__cpi_housing": "주거 CPI",
  "ecos__unemployment_rate": "실업률",
  "reb__apt_sale_avg_price": "아파트 매매가",
  "reb__apt_sale_supply_demand": "매매 수급지수",
  "reb__apt_jeonse_avg_price": "전세 평균가",
  "reb__apt_jeonse_supply_demand": "전세 수급지수",
  "reb__apt_monthly_rent_supply_demand": "월세 수급",
  "reb__apt_sale_index": "매매지수",
  "policy__dsr_regime": "DSR 규제",
  "policy__dti_regime": "DTI 규제",
  "policy__ltv_regime": "LTV 규제",
  "policy__real_estate_policy_regime": "부동산 정책",
  "policy__capital_gains_tax_regime": "양도세",
  "policy__adjustment_target_area_regime": "조정대상지역",
  "policy__comprehensive_real_estate_tax_regime": "종합부동산세",
  "policy__acquisition_tax_regime": "취득세",
  "policy__speculative_overheated_district_regime": "투기과열지구",
  "policy__speculative_zone_regime": "투기지역",
  "relative_time_idx": "시간 인덱스",
  "target": "목표 변수",
};

const PHASE_DESC = {
  A: "급등 (폭발적 상승)",
  B: "안정 상승",
  C: "정점 / 조정 진입",
  D: "하락 / 침체",
  E: "횡보 / 불확실",
};

function XAIReport({ scenarioId, runId, palette }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("vsn");

  useEffect(() => {
    if (!scenarioId) { setData(null); return; }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ top_n: 8 });
    if (runId) params.set("run_id", runId);
    fetch(`${API_BASE}/simulation/scenario-xai/${encodeURIComponent(scenarioId)}?${params}`)
      .then((r) => r.ok ? r.json() : r.json().then((j) => Promise.reject(j.detail || r.statusText)))
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [scenarioId, runId]);

  if (!scenarioId) return null;

  return (
    <section className="xai-report card-box">
      <h2 className="section-title">
        XAI 리포트 — <span style={{ color: palette }}>{scenarioId}</span>
        <span className="section-meta" style={{ marginLeft: 10 }}>Temporal Fusion Transformer · VSN 기반 설명</span>
      </h2>

      {loading && <p className="xai-loading">분석 중…</p>}
      {error && <p className="error-msg">XAI 로드 오류: {error}</p>}

      {data && (
        <>
          <div className="xai-tabs">
            {[["vsn", "📊 피처 중요도 (VSN)"], ["timeline", "📈 주요 지표 경로"], ["phase", "🗂 페이즈 타임라인"]].map(([id, label]) => (
              <button
                key={id}
                className={`xai-tab-btn${activeTab === id ? " active" : ""}`}
                onClick={() => setActiveTab(id)}
              >{label}</button>
            ))}
          </div>

          {/* ── VSN 피처 중요도 ── */}
          {activeTab === "vsn" && (
            <div className="xai-vsn-section">
              <p className="xai-hint">TFT Variable Selection Network 가중치 기준 상위 피처 (encoder + decoder 평균)</p>
              <div className="vsn-bar-list">
                {data.vsn_importance.map((item, i) => {
                  const maxW = data.vsn_importance[0]?.combined_weight || 1;
                  const pct = ((item.combined_weight / maxW) * 100).toFixed(1);
                  const label = FEATURE_LABEL[item.feature] || item.feature;
                  return (
                    <div key={item.feature} className="vsn-bar-row">
                      <span className="vsn-rank">#{i + 1}</span>
                      <span className="vsn-feat-label" title={item.feature}>{label}</span>
                      <div className="vsn-bar-track">
                        <div
                          className="vsn-bar-fill"
                          style={{ width: `${pct}%`, background: palette, opacity: 0.85 - i * 0.07 }}
                        />
                      </div>
                      <span className="vsn-weight-val">{(item.combined_weight * 100).toFixed(2)}%</span>
                      <span className="vsn-weight-detail">
                        enc {(item.encoder_weight * 100).toFixed(2)}% · dec {(item.decoder_weight * 100).toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 인디케이터 경로 ── */}
          {activeTab === "timeline" && (
            <div className="xai-timeline-section">
              <p className="xai-hint">상위 피처의 시나리오별 경로 (20pt 샘플, 정규화 없는 원값)</p>
              {data.indicator_timeline.length > 0 ? (
                <div className="ind-table-wrap">
                  <table className="ind-table">
                    <thead>
                      <tr>
                        <th>시점</th>
                        {data.top_features.slice(0, 5).map((f) => (
                          <th key={f} title={f}>{FEATURE_LABEL[f] || f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.indicator_timeline.map((row) => (
                        <tr key={row.t}>
                          <td className="ind-ts">{row.t}</td>
                          {data.top_features.slice(0, 5).map((f) => (
                            <td key={f}>{row[f] != null ? Number(row[f]).toFixed(2) : "–"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="xai-hint">인디케이터 경로 데이터가 없습니다.</p>
              )}
            </div>
          )}

          {/* ── 페이즈 타임라인 ── */}
          {activeTab === "phase" && (
            <div className="xai-phase-section">
              <p className="xai-hint">3개월 window 단위 국면 전환 (총 40 window = 120개월)</p>
              <div className="phase-timeline-strip">
                {data.phase_timeline.map((w) => (
                  <div
                    key={w.window}
                    className="phase-strip-cell"
                    style={{ background: PHASE_COLOR[w.phase] + "55", border: `1px solid ${PHASE_COLOR[w.phase]}` }}
                    title={`W${w.window}: ${w.phase} (${PHASE_DESC[w.phase]}) · ${w.month_start}~${w.month_end}개월`}
                  >
                    <span className="phase-strip-label">{w.phase}</span>
                    <span className="phase-strip-wlabel">W{w.window}</span>
                  </div>
                ))}
              </div>
              <div className="phase-legend">
                {Object.entries(PHASE_DESC).map(([p, desc]) => (
                  <span key={p} className="phase-legend-item">
                    <span className="phase-legend-dot" style={{ background: PHASE_COLOR[p] }} />
                    <span className={`phase-tag phase-${p}`}>{p}</span> {desc}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ===========================================================================
// 🆕 일반인용 6-섹션 스토리텔링 리포트 (Deepseek LLM 기반)
// ===========================================================================

// 만원 → "OO.O억" 변환
function formatEok(manwon, digits = 1) {
  if (manwon == null || Number.isNaN(Number(manwon))) return "-";
  const eok = Number(manwon) / 10000;
  return `${eok.toFixed(digits)}억`;
}

// Deepseek 호출
async function callDeepseek(messages, { responseFormat = null, temperature = 0.6 } = {}) {
  const body = {
    model: DEEPSEEK_MODEL,
    messages,
    temperature,
    stream: false,
  };
  if (responseFormat) body.response_format = responseFormat;
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Deepseek ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function tryParseJSON(text) {
  if (!text) return null;
  let s = String(text).trim();
  // strip ```json ... ``` fences
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) s = m[1].trim();
  try { return JSON.parse(s); } catch { /* fallthrough */ }
  // try to grab outermost {...}
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i >= 0 && j > i) {
    try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; }
  }
  return null;
}

// 마일스톤 추출 (예측 종료기간까지 전체 forecast 사용)
function extractMilestones(forecast, basePriceManwon, maxMonths) {
  if (!forecast?.length) return [];
  const limit = Math.max(1, Math.min(forecast.length, Number(maxMonths) || forecast.length));
  const pts = forecast.slice(0, limit);
  const prices = pts.map((p) => Number(p.price));
  const peakIdx = prices.indexOf(Math.max(...prices));
  // 정점 이후 저점
  let troughIdx = -1;
  if (peakIdx < pts.length - 1) {
    const tail = prices.slice(peakIdx + 1);
    const minVal = Math.min(...tail);
    troughIdx = peakIdx + 1 + tail.indexOf(minVal);
  }
  // 회복기: 0~peak 사이에서 base 대비 첫 +2% 돌파 지점
  let recoveryIdx = -1;
  const base = basePriceManwon || prices[0];
  for (let k = 0; k <= peakIdx; k++) {
    if (prices[k] >= base * 1.02) { recoveryIdx = k; break; }
  }
  const last = pts.length - 1;
  const out = [];
  out.push({ idx: 0, label: "현재", price: prices[0] });
  if (recoveryIdx > 0 && recoveryIdx !== peakIdx) out.push({ idx: recoveryIdx, label: "회복기", price: prices[recoveryIdx] });
  if (peakIdx > 0 && peakIdx !== last) out.push({ idx: peakIdx, label: "단기 정점", price: prices[peakIdx] });
  if (troughIdx > 0 && troughIdx !== last) out.push({ idx: troughIdx, label: "조정 저점", price: prices[troughIdx] });
  out.push({ idx: last, label: `${Math.round((last + 1) / 12 * 10) / 10}년 후`, price: prices[last] });
  return out;
}

// Fan chart 데이터 생성: 중앙값(p50) 라인 + p10~p90 단일 음영 밴드
// p10Ret / p90Ret 는 base price 대비 누적 수익률(%)이므로,
// 음영 밴드는 그 절대값이 아니라 "median 주변 대칭 spread"로 그려야 p50이 항상 중앙에 위치한다.
function buildFanChartData(forecast, p10Ret, p90Ret, maxMonths) {
  if (!forecast?.length) return [];
  const limit = Math.max(1, Math.min(forecast.length, Number(maxMonths) || forecast.length));
  const pts = forecast.slice(0, limit);
  const loRet = (p10Ret ?? -10) / 100;   // 비관 (p10) 수익률
  const hiRet = (p90Ret ?? 10) / 100;    // 낙관 (p90) 수익률
  // p10~p90 폭의 절반 = median 기준 대칭 반폭 (분위 역전 안전)
  const halfSpread = Math.abs(hiRet - loRet) / 2;
  const N = pts.length;
  return pts.map((p, i) => {
    // 불확실성은 시간에 비례하여 확장 (sqrt 스케일)
    const widen = Math.sqrt((i + 1) / N);
    const med = Number(p.price);
    const bandHi = med * (1 + halfSpread * widen);
    const bandLo = med * (1 - halfSpread * widen);
    return {
      t: normalizeTsLabel(p.timestamp || `+${i + 1}m`),
      median_eok: med / 10000,
      band_eok: [bandLo / 10000, bandHi / 10000],
    };
  });
}

// ────────────────────────────────────────────────────────────────────────
// 차트 1: Fan chart (중앙값 라인 + p10~p90 음영)
// ────────────────────────────────────────────────────────────────────────
function FiveYearFanChart({ forecast, basePriceManwon, p10Ret, p90Ret, targetMonths }) {
  const data = useMemo(
    () => buildFanChartData(forecast, p10Ret, p90Ret, targetMonths),
    [forecast, p10Ret, p90Ret, targetMonths]
  );
  const milestones = useMemo(
    () => extractMilestones(forecast, basePriceManwon, targetMonths),
    [forecast, basePriceManwon, targetMonths]
  );
  if (!data.length) return <p className="sim-placeholder">예측 데이터가 없습니다.</p>;

  const milestoneByTs = new Map(milestones.map((m) => [data[m.idx]?.t, m]));

  return (
    <div className="story-fan-wrap">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#2a2e3d" strokeDasharray="3 3" />
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#9ba3b8" }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10, fill: "#9ba3b8" }} width={56}
            tickFormatter={(v) => `${v.toFixed(0)}억`}
            domain={["dataMin - 1", "dataMax + 1"]}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload;
              if (!row) return null;
              return (
                <div className="story-tooltip">
                  <p className="story-tt-ts">{label}</p>
                  <p>예상(p50): <strong>{row.median_eok.toFixed(2)}억</strong></p>
                  <p className="story-tt-range">
                    예상 범위(p10~p90): {row.band_eok[0].toFixed(2)} ~ {row.band_eok[1].toFixed(2)}억
                  </p>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            payload={[
              { value: "예상 가격 (중앙값 · p50)", type: "line", color: "#4361ee" },
              { value: "예상 범위 (p10 ~ p90)", type: "rect", color: "#4361ee55" },
            ]}
          />
          {/* p10~p90 음영 밴드 (라인 아래로 깔리도록 먼저 렌더) */}
          <Area type="monotone" dataKey="band_eok" stroke="none" fill="#4361ee" fillOpacity={0.22} />
          {/* 중앙값(p50) 라인 — 가장 위 */}
          <Line
            type="monotone" dataKey="median_eok" stroke="#4361ee" strokeWidth={2.5} dot={false}
            isAnimationActive={false}
          />
          {/* 마일스톤 라벨 점 */}
          <Line
            type="monotone" dataKey="median_eok" stroke="transparent" isAnimationActive={false}
            dot={(props) => {
              const m = milestoneByTs.get(props.payload?.t);
              if (!m) return null;
              return (
                <g key={`ms-${props.index}`}>
                  <circle cx={props.cx} cy={props.cy} r={5} fill="#f77f00" stroke="#fff" strokeWidth={1.5} />
                  <text
                    x={props.cx} y={props.cy - 12}
                    textAnchor="middle" fontSize={11} fill="#f1c40f" fontWeight="600"
                  >
                    {m.label} · {(m.price / 10000).toFixed(1)}억
                  </text>
                </g>
              );
            }}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 차트 2: 가격 영향 요인 막대 (정책/금리/수급 3개 카테고리)
// ────────────────────────────────────────────────────────────────────────
const FACTOR_CATEGORY_META = {
  정책: { color: "#9b59b6", icon: "📜" },
  금리: { color: "#e67e22", icon: "💰" },
  수급: { color: "#27ae60", icon: "🏘" },
};
function FactorImpactBars({ factors }) {
  if (!factors?.length) return null;
  const grouped = {};
  factors.forEach((f) => {
    const cat = f.category || "기타";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  });
  return (
    <div className="story-factors">
      {Object.entries(grouped).map(([cat, items]) => {
        const meta = FACTOR_CATEGORY_META[cat] || { color: "#7f8c8d", icon: "🔹" };
        return (
          <div key={cat} className="story-factor-group">
            <h4 style={{ color: meta.color }}>
              <span>{meta.icon}</span> {cat}
            </h4>
            {items.map((f, i) => {
              const isUp = (f.impact || "").includes("↑");
              const color = isUp ? "#27ae60" : "#e74c3c";
              const strength = (f.impact || "").length; // ↑↑ → 2, ↑ → 1
              return (
                <div key={`${cat}-${i}`} className="story-factor-row">
                  <span className="story-factor-name">{f.name}</span>
                  <span className="story-factor-arrow" style={{ color }}>
                    {f.impact || "•"}
                  </span>
                  <div className="story-factor-bar">
                    <div
                      className="story-factor-fill"
                      style={{
                        width: `${Math.min(strength * 35, 100)}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <span className="story-factor-cause">{f.explanation}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 차트 3: 상승 vs 하락 환경 비교 (금리·수급·규제 3축)
// ────────────────────────────────────────────────────────────────────────
function ScenarioCompareTable({ bull, bear }) {
  if (!bull || !bear) return null;
  const axes = [
    { key: "rate", label: "금리" },
    { key: "supply", label: "수급" },
    { key: "policy", label: "규제" },
  ];
  return (
    <div className="story-scenario-compare">
      <table>
        <thead>
          <tr>
            <th></th>
            <th className="story-bull">▲ 상승 시나리오</th>
            <th className="story-bear">▼ 하락 시나리오</th>
          </tr>
        </thead>
        <tbody>
          {axes.map((ax) => (
            <tr key={ax.key}>
              <th>{ax.label}</th>
              <td className="story-bull-cell">{bull[ax.key] || "-"}</td>
              <td className="story-bear-cell">{bear[ax.key] || "-"}</td>
            </tr>
          ))}
          <tr className="story-target-row">
            <th>예상 가격</th>
            <td className="story-bull-cell">
              <strong>{bull.expected_price_eok ? `${bull.expected_price_eok}억` : "-"}</strong>
            </td>
            <td className="story-bear-cell">
              <strong>{bear.expected_price_eok ? `${bear.expected_price_eok}억` : "-"}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      {(bull.narrative || bear.narrative) && (
        <div className="story-scenario-narratives">
          {bull.narrative && (
            <div className="story-narr story-narr-bull">
              <h5>▲ 만약 이런 일이 벌어진다면</h5>
              <p>{bull.narrative}</p>
            </div>
          )}
          {bear.narrative && (
            <div className="story-narr story-narr-bear">
              <h5>▼ 만약 이런 일이 벌어진다면</h5>
              <p>{bear.narrative}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 페르소나별 액션 아이템 (보유자 / 매수 / 매도)
// ────────────────────────────────────────────────────────────────────────
const PERSONAS = [
  { key: "holder", label: "🏠 이미 보유 중이신 분", desc: "단기 모니터링 포인트" },
  { key: "buyer", label: "🛒 매수를 검토 중이신 분", desc: "확인하면 좋을 신호" },
  { key: "seller", label: "💼 매도를 검토 중이신 분", desc: "타이밍 점검 포인트" },
];
function PersonaActions({ actions }) {
  if (!actions) return null;
  return (
    <div className="story-personas">
      {PERSONAS.map((p) => {
        const items = actions[p.key] || [];
        return (
          <div key={p.key} className="story-persona-card">
            <h4>{p.label}</h4>
            <p className="story-persona-desc">{p.desc}</p>
            <ol>
              {items.length > 0
                ? items.map((it, i) => <li key={i}>{it}</li>)
                : <li className="story-empty">제시된 항목 없음</li>}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 6-섹션 스토리텔링 리포트 오케스트레이터
// ────────────────────────────────────────────────────────────────────────
function buildStoryPrompt(result, aptInfo, targetMonths) {
  const base = result.base_price_manwon;
  const est = result.estimated_price_manwon;
  const eokBase = base ? (base / 10000).toFixed(2) : "?";
  const eokEst = est ? (est / 10000).toFixed(2) : "?";
  const changed = result.changed_indicators || {};
  const changedLines = Object.entries(changed)
    .map(([k, v]) => `  - ${indicatorLabel(k)}: ${v}`)
    .join("\n") || "  (사용자 지정 변경 없음)";
  const probs = result.probabilities || {};
  const risk = result.risk || {};
  const aptLabel = [aptInfo.gu, aptInfo.dong, aptInfo.complex_name]
    .filter(Boolean).join(" ") || "(미선택)";
  const years = (targetMonths / 12).toFixed(1);

  const system = `당신은 부동산 데이터 분석가입니다. 일반 시민이 어려운 통계 용어 없이 \
"위에서부터 읽으며 자연스럽게 의사결정에 도달"하도록 친근한 설명체("~합니다")로 작성합니다.

작성 규칙:
- 모든 가격은 "OO.O억"으로 통일 (만원/㎡ 단위 금지).
- 가격 숫자 뒤에 조사 "으로/로"를 붙이지 마세요. 대신 "약 3.26억까지 하락", "약 3.26억 수준으로 예상", "약 3.26억 부근" 같이 작성.
- 단정형 금지. "~할 가능성이 큽니다", "~할 수도 있습니다" 형태로 작성.
- "위기", "폭락" 등 자극어 회피. 부정 정보는 차분하게 전달.
- 한 문장 80자 이내, 한 단락 4문장 이내.
- 변수명은 친숙하게 풀어 사용 (예: "LTV 레짐" → "주택담보대출 한도 규제").

반드시 아래 스키마의 순수 JSON 객체만 반환하세요 (코드펜스 금지, 설명 금지):
{
  "summary": "3~5문장. 현재(${eokBase}억) → 단기 변동 → ${years}년 후 예상가(${eokEst}억). '단, ~할 경우 ~까지 갈 수도 있다' 톤 포함.",
  "factors": [
    {"category": "정책|금리|수급", "name": "친숙한 변수명", "impact": "↑↑|↑|↓|↓↓", "explanation": "한 줄 인과"}
  ],
  "bull": {
    "rate": "금리 환경 한 줄",
    "supply": "수급 환경 한 줄",
    "policy": "규제 환경 한 줄",
    "expected_price_eok": "숫자(억)",
    "narrative": "만약 ~한다면 ~억까지 오를 수 있습니다. 2~3문장."
  },
  "bear": {
    "rate": "...", "supply": "...", "policy": "...",
    "expected_price_eok": "숫자(억)",
    "narrative": "..."
  },
  "actions": {
    "holder": ["3개 모니터링 포인트"],
    "buyer": ["3개 확인 포인트"],
    "seller": ["3개 점검 포인트"]
  },
  "longterm": {
    "narrative": "20년 흐름. '참고용'임을 명시. 2~3문장.",
    "risks": ["예측이 틀릴 수 있는 대표 케이스 3개"],
    "disclaimer": "투자 판단의 단독 근거가 될 수 없습니다 등 면책 고지문"
  }
}`;

  const user = `[대상 아파트]
${aptLabel} · 현재 가격: 약 ${eokBase}억

[모델 예측 (Diffusion-TFT)]
- 예측 기간: ${targetMonths}개월(약 ${years}년)
- 중앙값 예상가: ${eokEst}억 (현재 대비 ${result.return_pct_p50?.toFixed?.(1) ?? "?"}%)
- 가능성 높은 범위(상): +${result.return_pct_p90?.toFixed?.(1) ?? "?"}% (낙관)
- 가능성 높은 범위(하): ${result.return_pct_p10?.toFixed?.(1) ?? "?"}% (비관)
- 상승/보합/하락 확률: ${formatPct(probs["상승"])} / ${formatPct(probs["보합"])} / ${formatPct(probs["하락"])}
- 예측 신뢰도: ${risk.risk_grade || "정보 없음"} (밴드폭 ${formatPct(risk.bandwidth_pct)})
- 방향 의도: ${result.direction_intent || "neutral"}

[사용자가 지정한 변동 조건]
${changedLines}

[중요 발견 — factors 작성 시 반영]
- 현 시장에서는 정부 정책(세금/대출 규제)이 가격에 가장 큰 영향을 줍니다. factors의 정책 항목 영향 강도를 가장 크게 표기하세요.
- factors는 정확히 8개 변수로 구성: 정책 3개(주택담보대출 한도 규제, 부동산 세제, 조정대상지역 지정), 금리 2개(기준금리, 신규 주담대 금리), 수급 3개(아파트 매매 수급, 전세 수급, 매매지수).

위 데이터를 바탕으로 6-섹션 일반인용 리포트의 JSON을 생성하세요.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ────────────────────────────────────────────────────────────────────────
// 🆕 QueryChatbot — Deepseek 기반 자연어 조건 수집 챗봇 (최대 3 step)
// ────────────────────────────────────────────────────────────────────────
const CHATBOT_MAX_TURNS = 3;

function buildChatbotMessages(history, userTurnCount) {
  const forceFinalize = userTurnCount >= CHATBOT_MAX_TURNS;
  const system = `당신은 부동산 시뮬레이션 검색 조건을 모으는 친근한 한국어 챗봇입니다.

목적: 사용자가 알고 싶은 "거시 시나리오"를 한 문장으로 정리해서 검색에 넘기는 것.
정리에 필요한 핵심 요소 4가지:
  1) 시점 (예: 2026년 9월, 내년 상반기)
  2) 거시 변수 (기준금리, 주담대 금리, 집값, 전세, CPI, 실업률, LTV/DSR 규제, 부동산 정책 등)
  3) 방향 (상승/하락/완화/강화)
  4) 크기 또는 정도 (예: 0.5%p, 5%, 큰 폭, 소폭)

진행 규칙:
- 사용자 입력이 모호하거나 4가지 요소 중 빠진 게 있으면, 빠진 부분을 콕 집어 한 가지만 친근하게 되묻습니다.
  반드시 모범 예시 형태를 함께 보여주세요. 예: "2026년 9월에 기준금리가 0.5%p 인상되면 어떻게 될까요?"
- 사용자 입력이 부동산/거시경제와 무관하거나 부적절하면, 부드럽게 본 주제로 다시 안내합니다.
- 사용자 발화 ${CHATBOT_MAX_TURNS}회 이내에 반드시 검색 조건을 확정해야 합니다.
${forceFinalize ? `- ⚠ 이번 턴은 사용자 ${userTurnCount}번째 발화이므로, 정보가 부족해도 지금까지 모은 단서로 \
최선의 검색 문장을 만들어 status="complete"로 마무리하세요.` : "- 정보가 충분히 모이면 status=\"complete\"로 마무리하세요."}

반드시 아래 JSON만 반환하세요 (코드펜스/설명 금지):
{
  "status": "incomplete" | "complete",
  "reply": "사용자에게 보여줄 한국어 메시지(친근체, 80자 내외 1~2문장). complete이면 '이 조건으로 검색을 시작하겠습니다' 톤으로.",
  "synthesized_query": "status=complete일 때만 채움. 시점·변수·방향·크기가 들어간 자연어 한 문장. 예: '2026년 9월에 기준금리가 0.5%p 인상되면 어떻게 될까?'"
}`;

  const messages = [{ role: "system", content: system }];
  history.forEach((m) => {
    if (m.role === "user") messages.push({ role: "user", content: m.text });
    else if (m.role === "bot") messages.push({ role: "assistant", content: JSON.stringify({ status: m.status || "incomplete", reply: m.text }) });
  });
  return messages;
}

function QueryChatbot({ onFinalize, finalizedQuery, onReset }) {
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "안녕하세요! 어떤 시나리오를 살펴볼지 알려주세요.\n예) \"2026년 9월에 기준금리가 0.5%p 인상되면 어떻게 될까?\"",
      status: "incomplete",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [userTurns, setUserTurns] = useState(0);
  const [finalized, setFinalized] = useState(false);
  const [err, setErr] = useState("");

  async function handleSend() {
    const text = input.trim();
    if (!text || thinking || finalized) return;
    const newTurns = userTurns + 1;
    const nextHistory = [...messages, { role: "user", text }];
    setMessages(nextHistory);
    setInput("");
    setUserTurns(newTurns);
    setThinking(true);
    setErr("");

    try {
      const chatMsgs = buildChatbotMessages(nextHistory, newTurns);
      const raw = await callDeepseek(chatMsgs, {
        responseFormat: { type: "json_object" },
        temperature: 0.4,
      });
      const parsed = tryParseJSON(raw) || {};
      let status = parsed.status === "complete" ? "complete" : "incomplete";
      let reply = parsed.reply || "조금 더 자세히 말씀해 주세요.";
      let synth = parsed.synthesized_query || "";

      // 3턴 도달 시 강제 마감
      if (newTurns >= CHATBOT_MAX_TURNS) {
        status = "complete";
        if (!synth) {
          // 최후 폴백: 사용자 발화를 그대로 검색 문장으로
          synth = nextHistory.filter((m) => m.role === "user").map((m) => m.text).join(" / ");
        }
        if (!parsed.reply) reply = "지금까지 알려주신 내용으로 검색을 시작하겠습니다.";
      }

      setMessages((prev) => [...prev, { role: "bot", text: reply, status, synth }]);

      if (status === "complete" && synth) {
        setFinalized(true);
        onFinalize(synth);
      }
    } catch (e) {
      setErr(e.message || "챗봇 응답 오류");
      setMessages((prev) => [...prev, { role: "bot", text: "⚠ 응답을 가져오지 못했습니다. 다시 시도해 주세요.", status: "incomplete" }]);
    } finally {
      setThinking(false);
    }
  }

  function handleReset() {
    setMessages([
      {
        role: "bot",
        text: "새로운 시나리오를 알려주세요. 예) \"2027년 3월에 LTV 규제가 완화되면?\"",
        status: "incomplete",
      },
    ]);
    setInput("");
    setUserTurns(0);
    setFinalized(false);
    setErr("");
    if (onReset) onReset();
  }

  const remaining = Math.max(0, CHATBOT_MAX_TURNS - userTurns);

  return (
    <div className="chatbot-wrap">
      <div className="chatbot-header">
        <span>🤖 시나리오 챗봇</span>
        <small>
          {finalized
            ? "검색 조건 확정 완료"
            : `남은 질문 횟수 ${remaining}/${CHATBOT_MAX_TURNS}`}
        </small>
      </div>
      <div className="chatbot-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-${m.role}`}>
            <div className="chat-bubble">
              {m.text.split("\n").map((line, j) => (
                <span key={j}>{line}{j < m.text.split("\n").length - 1 && <br />}</span>
              ))}
              {m.role === "bot" && m.status === "complete" && m.synth && (
                <div className="chat-synth">검색 조건: <em>"{m.synth}"</em></div>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="chat-msg chat-bot">
            <div className="chat-bubble chat-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>
      {err && <p className="sim-error" style={{ margin: "4px 8px" }}>{err}</p>}

      {finalized ? (
        <div className="chatbot-finalized">
          <span>✅ 검색 조건이 확정되었습니다. 우측 결과 패널을 확인하거나 아래 버튼으로 다시 시작하세요.</span>
          <button type="button" className="chatbot-reset-btn" onClick={handleReset}>
            🔄 새 시나리오로 다시 시작
          </button>
        </div>
      ) : (
        <div className="chatbot-input-row">
          <textarea
            className="chatbot-input"
            rows={2}
            placeholder="예) 2026년 9월에 기준금리가 0.5%p 인상되면?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={thinking}
          />
          <button
            type="button"
            className="chatbot-send-btn"
            onClick={handleSend}
            disabled={thinking || !input.trim()}
          >
            {thinking ? "..." : "보내기"}
          </button>
        </div>
      )}

      {finalizedQuery && (
        <p className="chatbot-current-query">
          📌 현재 검색 조건: <strong>{finalizedQuery}</strong>
        </p>
      )}
    </div>
  );
}

function StorytellingReport({ result, apt, targetMonths }) {
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // result가 바뀌면 자동 생성
  useEffect(() => {
    if (!result) { setStory(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(""); setStory(null);
      try {
        const messages = buildStoryPrompt(result, apt, targetMonths);
        const raw = await callDeepseek(messages, {
          responseFormat: { type: "json_object" },
          temperature: 0.6,
        });
        const parsed = tryParseJSON(raw);
        if (!parsed) throw new Error("응답 파싱 실패");
        if (!cancelled) setStory(parsed);
      } catch (e) {
        if (!cancelled) setErr(e.message || "리포트 생성 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (loading) {
    return (
      <div className="story-report story-loading">
        <div className="story-spinner" />
        <p>분석 리포트를 작성하고 있습니다…</p>
        <small>Agent가 6개 섹션의 스토리텔링을 구성 중입니다.</small>
      </div>
    );
  }

  if (err) {
    return (
      <div className="story-report story-error">
        <p>⚠ 스토리텔링 리포트 생성 오류: {err}</p>
      </div>
    );
  }

  if (!story) return null;

  const milestones = extractMilestones(result.forecast_points, result.base_price_manwon, targetMonths);
  const yearsLabel = (targetMonths / 12).toFixed(1);

  return (
    <div className="story-report">
      {/* ① 한 줄 요약 */}
      <section className="story-section story-summary">
        <h3 className="story-h">① 한 줄 요약</h3>
        <p className="story-summary-text">{story.summary}</p>
        <div className="story-summary-pills">
          <span>현재 <strong>{formatEok(result.base_price_manwon)}</strong></span>
          <span>→</span>
          <span>{yearsLabel}년 후 <strong>{formatEok(result.estimated_price_manwon)}</strong></span>
        </div>
      </section>

      {/* ② 시세 전망 */}
      <section className="story-section">
        <h3 className="story-h">② {yearsLabel}년 시세 전망</h3>
        <p className="story-sub">
          파란 선은 예상 가격(중앙값, p50)이고, 음영 영역은 예상 범위(p10 ~ p90)입니다.
        </p>
        <FiveYearFanChart
          forecast={result.forecast_points}
          basePriceManwon={result.base_price_manwon}
          p10Ret={result.return_pct_p10}
          p90Ret={result.return_pct_p90}
          targetMonths={targetMonths}
        />
        {milestones.length > 0 && (
          <table className="story-milestone-table">
            <thead>
              <tr>
                <th>시점</th>
                <th>예상 가격</th>
                <th>현재 대비</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m, i) => {
                const diff = result.base_price_manwon
                  ? ((m.price - result.base_price_manwon) / result.base_price_manwon) * 100
                  : null;
                return (
                  <tr key={i}>
                    <td><strong>{m.label}</strong></td>
                    <td>{(m.price / 10000).toFixed(2)}억</td>
                    <td className={diff > 0 ? "up-txt" : diff < 0 ? "down-txt" : ""}>
                      {diff != null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ③ 왜 이렇게 예측됐나 */}
      <section className="story-section">
        <h3 className="story-h">③ 왜 이렇게 예측됐나</h3>
        <p className="story-sub">
          가격을 움직이는 요인을 <strong>정책 · 금리 · 수급</strong> 3개 카테고리로 정리했습니다.
          현 시장에서는 정부 정책(세금/대출 규제)의 영향이 가장 큽니다.
        </p>
        <FactorImpactBars factors={story.factors} />
      </section>

      {/* ④ 상승 vs 하락 시나리오 */}
      <section className="story-section">
        <h3 className="story-h">④ 상승 vs 하락 시나리오</h3>
        <p className="story-sub">
          어떤 환경이 되면 어느 방향으로 갈 가능성이 큰지, 금리·수급·규제 3축으로 비교합니다.
        </p>
        <ScenarioCompareTable bull={story.bull} bear={story.bear} />
      </section>

      {/* ⑤ 내가 알아둘 점 */}
      <section className="story-section">
        <h3 className="story-h">⑤ 내가 알아둘 점</h3>
        <p className="story-sub">
          상황별 의사결정에 도움이 되는 체크 포인트입니다. (특정 행동을 권유하지 않습니다)
        </p>
        <PersonaActions actions={story.actions} />
      </section>

      {/* ⑥ 장기 전망 + 한계 */}
      {story.longterm && (
        <section className="story-section story-longterm">
          <h3 className="story-h">⑥ 장기 전망 + 이 예측의 한계</h3>
          <p>{story.longterm.narrative}</p>
          {story.longterm.risks?.length > 0 && (
            <>
              <h5>이 예측이 빗나갈 수 있는 대표 케이스</h5>
              <ul className="story-risk-list">
                {story.longterm.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </>
          )}
          <div className="story-disclaimer">
            ⚠ {story.longterm.disclaimer || "본 리포트는 참고용이며, 투자 판단의 단독 근거가 될 수 없습니다."}
          </div>
        </section>
      )}
    </div>
  );
}

function PhaseDistBar({ dist }) {
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const phases = ["A", "B", "C", "D", "E"];
  return (
    <div className="phase-dist-bar-wrap">
      {phases.map((p) => {
        const cnt = dist[p] || 0;
        const pct = ((cnt / total) * 100).toFixed(1);
        return (
          <div key={p} className="phase-dist-row">
            <span className={`phase-tag phase-${p}`}>{p}</span>
            <div className="phase-dist-track">
              <div
                className="phase-dist-fill"
                style={{ width: `${pct}%`, background: PHASE_COLOR[p] }}
              />
            </div>
            <span className="phase-dist-pct">{pct}%</span>
            <span className="phase-dist-ko">{PHASE_KO[p]}</span>
          </div>
        );
      })}
    </div>
  );
}

function ClusterAnalysisTab() {
  const [nClusters, setNClusters] = useState(4);
  const [targetMonths, setTargetMonths] = useState(120);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(0);
  const [selectedSid, setSelectedSid] = useState(null); // 선택된 개별 시나리오 ID

  // 아파트 필터
  const [aptGu, setAptGu] = useState("");
  const [aptDong, setAptDong] = useState("");
  const [aptComplex, setAptComplex] = useState("");
  const [aptBuilding, setAptBuilding] = useState("");
  const [aptFloor, setAptFloor] = useState("");
  const { filters, filterError } = useApartmentFilters(aptGu, aptDong, aptComplex, aptBuilding, aptFloor);

  const fetchClusters = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ n_clusters: nClusters, target_months: targetMonths });
      if (aptGu) params.set("gu", aptGu);
      if (aptDong) params.set("dong", aptDong);
      if (aptComplex) params.set("complex_name", aptComplex);
      if (aptBuilding) params.set("building", aptBuilding);
      if (aptFloor) params.set("floor", aptFloor);
      const res = await fetch(`${API_BASE}/simulation/cluster-analysis?${params}`);
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.detail || res.statusText);
      }
      const data = await res.json();
      setResult(data);
      setSelectedCluster(0);
      setSelectedSid(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const active = result?.clusters?.[selectedCluster] ?? null;
  const activePalette = CLUSTER_PALETTE[selectedCluster % CLUSTER_PALETTE.length];

  return (
    <div className="cluster-tab">
      {/* ─── Section 1: Control Panel ─────────────────────────────────── */}
      <section className="cluster-control-panel card-box">
        <h2 className="section-title">시뮬레이션 설정</h2>

        <div className="sim-indicator-head">
          <h3>서울 아파트 선택 <small style={{ fontWeight: 400, color: "#9ba3b8" }}>(선택 시 실거래가 기준 가격 보정)</small></h3>
        </div>
        <ApartmentFilter
          aptGu={aptGu} setAptGu={setAptGu}
          aptDong={aptDong} setAptDong={setAptDong}
          aptComplex={aptComplex} setAptComplex={setAptComplex}
          aptBuilding={aptBuilding} setAptBuilding={setAptBuilding}
          aptFloor={aptFloor} setAptFloor={setAptFloor}
          filters={filters} filterError={filterError}
        />

        <div className="cluster-controls-row" style={{ marginTop: 16 }}>
          <label className="ctrl-label">
            군집 수
            <select
              value={nClusters}
              onChange={(e) => setNClusters(Number(e.target.value))}
              className="ctrl-select"
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}개 군집</option>
              ))}
            </select>
          </label>
          <label className="ctrl-label">
            예측 기간
            <select
              value={targetMonths}
              onChange={(e) => setTargetMonths(Number(e.target.value))}
              className="ctrl-select"
            >
              {[12, 36, 60, 120, 240].map((m) => (
                <option key={m} value={m}>{m}개월 ({Math.round(m / 12)}년)</option>
              ))}
            </select>
          </label>
          <button
            className="primary-btn run-cluster-btn"
            onClick={fetchClusters}
            disabled={loading}
          >
            {loading ? "분석 중…" : "군집 분석 실행"}
          </button>
        </div>
        {error && <p className="error-msg">오류: {error}</p>}
      </section>

      {/* ─── Section 2: Cluster Overview Cards ────────────────────────── */}
      {result && (
        <section className="cluster-overview-section">
          <h2 className="section-title">
            군집 개요
            <span className="section-meta">
              총 {result.total_scenarios}개 시나리오 · {result.n_clusters}개 군집 · {result.target_months}개월 예측
              {result.base_price_manwon && (
                <> · 기준가 {result.base_price_manwon.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</>
              )}
            </span>
          </h2>
          {result.region_warning && (
            <div className="region-warning">
              <span className="region-warning-icon">⚠</span>
              {result.region_warning}
            </div>
          )}
          <div className="cluster-overview-grid">
            {result.clusters.map((c, i) => (
              <ClusterCard
                key={c.cluster_id}
                cluster={c}
                isActive={i === selectedCluster}
                palette={CLUSTER_PALETTE[i % CLUSTER_PALETTE.length]}
                onClick={() => { setSelectedCluster(i); setSelectedSid(null); }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── Section 3: Deep-Dive ─────────────────────────────────────── */}
      {result && active && (
        <section className="cluster-deepdive card-box">
          <h2 className="section-title">
            Deep-Dive — {active.label}
            <span
              className="cluster-badge-sm"
              style={{ background: activePalette, marginLeft: 10 }}
            >
              Cluster {active.cluster_id + 1}
            </span>
          </h2>
          <div className="deepdive-grid">
            {/* 좌: 예측 궤적 차트 */}
            <div className="deepdive-left">
              <p className="chart-caption">
                개별 시나리오 궤적 (투명선) + 클러스터 평균 (굵은 선)
              </p>
              <DeepDiveChart
                cluster={active}
                palette={activePalette}
                selectedSid={selectedSid}
                onSelectSid={(sid) => {
                  setSelectedSid(sid);
                }}
              />
            </div>

            {/* 우: Insights */}
            <div className="deepdive-right">
              <div className="insight-block">
                <div className="insight-icon">📍</div>
                <div>
                  <div className="insight-label">Dominant Phase</div>
                  <div className="insight-value">
                    <span className={`phase-badge phase-${active.dominant_phase}`}>
                      {active.dominant_phase}
                    </span>
                    {" "}
                    {PHASE_KO[active.dominant_phase] || active.dominant_phase}
                  </div>
                  <div className="insight-desc">
                    이 군집의 시나리오는 주로{" "}
                    <strong>{PHASE_KO[active.dominant_phase]}</strong> 국면을 경험합니다.
                  </div>
                </div>
              </div>

              <div className="insight-block">
                <div className="insight-icon">⚠️</div>
                <div>
                  <div className="insight-label">Policy Agent Trigger</div>
                  <div className="insight-desc">{active.policy_trigger}</div>
                </div>
              </div>

              <div className="insight-block">
                <div className="insight-icon">📊</div>
                <div>
                  <div className="insight-label">국면 분포</div>
                  <PhaseDistBar dist={active.phase_distribution} />
                </div>
              </div>

              <div className="insight-block">
                <div className="insight-icon">📈</div>
                <div>
                  <div className="insight-label">방향 분포</div>
                  <div className="dir-chips">
                    {Object.entries(active.direction_distribution || {}).map(([d, n]) => (
                      <span key={d} className={`dir-chip dir-${d}`}>
                        {DIR_KO[d] || d} {n}개
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Section 4: XAI 리포트 ────────────────────────────────────── */}
      {result && selectedSid && (
        <XAIReport
          scenarioId={selectedSid}
          runId={result.run_id}
          palette={activePalette}
        />
      )}

      {!result && !loading && (
        <div className="cluster-placeholder">
          <p>시뮬레이션 실행 버튼을 눌러 군집 분석을 시작하세요.</p>
          <p className="placeholder-note">
            Phase Table(경착륙·과열·전세불안·스태그플레이션·연착륙)을 기반으로<br />
            Diffusion 시나리오를 K-means 군집화합니다.
          </p>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Admin: 검증 유틸 헬퍼
// ===========================================================================

/**
 * MetricCard
 * tooltip = { text: string, best: string }
 *   text: 지표 설명
 *   best: 어떤 값이 좋은지 (e.g. "낮을수록 좋음", "100%에 가까울수록 좋음")
 */
function MetricCard({ label, value, sub, grade, tooltip }) {
  return (
    <div className={`admin-metric-card${grade ? ' metric-' + grade : ''}${tooltip ? ' has-tooltip' : ''}`}>
      {tooltip && (
        <div className="metric-tooltip-bubble">
          <p className="metric-tooltip-text">{tooltip.text}</p>
          {tooltip.best && <p className="metric-tooltip-best">✦ {tooltip.best}</p>}
        </div>
      )}
      <p className="admin-metric-label">{label}</p>
      <p className="admin-metric-value">{value ?? '-'}</p>
      {sub && <p className="admin-metric-sub">{sub}</p>}
    </div>
  );
}

function AdminSectionTitle({ children }) {
  return <h3 className="admin-section-title">{children}</h3>;
}

function trendLabel(t) {
  if (t === 'bull') return '강세 (Bull)';
  if (t === 'bear') return '약세 (Bear)';
  return '중립 (Neutral)';
}
function trendGrade(t) {
  if (!t) return undefined;
  return t === 'neutral' ? 'warn' : (t === 'bull' ? 'good' : 'bad');
}
function gapGrade(gap) {
  if (gap == null) return undefined;
  const abs = Math.abs(gap);
  return abs < 5 ? 'good' : (abs < 15 ? 'warn' : 'bad');
}
function fmtPct(v, digits = 1) {
  if (v == null) return '-';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}
function fmtNum(v, digits = 0) {
  if (v == null) return '-';
  return Number(v).toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

// ===========================================================================
// Admin Sub-page: VAR 모델 백테스트 검증
// ===========================================================================

// VAR 지표 메타 정의 (label, description, best)
const VAR_METRIC_META = {
  central_mae: {
    label: 'Central MAE',
    best: '낮을수록 좋음',
    text: 'Central(중앙) 시나리오의 평균 절대 오차. 예측값과 실제값 차이의 평균.',
  },
  central_rmse: {
    label: 'Central RMSE',
    best: '낮을수록 좋음',
    text: 'Central 시나리오의 평균 제곱근 오차. 큰 오차에 더 민감하게 반응.',
  },
  central_mape: {
    label: 'Central MAPE',
    best: '낮을수록 좋음 (0%에 가까울수록)',
    text: 'Central 시나리오의 평균 절대 백분율 오차. 오차를 실제값 대비 비율(%)로 표현.',
  },
  central_direction_accuracy: {
    label: '방향 정확도 (Central)',
    best: '높을수록 좋음 (100%에 가까울수록)',
    text: 'Central 시나리오가 실제 가격의 상승/하락 방향을 맞춘 비율. 직전 실제값 대비 방향 일치.',
  },
  scenario_range_coverage: {
    label: '범위 포괄율',
    best: '높을수록 좋음 (100%에 가까울수록)',
    text: '실제값이 3개 시나리오(Central/Upper/Lower)로 구성된 범위 안에 포함된 비율. 시나리오 범위의 유효성 측정.',
  },
  upper_breach_rate: {
    label: '상단 이탈율',
    best: '낮을수록 좋음 (0%에 가까울수록)',
    text: '실제값이 Upper 시나리오를 초과한 비율. 모델이 상방 리스크를 과소평가한 정도.',
  },
  lower_breach_rate: {
    label: '하단 이탈율',
    best: '낮을수록 좋음 (0%에 가까울수록)',
    text: '실제값이 Lower 시나리오보다 낮은 비율. 모델이 하방 리스크를 과소평가한 정도.',
  },
  scenario_width: {
    label: '평균 시나리오 폭',
    best: '분석 목적에 따라 다름',
    text: '분석 기간 동안 Upper-Lower 시나리오 폭의 평균. 너무 좁으면 리스크 과소평가, 너무 넓으면 정보가 적음.',
  },
  scenario_direction_hit_rate: {
    label: '시나리오 방향 적중률',
    best: '높을수록 좋음 (100%에 가까울수록)',
    text: '3개 시나리오 중 하나 이상이 실제 가격 방향(상승/하락)을 맞춘 비율. 시나리오 다양성의 유효성.',
  },
  scenario_ordering_check: {
    label: '경로 정합성 (종합)',
    best: '높을수록 좋음 (100%에 가까울수록)',
    text: '아래 4가지 ordering 항목의 평균. Central이 범위 안 + 의도된 방향성(Upper≥Central≥Lower) + 시나리오 수렴 회피 + 과도한 이탈 회피.',
  },
  ordering_central_inside_rate: {
    label: '① Central 범위 내 위치율',
    best: '100%에 가까울수록 좋음',
    text: 'Central 시나리오가 Upper와 Lower 사이에 위치한 시점 비율. 100%이면 세 경로의 순서가 항상 올바름.',
  },
  ordering_directional_rate: {
    label: '② 방향 일관성률',
    best: '100%에 가까울수록 좋음',
    text: 'Upper(var_00000) ≥ Central ≥ Lower(var_00002) 의 의도된 방향성이 유지되는 시점 비율.',
  },
  ordering_distinct_rate: {
    label: '③ 시나리오 분리율',
    best: '높을수록 좋음 (≥80%)',
    text: '세 시나리오 폭이 |Central|의 0.5% 이상으로 의미 있게 분리된 시점 비율. 시나리오가 한 점으로 수렴하지 않는지 확인.',
  },
  ordering_no_outlier_rate: {
    label: '④ 비-과이탈률',
    best: '높을수록 좋음 (≥80%)',
    text: 'Upper/Lower 어느 것도 Central 대비 ±25%를 넘지 않은 시점 비율. 특정 경로의 비현실적 이탈을 방지.',
  },
  realism_score: {
    label: '경제적 현실성 점수',
    best: '100점에 가까울수록 좋음',
    text: '음수가격·급등락·과이탈 3가지 위반율의 평균을 100에서 차감한 점수. 시나리오가 경제적으로 현실적인지 평가.',
  },
  realism_negative_rate: {
    label: '음수 가격 발생률',
    best: '0%여야 함',
    text: '3시나리오 중 가격이 0 이하로 떨어진 시점 비율. 가격은 양수여야 하므로 0%가 정상.',
  },
  realism_extreme_change_rate: {
    label: '단기 급등락률',
    best: '낮을수록 좋음 (보통 <5%)',
    text: 'Central 시나리오에서 월간 변화율이 10%를 초과한 시점 비율. 가격이 단기간 비현실적으로 출렁이는지 검출.',
  },
  realism_far_from_last_rate: {
    label: '극단 이탈률 (±50%)',
    best: '0%에 가까울수록 좋음',
    text: '3시나리오 중 어느 하나라도 마지막 실제값 대비 ±50%를 넘은 시점 비율. 시나리오가 비현실적으로 멀리 벗어났는지 확인.',
  },
  naive_mae: {
    label: 'Naive MAE (기준선)',
    best: '낮을수록 좋음',
    text: 'Naive 모델(마지막 실제값으로 고정 예측)의 평균 절대 오차. 이보다 Central MAE가 낮아야 VAR가 의미 있음.',
  },
  naive_mape: {
    label: 'Naive MAPE (기준선)',
    best: '낮을수록 좋음',
    text: 'Naive 모델의 평균 절대 백분율 오차. VAR 모델의 성능 비교 기준.',
  },
  naive_improvement_rate: {
    label: 'Naive 대비 개선율',
    best: '양수일수록 좋음 (Naive 대비 개선)',
    text: '(Naive MAE - Central MAE) / Naive MAE. 양수이면 VAR가 단순 기준선보다 우수함. 음수이면 Naive보다 못함.',
  },
  naive_range_coverage: {
    label: 'Naive Band 포괄율',
    best: '낮을수록 VAR 우위 (보통 매우 낮음)',
    text: 'Naive(마지막 실제값 ±1% band)가 실제값을 포함한 비율. VAR 시나리오 범위 포괄율(2.5)과 직접 비교용 기준선.',
  },
  coverage_vs_naive_diff: {
    label: '포괄율 Naive 대비 (%p)',
    best: '클수록 좋음 (VAR가 실제를 더 잘 포괄)',
    text: 'VAR 시나리오 범위 포괄율 - Naive Band 포괄율 (%p). 양수이면 VAR 시나리오가 단순 기준선보다 미래 불확실성을 더 잘 포착함.',
  },
};

function gradeForMetric(key, value) {
  if (value == null) return undefined;
  const v = Number(value);
  switch (key) {
    case 'central_mae': case 'central_rmse': case 'naive_mae':
      return undefined; // 절대값이라 단독 grade 불가
    case 'central_mape': case 'naive_mape':
      return v < 3 ? 'good' : v < 10 ? 'warn' : 'bad';
    case 'central_direction_accuracy': case 'scenario_direction_hit_rate':
      return v >= 70 ? 'good' : v >= 50 ? 'warn' : 'bad';
    case 'scenario_range_coverage': case 'scenario_ordering_check':
      return v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad';
    case 'ordering_central_inside_rate': case 'ordering_directional_rate':
      return v >= 95 ? 'good' : v >= 75 ? 'warn' : 'bad';
    case 'ordering_distinct_rate': case 'ordering_no_outlier_rate':
      return v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad';
    case 'realism_score':
      return v >= 90 ? 'good' : v >= 70 ? 'warn' : 'bad';
    case 'realism_negative_rate':
      return v === 0 ? 'good' : v <= 5 ? 'warn' : 'bad';
    case 'realism_extreme_change_rate': case 'realism_far_from_last_rate':
      return v <= 5 ? 'good' : v <= 15 ? 'warn' : 'bad';
    case 'upper_breach_rate': case 'lower_breach_rate':
      return v < 10 ? 'good' : v < 25 ? 'warn' : 'bad';
    case 'naive_improvement_rate': case 'coverage_vs_naive_diff':
      return v > 10 ? 'good' : v > 0 ? 'warn' : 'bad';
    case 'naive_range_coverage':
      return undefined; // 비교용 기준선이라 단독 등급 없음
    default: return undefined;
  }
}

function VARValidationTab() {
  // 지역 필터
  const [si, setSi] = useState('서울특별시');
  const [gu, setGu] = useState('강남구');
  const [dong, setDong] = useState('개포동');

  // 날짜 목록 (var-dates API)
  const [dates, setDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(false);

  // 선택된 기간 (Diffusion 방식과 동일한 4개 구분)
  const [trainStart, setTrainStart] = useState('');
  const [trainEnd, setTrainEnd] = useState('');
  const [testStart, setTestStart] = useState('');   // trainEnd 다음 달 자동 연동
  const [testEnd, setTestEnd] = useState('');

  // 검증 결과
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function nextMonth(yyyymm) {
    if (!yyyymm || yyyymm.length < 7) return '';
    const [y, m] = yyyymm.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return '';
    const dt = new Date(y, m, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }

  // 날짜 목록 로드
  function loadDates() {
    if (!dong.trim()) return;
    setDatesLoading(true);
    setDates([]); setTrainStart(''); setTrainEnd(''); setTestStart(''); setTestEnd(''); setResult(null); setError(null);
    fetch(`${API_BASE}/admin/validate/var-dates?si=${encodeURIComponent(si)}&gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        const list = d.dates || [];
        setDates(list);
        if (list.length >= 2) {
          const splitIdx = Math.max(0, Math.floor(list.length * 0.7) - 1);
          const tEnd = list[splitIdx];
          setTrainStart(list[0]);
          setTrainEnd(tEnd);
          setTestStart(nextMonth(tEnd));
          setTestEnd(list[list.length - 1]);
        }
      })
      .catch((e) => setError('날짜 로드 실패: ' + e.message))
      .finally(() => setDatesLoading(false));
  }

  // trainEnd 변경 시 testStart 자동 연동
  useEffect(() => {
    if (!trainEnd || dates.length === 0) return;
    const expected = nextMonth(trainEnd);
    setTestStart(expected);
    if (!testEnd || testEnd <= trainEnd) {
      const afterTrain = dates.filter((d) => d > trainEnd);
      if (afterTrain.length > 0) setTestEnd(afterTrain[afterTrain.length - 1]);
    }
  }, [trainEnd, dates]);

  // 검증 실행
  function runBacktest() {
    if (!trainEnd || !testEnd) return;
    setLoading(true); setError(null); setResult(null);
    const url = `${API_BASE}/admin/validate/var-backtest?si=${encodeURIComponent(si)}&gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&train_end=${trainEnd}&test_end=${testEnd}`;
    fetch(url)
      .then((r) => { if (!r.ok) return r.json().then((e) => { throw new Error(e.detail || `HTTP ${r.status}`); }); return r.json(); })
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  const m = result?.metrics || {};
  const COLORS = { var_0: '#2255cc', var_1: '#e67e22', var_2: '#27ae60', actual: '#0a1628', naive: '#aaa', range_max: 'rgba(34,85,204,0.15)', range_min: 'rgba(34,85,204,0.15)' };

  return (
    <div className="admin-tab-body">
      {/* ── 지역 필터 ─────────────────────────────────────────────────────── */}
      <div className="admin-filter-row">
        <div className="admin-filter-field">
          <label>시</label>
          <input value={si} onChange={(e) => setSi(e.target.value)} placeholder="서울특별시" />
        </div>
        <div className="admin-filter-field">
          <label>구</label>
          <input value={gu} onChange={(e) => setGu(e.target.value)} placeholder="강남구" />
        </div>
        <div className="admin-filter-field">
          <label>동</label>
          <input value={dong} onChange={(e) => setDong(e.target.value)} placeholder="개포동" />
        </div>
        <button className="admin-run-btn" onClick={loadDates} disabled={datesLoading || !dong.trim()}>
          {datesLoading ? '조회 중…' : '기간 조회'}
        </button>
      </div>

      {/* ── 기간 선택 (Diffusion 방식 동일: 4개 드롭다운) ──────────────────── */}
      {dates.length > 0 && (
        <div className="admin-filter-row" style={{ marginTop: 8 }}>
          <div className="admin-filter-field">
            <label>학습 시작</label>
            <select value={trainStart} onChange={(e) => setTrainStart(e.target.value)} disabled={datesLoading}>
              {dates.filter((d) => !trainEnd || d <= trainEnd).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="admin-filter-field">
            <label>학습 종료</label>
            <select value={trainEnd} onChange={(e) => setTrainEnd(e.target.value)} disabled={datesLoading}>
              {dates.filter((d) => (!trainStart || d >= trainStart) && d < (testEnd || dates[dates.length - 1])).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="admin-filter-field">
            <label>테스트 시작 <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>(자동)</span></label>
            <select value={testStart} disabled style={{ opacity: 0.6 }}>
              <option value={testStart}>{testStart || '-'}</option>
            </select>
          </div>
          <div className="admin-filter-field">
            <label>테스트 종료</label>
            <select value={testEnd} onChange={(e) => setTestEnd(e.target.value)} disabled={datesLoading}>
              {dates.filter((d) => d > trainEnd).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button
            className="admin-run-btn primary"
            onClick={runBacktest}
            disabled={loading || datesLoading || !trainEnd || !testEnd || trainEnd >= testEnd}
          >
            {loading ? '검증 중…' : '검증 실행'}
          </button>
        </div>
      )}

      {error && <p className="admin-error" style={{ margin: '12px 0' }}>{error}</p>}
      {loading && <p className="admin-placeholder">VAR 모델 학습 및 예측 중… (수 초 소요)</p>}

      {/* ── 결과 ─────────────────────────────────────────────────────────── */}
      {result && (
        <>
          <div className="admin-info-row" style={{ marginTop: 16 }}>
            <span><strong>지역:</strong> {result.si} {result.gu} {result.dong}</span>
            <span><strong>학습:</strong> {result.train_period} ({result.n_train}개월)</span>
            <span><strong>테스트:</strong> {result.test_period} ({result.n_test}개월)</span>
            <span><strong>VAR 시차:</strong> p={result.lag_order}, 특징 {result.n_features}개</span>
            <span><strong>마지막 실제:</strong> {fmtNum(result.last_known_actual)}</span>
          </div>

          <div className="admin-results">
            {/* ① Central 예측 성능 */}
            <AdminSectionTitle>① Central 시나리오 예측 성능</AdminSectionTitle>
            <div className="admin-metric-grid">
              {['central_mae','central_rmse','central_mape','central_direction_accuracy'].map((key) => {
                const meta = VAR_METRIC_META[key];
                const val = m[key];
                const isAbs = key === 'central_mae' || key === 'central_rmse';
                return (
                  <MetricCard
                    key={key}
                    label={meta.label}
                    value={isAbs ? fmtNum(val, 0) : (val != null ? `${val.toFixed(1)}%` : '-')}
                    grade={gradeForMetric(key, val)}
                    tooltip={{ text: meta.text, best: meta.best }}
                  />
                );
              })}
            </div>

            {/* ② 시나리오 범위 및 포괄성 */}
            <AdminSectionTitle>② 시나리오 범위 및 포괄성</AdminSectionTitle>
            <div className="admin-metric-grid">
              {['scenario_range_coverage','upper_breach_rate','lower_breach_rate','scenario_width'].map((key) => {
                const meta = VAR_METRIC_META[key];
                const val = m[key];
                const isAbs = key === 'scenario_width';
                return (
                  <MetricCard
                    key={key}
                    label={meta.label}
                    value={isAbs ? fmtNum(val, 0) : (val != null ? `${val.toFixed(1)}%` : '-')}
                    grade={gradeForMetric(key, val)}
                    tooltip={{ text: meta.text, best: meta.best }}
                  />
                );
              })}
            </div>

            {/* ③ 시나리오 보완성 및 정합성 (Ordering 4종) */}
            <AdminSectionTitle>③ 시나리오 보완성 및 경로 정합성</AdminSectionTitle>
            <div className="admin-metric-grid">
              {[
                'scenario_direction_hit_rate',
                'scenario_ordering_check',
                'ordering_central_inside_rate',
                'ordering_directional_rate',
                'ordering_distinct_rate',
                'ordering_no_outlier_rate',
              ].map((key) => {
                const meta = VAR_METRIC_META[key];
                const val = m[key];
                return (
                  <MetricCard
                    key={key}
                    label={meta.label}
                    value={val != null ? `${val.toFixed(1)}%` : '-'}
                    grade={gradeForMetric(key, val)}
                    tooltip={{ text: meta.text, best: meta.best }}
                  />
                );
              })}
            </div>

            {/* ④ 경제적 현실성 */}
            <AdminSectionTitle>④ 경제적 현실성 (Realism Check)</AdminSectionTitle>
            <div className="admin-metric-grid">
              {['realism_score','realism_negative_rate','realism_extreme_change_rate','realism_far_from_last_rate'].map((key) => {
                const meta = VAR_METRIC_META[key];
                const val = m[key];
                return (
                  <MetricCard
                    key={key}
                    label={meta.label}
                    value={val != null ? `${val.toFixed(1)}${key === 'realism_score' ? '점' : '%'}` : '-'}
                    grade={gradeForMetric(key, val)}
                    tooltip={{ text: meta.text, best: meta.best }}
                  />
                );
              })}
            </div>

            {/* ⑤ Naive 대비 */}
            <AdminSectionTitle>⑤ Naive 기준선 대비 비교</AdminSectionTitle>
            <div className="admin-metric-grid">
              {['naive_mae','naive_mape','naive_improvement_rate','naive_range_coverage','coverage_vs_naive_diff'].map((key) => {
                const meta = VAR_METRIC_META[key];
                const val = m[key];
                const isAbs = key === 'naive_mae';
                const isPP = key === 'coverage_vs_naive_diff';
                return (
                  <MetricCard
                    key={key}
                    label={meta.label}
                    value={
                      isAbs
                        ? fmtNum(val, 0)
                        : (val != null
                            ? `${val >= 0 && isPP ? '+' : ''}${val.toFixed(1)}${isPP ? '%p' : '%'}`
                            : '-')
                    }
                    grade={gradeForMetric(key, val)}
                    tooltip={{ text: meta.text, best: meta.best }}
                  />
                );
              })}
            </div>

            {/* ⑥ 차트 */}
            <AdminSectionTitle>⑥ 예측 궤적 (학습 24개월 + 테스트 구간)</AdminSectionTitle>
            <div className="admin-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={result.chart_data} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => Math.round(v).toLocaleString()} />
                  <Tooltip formatter={(v, n) => [v != null ? fmtNum(v) : '-', n]} />
                  <Legend />
                  <Area type="monotone" dataKey="range_max" name="범위 상단" fill="rgba(34,85,204,0.1)" stroke="none" dot={false} connectNulls legendType="none" />
                  <Area type="monotone" dataKey="range_min" name="범위 하단" fill="#fff" stroke="none" dot={false} connectNulls legendType="none" />
                  <Line dataKey="actual" name="실제" stroke={COLORS.actual} strokeWidth={2.5} dot={false} connectNulls />
                  <Line dataKey="naive" name="Naive(기준선)" stroke={COLORS.naive} strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                  <Line dataKey="var_0" name="Central" stroke={COLORS.var_0} strokeWidth={2} dot={false} connectNulls />
                  <Line dataKey="var_1" name="Upper (80% CI)" stroke={COLORS.var_1} strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
                  <Line dataKey="var_2" name="Lower (80% CI)" stroke={COLORS.var_2} strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {!result && !loading && !error && dates.length === 0 && (
        <p className="admin-placeholder">지역을 입력하고 '기간 조회'를 클릭하세요.</p>
      )}
    </div>
  );
}

// ===========================================================================
// Admin Sub-page: Diffusion 모델 검증 (백테스트 방식)
// ===========================================================================

const DIFFUSION_METRIC_META = {
  range_coverage:              { label: '전체 포괄율',        unit: '%',    tooltip: { text: '실제값이 100개 시나리오의 최소~최대 범위 안에 포함된 비율', best: '높을수록 좋음' } },
  p10_p90_coverage:            { label: 'P10~P90 포괄율',     unit: '%',    tooltip: { text: '실제값이 80% 신뢰구간(P10~P90) 안에 포함된 비율. 이상적 수준은 80%', best: '80%에 가까울수록 좋음' } },
  p25_p75_coverage:            { label: 'P25~P75 포괄율',     unit: '%',    tooltip: { text: '실제값이 50% 신뢰구간(P25~P75) 안에 포함된 비율. 이상적 수준은 50%', best: '50%에 가까울수록 좋음' } },
  lower_breach_rate:           { label: 'P10 하단 이탈율',    unit: '%',    tooltip: { text: '실제값이 P10보다 낮은 비율. 높을수록 모델이 하방 리스크를 과소평가함', best: '낮을수록 좋음' } },
  upper_breach_rate:           { label: 'P90 상단 이탈율',    unit: '%',    tooltip: { text: '실제값이 P90보다 높은 비율. 높을수록 모델이 상방 리스크를 과소평가함', best: '낮을수록 좋음' } },
  min_max_breach_rate:         { label: '완전 이탈율',        unit: '%',    tooltip: { text: '실제값이 100개 시나리오 전체 범위(Min~Max) 밖으로 벗어난 비율', best: '0%에 가까울수록 좋음' } },
  full_range_width:            { label: '전체 폭 평균',       unit: '',     tooltip: { text: '100개 시나리오의 최대-최소 평균 폭. 모델이 인식하는 전체 불확실성 크기', best: '목적에 따라 다름' } },
  p10_p90_width:               { label: 'P10~P90 폭',        unit: '',     tooltip: { text: '80% 신뢰구간의 평균 폭. 핵심 불확실성 범위의 크기', best: '목적에 따라 다름' } },
  p25_p75_width:               { label: 'P25~P75 폭(IQR)',   unit: '',     tooltip: { text: '중앙 50% 시나리오의 평균 폭. 좁을수록 예측이 집중됨', best: '좁을수록 예측이 집중됨' } },
  scenario_diversity:          { label: '시나리오 다양성',    unit: '',     tooltip: { text: '각 시점의 100개 시나리오 표준편차 평균. 시나리오가 얼마나 다양하게 퍼져있는지 측정', best: '너무 낮으면 과적합 위험' } },
  actual_rank_percentile:      { label: '실제값 분위 순위',   unit: '%',    tooltip: { text: '각 시점에서 실제값이 100개 시나리오 분포 내 차지하는 백분위 평균. 50%가 완벽한 보정', best: '50%에 가까울수록 잘 보정됨' } },
  naive_p10_p90_coverage_diff: { label: 'Naive 대비 개선폭', unit: '%p',   tooltip: { text: 'Diffusion P10~P90 포괄율에서 Naive 모델(마지막 값 ±1%) 포괄율을 뺀 값. 양수이면 Diffusion이 더 유용', best: '양수일수록 좋음' } },
  p50_mae:                     { label: 'P50 MAE',            unit: '',     tooltip: { text: 'P50(중앙값) 시나리오의 평균 절대 오차. 중앙 예측의 정확도', best: '낮을수록 좋음' } },
  p50_mape:                    { label: 'P50 MAPE',           unit: '%',    tooltip: { text: 'P50 시나리오의 평균 절대 백분율 오차', best: '낮을수록 좋음' } },
  p50_direction_accuracy:      { label: 'P50 방향 정확도',    unit: '%',    tooltip: { text: 'P50이 실제 가격의 상승/하락 방향을 맞춘 비율. 50% 이하면 랜덤과 동일', best: '높을수록 좋음' } },
  // ── 2.6 Diversity 추가
  final_p90_p10_spread:        { label: '최종 P90-P10 스프레드', unit: '', tooltip: { text: '예측 마지막 시점의 80% 신뢰구간 폭. 장기 불확실성 크기', best: '목적·기간에 따라 다름' } },
  final_scenario_std:          { label: '최종 시점 시나리오 표준편차', unit: '', tooltip: { text: '마지막 시점에서 100개 시나리오가 얼마나 흩어져 있는지', best: '너무 작으면 다양성 부족, 너무 크면 신뢰 저하' } },
  bull_count:                  { label: 'Bull 시나리오 수',    unit: '개',   tooltip: { text: '최종값이 anchor 대비 +2% 초과로 상승한 시나리오 수', best: 'Bull/Neutral/Bear 균형 분포가 이상적' } },
  neutral_count:               { label: 'Neutral 시나리오 수', unit: '개',   tooltip: { text: '최종값이 anchor ±2% 이내인 시나리오 수', best: 'Bull/Neutral/Bear 균형 분포가 이상적' } },
  bear_count:                  { label: 'Bear 시나리오 수',    unit: '개',   tooltip: { text: '최종값이 anchor 대비 -2% 초과로 하락한 시나리오 수', best: 'Bull/Neutral/Bear 균형 분포가 이상적' } },
  bull_mean_return_pct:        { label: 'Bull 평균 수익률',    unit: '%',    tooltip: { text: 'Bull 그룹의 평균 최종 수익률', best: '양의 값이며 Neutral보다 높을수록 그룹 일관성 우수' } },
  neutral_mean_return_pct:     { label: 'Neutral 평균 수익률', unit: '%',    tooltip: { text: 'Neutral 그룹의 평균 최종 수익률', best: '0%에 가까울수록 좋음' } },
  bear_mean_return_pct:        { label: 'Bear 평균 수익률',    unit: '%',    tooltip: { text: 'Bear 그룹의 평균 최종 수익률', best: '음의 값이며 Neutral보다 낮을수록 그룹 일관성 우수' } },
  // ── 2.7 Realism Check
  realism_score:               { label: '현실성 점수',          unit: '점',   tooltip: { text: '음수값·급변동·과도이탈 위반율을 종합한 0~100 점수', best: '100점에 가까울수록 좋음' } },
  realism_negative_rate:       { label: '음수값 비율',          unit: '%',    tooltip: { text: '시나리오 셀(시점×시나리오) 중 가격이 0 이하인 비율', best: '0%' } },
  realism_extreme_change_rate: { label: '월변동 >10% 시나리오', unit: '%',    tooltip: { text: '한 시점에서라도 월 변화율이 10%를 초과한 시나리오 비율', best: '낮을수록 좋음 (10% 이하 권장)' } },
  realism_far_from_last_rate:  { label: 'Anchor ±50% 초과',    unit: '%',    tooltip: { text: '시나리오 중 한 시점이라도 마지막 실측값 대비 ±50%를 초과한 비율', best: '낮을수록 좋음 (장기 horizon은 일부 허용)' } },
  realism_direction_consistency: { label: '방향성 일관성',      unit: '점',   tooltip: { text: 'Bull > Neutral > Bear 평균 수익률 순서가 충족되면 100, 아니면 0', best: '100점' } },
  // ── 2.8 Naive 비교 추가
  naive_range_coverage:        { label: 'Naive 밴드 포괄율',   unit: '%',    tooltip: { text: '실제값이 마지막값 ±1% 밴드 안에 포함된 비율 (단순 기준선)', best: '낮을수록 Diffusion 우위 확보 여지' } },
  naive_mae:                   { label: 'Naive MAE',           unit: '', tooltip: { text: '마지막 실측값을 그대로 예측한 Naive 모델의 평균 절대 오차', best: '낮을수록 좋음' } },
  naive_mape:                  { label: 'Naive MAPE',          unit: '%',    tooltip: { text: 'Naive 모델의 평균 절대 백분율 오차', best: '낮을수록 좋음' } },
  naive_improvement_rate:      { label: 'P50 vs Naive 개선율', unit: '%',    tooltip: { text: '(Naive MAE - P50 MAE) / Naive MAE × 100. 양수이면 Diffusion P50이 Naive보다 정확', best: '양수이며 클수록 좋음' } },
  coverage_vs_naive_diff:      { label: '전체 포괄율 vs Naive', unit: '%p',  tooltip: { text: 'Diffusion 전체 포괄율 - Naive 포괄율. 양수이면 Diffusion이 더 넓고 유의미한 미래 가능성을 포착', best: '양수일수록 좋음' } },
};

function gradeForDiffusionMetric(key, value) {
  if (value == null) return undefined;
  const v = parseFloat(value);
  if (isNaN(v)) return undefined;
  switch (key) {
    case 'range_coverage':              return v >= 90 ? 'good' : v >= 70 ? 'warn' : 'bad';
    case 'p10_p90_coverage':            return Math.abs(v - 80) <= 10 ? 'good' : Math.abs(v - 80) <= 20 ? 'warn' : 'bad';
    case 'p25_p75_coverage':            return Math.abs(v - 50) <= 10 ? 'good' : Math.abs(v - 50) <= 20 ? 'warn' : 'bad';
    case 'lower_breach_rate':
    case 'upper_breach_rate':           return v <= 10 ? 'good' : v <= 20 ? 'warn' : 'bad';
    case 'min_max_breach_rate':         return v === 0 ? 'good' : v <= 5 ? 'warn' : 'bad';
    case 'actual_rank_percentile':      return Math.abs(v - 50) <= 15 ? 'good' : Math.abs(v - 50) <= 30 ? 'warn' : 'bad';
    case 'naive_p10_p90_coverage_diff': return v > 10 ? 'good' : v >= 0 ? 'warn' : 'bad';
    case 'p50_mape':                    return v <= 3 ? 'good' : v <= 7 ? 'warn' : 'bad';
    case 'p50_direction_accuracy':      return v >= 60 ? 'good' : v >= 50 ? 'warn' : 'bad';
    case 'realism_score':               return v >= 90 ? 'good' : v >= 70 ? 'warn' : 'bad';
    case 'realism_negative_rate':       return v === 0 ? 'good' : v <= 1 ? 'warn' : 'bad';
    case 'realism_extreme_change_rate': return v <= 5 ? 'good' : v <= 20 ? 'warn' : 'bad';
    case 'realism_far_from_last_rate':  return v <= 5 ? 'good' : v <= 25 ? 'warn' : 'bad';
    case 'realism_direction_consistency': return v >= 100 ? 'good' : 'bad';
    case 'naive_improvement_rate':      return v > 10 ? 'good' : v >= 0 ? 'warn' : 'bad';
    case 'coverage_vs_naive_diff':      return v > 10 ? 'good' : v >= 0 ? 'warn' : 'bad';
    default:                            return undefined;
  }
}

function DiffusionValidationTab() {
  const [si, setSi] = useState('서울특별시');
  const [gu, setGu] = useState('강남구');
  const [dong, setDong] = useState('개포동');
  const [dates, setDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [analysisStart, setAnalysisStart] = useState('');
  const [analysisEnd, setAnalysisEnd] = useState('');
  const [generationStart, setGenerationStart] = useState('');
  const [generationEnd, setGenerationEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function nextMonth(yyyymm) {
    if (!yyyymm || yyyymm.length < 7) return '';
    const [y, m] = yyyymm.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return '';
    const dt = new Date(y, m, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }

  function loadDates() {
    if (!si.trim() || !gu.trim() || !dong.trim()) return;
    setDatesLoading(true);
    setError(null);
    setResult(null);
    setDates([]);
    fetch(`${API_BASE}/admin/validate/diffusion-periods?si=${encodeURIComponent(si)}&gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}`)
      .then((r) => { if (!r.ok) return r.json().then((e) => { throw new Error(e.detail || `HTTP ${r.status}`); }); return r.json(); })
      .then((data) => {
        const d = data?.dates || [];
        const rec = data?.recommended || {};
        setDates(d);
        const aStart = rec.analysis_start || d[0] || '';
        const aEnd = rec.analysis_end || d[Math.max(0, d.length - 2)] || '';
        const gStart = rec.generation_start || nextMonth(aEnd) || d[d.length - 1] || '';
        const gEnd = rec.generation_end || d[d.length - 1] || '';
        setAnalysisStart(aStart);
        setAnalysisEnd(aEnd);
        setGenerationStart(gStart);
        setGenerationEnd(gEnd);
      })
      .catch((e) => setError(e.message))
      .finally(() => setDatesLoading(false));
  }

  useEffect(() => {
    if (!analysisEnd || dates.length === 0) return;
    const expected = nextMonth(analysisEnd);
    if (expected && dates.includes(expected)) {
      setGenerationStart(expected);
      if (!generationEnd || generationEnd < expected) {
        setGenerationEnd(expected);
      }
    }
  }, [analysisEnd, dates]);

  function runValidation() {
    if (!si.trim() || !gu.trim() || !dong.trim() || !analysisStart || !analysisEnd || !generationStart || !generationEnd) return;
    setLoading(true); setError(null); setResult(null);
    const params = new URLSearchParams({
      si,
      gu,
      dong,
      analysis_start: analysisStart,
      analysis_end: analysisEnd,
      generation_start: generationStart,
      generation_end: generationEnd,
    });
    fetch(`${API_BASE}/admin/validate/diffusion?${params.toString()}`)
      .then((r) => { if (!r.ok) return r.json().then((e) => { throw new Error(e.detail || `HTTP ${r.status}`); }); return r.json(); })
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  const m = result?.metrics || {};
  function diffCard(key) {
    const meta = DIFFUSION_METRIC_META[key] || {};
    const raw = m[key];
    const val = raw != null ? `${raw}${meta.unit || ''}` : '-';
    return (
      <MetricCard
        key={key}
        label={meta.label || key}
        value={val}
        grade={gradeForDiffusionMetric(key, raw)}
        tooltip={meta.tooltip}
      />
    );
  }

  return (
    <div className="admin-tab-body">
      <div className="admin-filter-row">
        <div className="admin-filter-field">
          <label>시</label>
          <input value={si} onChange={(e) => setSi(e.target.value)} placeholder="서울특별시" />
        </div>
        <div className="admin-filter-field">
          <label>구</label>
          <input value={gu} onChange={(e) => setGu(e.target.value)} placeholder="강남구" />
        </div>
        <div className="admin-filter-field">
          <label>동</label>
          <input value={dong} onChange={(e) => setDong(e.target.value)} placeholder="개포동" />
        </div>
        <button className="admin-run-btn" onClick={loadDates} disabled={datesLoading || !dong.trim()}>
          {datesLoading ? '조회 중…' : '기간 조회'}
        </button>
      </div>

      {dates.length > 0 && (
        <div className="admin-filter-row" style={{ marginTop: 8 }}>
          <div className="admin-filter-field">
            <label>분석 시작</label>
            <select value={analysisStart} onChange={(e) => setAnalysisStart(e.target.value)} disabled={datesLoading || dates.length === 0}>
              {dates.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="admin-filter-field">
            <label>분석 종료</label>
            <select value={analysisEnd} onChange={(e) => setAnalysisEnd(e.target.value)} disabled={datesLoading || dates.length === 0}>
              {dates.filter((d) => !analysisStart || d >= analysisStart).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="admin-filter-field">
            <label>생성/평가 시작</label>
            <select value={generationStart} onChange={(e) => setGenerationStart(e.target.value)} disabled={datesLoading || dates.length === 0}>
              {dates.filter((d) => !analysisEnd || d > analysisEnd).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="admin-filter-field">
            <label>생성/평가 종료</label>
            <select value={generationEnd} onChange={(e) => setGenerationEnd(e.target.value)} disabled={datesLoading || dates.length === 0}>
              {dates.filter((d) => (!generationStart || d >= generationStart) && (!analysisEnd || d > analysisEnd)).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button
            className="admin-run-btn primary"
            onClick={runValidation}
            disabled={loading || datesLoading || !generationStart || !generationEnd || generationStart > generationEnd || !analysisEnd || generationStart <= analysisEnd}
          >
            {loading ? '검증 중…' : '검증 실행'}
          </button>
        </div>
      )}

      {error && <p className="admin-error">{error}</p>}
      {loading && <p className="admin-placeholder">Diffusion 시나리오 검증 중…</p>}
      {!result && !loading && !error && dates.length === 0 && (
        <p className="admin-placeholder">지역을 입력하고 '기간 조회'를 클릭하세요.</p>
      )}

      {result && (
        <>
          <div className="admin-info-row" style={{ marginTop: 12 }}>
            <span><strong>지역:</strong> {result.si} {result.gu} {result.dong}</span>
            <span><strong>즉석 run_id:</strong> {result.on_demand_run_id || '-'}</span>
            <span><strong>분석 기간:</strong> {result.analysis_start || '-'} ~ {result.analysis_end || '-'}</span>
            <span><strong>생성/평가 기간:</strong> {result.generation_start} ~ {result.generation_end} ({result.n_steps}개월)</span>
            <span><strong>시나리오:</strong> {result.n_scenarios}개</span>
            <span><strong>실제 데이터 겹침:</strong> {result.n_overlap}개월</span>
            {result.has_actual_overlap
              ? <span style={{ color: '#1d8e63', fontWeight: 700 }}>실제-예측 겹침 ({result.n_overlap}개월)</span>
              : <span style={{ color: '#e67e22', fontWeight: 700 }}>실제 데이터 없음 (미래 구간)</span>
            }
          </div>

          <div className="admin-results">
            <AdminSectionTitle>① 시나리오 포괄성 (Coverage)</AdminSectionTitle>
            <div className="admin-metric-grid">
              {diffCard('range_coverage')}
              {diffCard('p10_p90_coverage')}
              {diffCard('p25_p75_coverage')}
            </div>

            <AdminSectionTitle>② 이탈율 분석 (Breach Rates)</AdminSectionTitle>
            <div className="admin-metric-grid">
              {diffCard('lower_breach_rate')}
              {diffCard('upper_breach_rate')}
              {diffCard('min_max_breach_rate')}
            </div>

            <AdminSectionTitle>③ 시나리오 폭 &amp; 다양성 (Width)</AdminSectionTitle>
            <div className="admin-metric-grid">
              {diffCard('full_range_width')}
              {diffCard('p10_p90_width')}
              {diffCard('p25_p75_width')}
              {diffCard('scenario_diversity')}
            </div>

            <AdminSectionTitle>④ 분포 보정 &amp; P50 정확도 (Calibration)</AdminSectionTitle>
            <div className="admin-metric-grid">
              {diffCard('actual_rank_percentile')}
              {diffCard('naive_p10_p90_coverage_diff')}
              {diffCard('p50_mae')}
              {diffCard('p50_mape')}
              {diffCard('p50_direction_accuracy')}
            </div>

            <AdminSectionTitle>⑤ 시나리오 다양성 보강 (Final Distribution &amp; 그룹)</AdminSectionTitle>
            <div className="admin-metric-grid">
              {diffCard('final_p90_p10_spread')}
              {diffCard('final_scenario_std')}
              {diffCard('bull_count')}
              {diffCard('neutral_count')}
              {diffCard('bear_count')}
              {diffCard('bull_mean_return_pct')}
              {diffCard('neutral_mean_return_pct')}
              {diffCard('bear_mean_return_pct')}
            </div>

            <AdminSectionTitle>⑥ 경제적 현실성 (Realism Check)</AdminSectionTitle>
            <div className="admin-metric-grid">
              {diffCard('realism_score')}
              {diffCard('realism_negative_rate')}
              {diffCard('realism_extreme_change_rate')}
              {diffCard('realism_far_from_last_rate')}
              {diffCard('realism_direction_consistency')}
            </div>

            <AdminSectionTitle>⑦ Naive 기준선 대비 비교</AdminSectionTitle>
            <div className="admin-metric-grid">
              {diffCard('naive_range_coverage')}
              {diffCard('naive_mae')}
              {diffCard('naive_mape')}
              {diffCard('naive_improvement_rate')}
              {diffCard('coverage_vs_naive_diff')}
            </div>

            <AdminSectionTitle>⑧ Fan Chart (시나리오 분포 vs 실제)</AdminSectionTitle>
            <div className="admin-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={result.chart_data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Math.round(v).toLocaleString()} />
                  <Tooltip formatter={(v, n) => [v != null ? fmtNum(v) : '-', n]} />
                  <Legend />
                  <Area type="monotone" dataKey="p90" name="P10~P90 밴드" fill="rgba(34,85,204,0.13)" stroke="rgba(34,85,204,0.35)" strokeWidth={1} dot={false} connectNulls />
                  <Area type="monotone" dataKey="p10" name="P10 (하단)" fill="rgba(248,251,255,1)" stroke="rgba(34,85,204,0.35)" strokeWidth={1} dot={false} connectNulls legendType="none" />
                  <Line type="monotone" dataKey="p75" name="P75" stroke="rgba(34,85,204,0.50)" strokeWidth={1} strokeDasharray="4 2" dot={false} connectNulls legendType="none" />
                  <Line type="monotone" dataKey="p25" name="P25" stroke="rgba(34,85,204,0.50)" strokeWidth={1} strokeDasharray="4 2" dot={false} connectNulls legendType="none" />
                  <Line type="monotone" dataKey="p50" name="P50 (중앙값)" stroke="#2255cc" strokeWidth={2.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="actual" name="실제" stroke="#0a1628" strokeWidth={2.5} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Admin Sub-page: TFT 군집 모델 검증 (Train/Test Split 기반)
// ===========================================================================
function TFTValidationTab() {
  const [si, setSi] = useState('서울특별시');
  const [gu, setGu] = useState('강남구');
  const [dong, setDong] = useState('개포동');
  const [modelType, setModelType] = useState('var_tft');
  const [dates, setDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [trainStart, setTrainStart] = useState('');
  const [trainEnd, setTrainEnd] = useState('');
  const [testStart, setTestStart] = useState('');
  const [testEnd, setTestEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function nextMonth(yyyymm) {
    if (!yyyymm || yyyymm.length < 7) return '';
    const [y, m] = yyyymm.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return '';
    const dt = new Date(y, m, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }

  function loadDates() {
    if (!dong.trim()) return;
    setDatesLoading(true);
    setDates([]); setTrainStart(''); setTrainEnd(''); setTestStart(''); setTestEnd(''); setResult(null); setError(null);
    fetch(`${API_BASE}/admin/validate/tft-dates?si=${encodeURIComponent(si)}&gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        const list = d.dates || [];
        setDates(list);
        if (list.length >= 2) {
          const splitIdx = Math.max(0, Math.floor(list.length * 0.7) - 1);
          const tEnd = list[splitIdx];
          setTrainStart(list[0]);
          setTrainEnd(tEnd);
          setTestStart(nextMonth(tEnd));
          setTestEnd(list[list.length - 1]);
        }
      })
      .catch((e) => setError('날짜 로드 실패: ' + e.message))
      .finally(() => setDatesLoading(false));
  }

  useEffect(() => {
    if (!trainEnd || dates.length === 0) return;
    const expected = nextMonth(trainEnd);
    setTestStart(expected);
    if (!testEnd || testEnd <= trainEnd) {
      const afterTrain = dates.filter((d) => d > trainEnd);
      if (afterTrain.length > 0) setTestEnd(afterTrain[afterTrain.length - 1]);
    }
  }, [trainEnd, dates]);

  function runValidation() {
    if (!trainEnd || !testEnd) return;
    setLoading(true); setError(null); setResult(null);
    const url = `${API_BASE}/admin/validate/tft?si=${encodeURIComponent(si)}&gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&train_end=${trainEnd}&test_end=${testEnd}&model_type=${modelType}`;
    fetch(url)
      .then((r) => { if (!r.ok) return r.json().then((e) => { throw new Error(e.detail || `HTTP ${r.status}`); }); return r.json(); })
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  const CC = { bull: '#1d8e63', neutral: '#e67e22', bear: '#c0392b' };

  // Build per-cluster [p10, p90] bands for Recharts Area (range-mode dataKey).
  // Recharts treats dataKey returning a [low, high] tuple as a vertical band.
  const chartDataWithBands = useMemo(() => {
    if (!result?.chart_data) return [];
    return result.chart_data.map((row) => ({
      ...row,
      bull_band: (row.bull_p10 != null && row.bull_p90 != null) ? [row.bull_p10, row.bull_p90] : null,
      neutral_band: (row.neutral_p10 != null && row.neutral_p90 != null) ? [row.neutral_p10, row.neutral_p90] : null,
      bear_band: (row.bear_p10 != null && row.bear_p90 != null) ? [row.bear_p10, row.bear_p90] : null,
    }));
  }, [result]);

  return (
    <div className="admin-tab-body">
      {/* ── 지역 및 모델 필터 ────────────────────────────────────────────── */}
      <div className="admin-filter-row">
        <div className="admin-filter-field">
          <label>시</label>
          <input value={si} onChange={(e) => setSi(e.target.value)} placeholder="서울특별시" />
        </div>
        <div className="admin-filter-field">
          <label>구</label>
          <input value={gu} onChange={(e) => setGu(e.target.value)} placeholder="강남구" />
        </div>
        <div className="admin-filter-field">
          <label>동</label>
          <input value={dong} onChange={(e) => setDong(e.target.value)} placeholder="개포동" />
        </div>
        <div className="admin-filter-field">
          <label>시나리오 방식</label>
          <select value={modelType} onChange={(e) => setModelType(e.target.value)}>
            <option value="var_tft">VAR-TFT</option>
            <option value="diffusion_tft">Diffusion-TFT</option>
          </select>
        </div>
        <button className="admin-run-btn" onClick={loadDates} disabled={datesLoading || !dong.trim()}>
          {datesLoading ? '조회 중…' : '기간 조회'}
        </button>
      </div>

      {/* ── 기간 선택 ────────────────────────────────────────────────────────── */}
      {dates.length > 0 && (
        <div className="admin-filter-row" style={{ marginTop: 8 }}>
          <div className="admin-filter-field">
            <label>학습 시작</label>
            <select value={trainStart} onChange={(e) => setTrainStart(e.target.value)} disabled={datesLoading}>
              {dates.filter((d) => !trainEnd || d <= trainEnd).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="admin-filter-field">
            <label>학습 종료</label>
            <select value={trainEnd} onChange={(e) => setTrainEnd(e.target.value)} disabled={datesLoading}>
              {dates.filter((d) => (!trainStart || d >= trainStart) && d < (testEnd || dates[dates.length - 1])).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="admin-filter-field">
            <label>테스트 시작 <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>(자동)</span></label>
            <select value={testStart} disabled style={{ opacity: 0.6 }}>
              <option value={testStart}>{testStart || '-'}</option>
            </select>
          </div>
          <div className="admin-filter-field">
            <label>테스트 종료</label>
            <select value={testEnd} onChange={(e) => setTestEnd(e.target.value)} disabled={datesLoading}>
              {dates.filter((d) => d > trainEnd).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button
            className="admin-run-btn primary"
            onClick={runValidation}
            disabled={loading || datesLoading || !trainEnd || !testEnd || trainEnd >= testEnd}
          >
            {loading ? '검증 중…' : '검증 실행'}
          </button>
        </div>
      )}

      {error && <p className="admin-error" style={{ margin: '12px 0' }}>{error}</p>}
      {loading && <p className="admin-placeholder">TFT 모델 학습 및 검증 중… (수십 초 소요)</p>}

      {!result && !loading && !error && dates.length === 0 && (
        <p className="admin-placeholder">지역을 입력하고 '기간 조회'를 클릭하세요.</p>
      )}

      {result && (
        <>
          <div className="admin-info-row" style={{ marginTop: 16 }}>
            <span><strong>지역:</strong> {result.si} {result.gu} {result.dong}</span>
            <span><strong>학습:</strong> {result.train_period} ({result.n_train}개월)</span>
            <span><strong>테스트:</strong> {result.test_period} ({result.n_test}개월)</span>
            <span><strong>시나리오 방식:</strong> {result.model_type === 'var_tft' ? 'VAR-TFT' : 'Diffusion-TFT'}</span>
            <span><strong>총 시나리오:</strong> {result.n_scenarios}개</span>
          </div>

          <div className="admin-results">
        {(() => {
          const m = result.metrics || {};
          const dirCounts = m.dir_counts || {};
          const covMap = m.cluster_range_coverage || {};
          const widthMap = m.cluster_band_width || {};
          const accMap = m.p50_accuracy || {};
          const dirAccMap = m.cluster_direction_accuracy || {};
          const covVsNaive = m.cluster_coverage_vs_naive_diff || {};
          const p50Improve = m.cluster_p50_mae_improvement || {};
          const p50Mean = m.cluster_p50_mean || {};
          const CLUSTER_LABEL = { bull: '상승 (Bull)', neutral: '보합 (Neutral)', bear: '하락 (Bear)' };
          const fmtSigned = (v, d = 1, unit = '%') => v == null ? '-' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(d)}${unit}`;
          const fmtVal = (v, unit = '') => v == null ? '-' : `${fmtNum(v)}${unit}`;
          const coverageGrade = (v) => v == null ? undefined : (v >= 70 ? 'good' : v >= 40 ? 'warn' : 'bad');
          const mapeGrade = (v) => v == null ? undefined : (v <= 3 ? 'good' : v <= 7 ? 'warn' : 'bad');
          const dirAccGrade = (v) => v == null ? undefined : (v >= 60 ? 'good' : v >= 50 ? 'warn' : 'bad');
          const overlapGrade = (v) => v == null ? undefined : (v <= 30 ? 'good' : v <= 60 ? 'warn' : 'bad');
          const improveGrade = (v) => v == null ? undefined : (v > 10 ? 'good' : v >= 0 ? 'warn' : 'bad');
          const matchGrade = (b) => b === true ? 'good' : b === false ? 'bad' : undefined;
          return (
            <>
              <AdminSectionTitle>① 군집 분포 및 P50 정렬 (Separation)</AdminSectionTitle>
              <div className="admin-metric-grid">
                {['bull', 'neutral', 'bear'].map((d) => (
                  <MetricCard
                    key={d}
                    label={`${CLUSTER_LABEL[d]} 시나리오 수`}
                    value={fmtVal(dirCounts[d], '개')}
                    grade={d === 'bull' ? 'good' : d === 'bear' ? 'bad' : 'warn'}
                    tooltip={{ text: `${CLUSTER_LABEL[d]} 군집에 속한 시나리오 개수`, best: '세 군집이 균형있게 분포할수록 이상적' }}
                  />
                ))}
                <MetricCard
                  label="군집 분리도 (σ)"
                  value={fmtVal(m.separation_sigma)}
                  grade={m.separation_sigma > 50 ? 'good' : m.separation_sigma > 20 ? 'warn' : 'bad'}
                  tooltip={{ text: 'Bull/Neutral/Bear 군집 P50 평균의 표준편차. 클수록 군집 구분이 뚜렷함', best: '클수록 좋음 (50 이상 권장)' }}
                />
                <MetricCard
                  label="Bull > Neutral"
                  value={m.bull_above_neutral == null ? '-' : (m.bull_above_neutral ? '✓ 충족' : '✗ 위반')}
                  grade={matchGrade(m.bull_above_neutral)}
                  tooltip={{ text: 'Bull 군집의 P50 평균이 Neutral보다 높은지', best: '충족' }}
                />
                <MetricCard
                  label="Neutral > Bear"
                  value={m.neutral_above_bear == null ? '-' : (m.neutral_above_bear ? '✓ 충족' : '✗ 위반')}
                  grade={matchGrade(m.neutral_above_bear)}
                  tooltip={{ text: 'Neutral 군집의 P50 평균이 Bear보다 높은지', best: '충족' }}
                />
                {['bull', 'neutral', 'bear'].map((d) => (
                  <MetricCard
                    key={`mean_${d}`}
                    label={`${CLUSTER_LABEL[d]} P50 평균`}
                    value={fmtVal(p50Mean[d])}
                    tooltip={{ text: `${CLUSTER_LABEL[d]} 군집 P50의 전 기간 평균값`, best: 'Bull > Neutral > Bear 순서 권장' }}
                  />
                ))}
              </div>

              <AdminSectionTitle>② 군집별 가격범위 포괄율 (Cluster Range Coverage)</AdminSectionTitle>
              <div className="admin-metric-grid">
                {['bull', 'neutral', 'bear'].map((d) => (
                  <MetricCard
                    key={`cov_${d}`}
                    label={`${CLUSTER_LABEL[d]} P10~P90 포괄율`}
                    value={covMap[d] == null ? '-' : `${covMap[d]}%`}
                    grade={coverageGrade(covMap[d])}
                    tooltip={{ text: `테스트 구간 실제값이 ${CLUSTER_LABEL[d]} 군집의 P10~P90 밴드 안에 포함된 비율`, best: '실제 시장 방향과 일치하는 군집에서 70%↑이면 양호' }}
                  />
                ))}
              </div>

              <AdminSectionTitle>③ 군집별 밴드 폭 (Cluster Band Width)</AdminSectionTitle>
              <div className="admin-metric-grid">
                {['bull', 'neutral', 'bear'].map((d) => (
                  <MetricCard
                    key={`w_${d}`}
                    label={`${CLUSTER_LABEL[d]} 평균 폭`}
                    value={fmtVal(widthMap[d])}
                    tooltip={{ text: `${CLUSTER_LABEL[d]} 군집의 평균 P90-P10 폭. 좁을수록 정보력↑, 너무 좁으면 실제값 놓침`, best: '실제값 포함 + 폭이 과도하게 넓지 않을 때 좋음' }}
                  />
                ))}
              </div>

              <AdminSectionTitle>④ 군집 밴드 겹침 (Cluster Separation 보강)</AdminSectionTitle>
              <div className="admin-metric-grid">
                <MetricCard
                  label="Bull ↔ Neutral 겹침"
                  value={m.band_overlap_bull_neutral == null ? '-' : `${m.band_overlap_bull_neutral}%`}
                  grade={overlapGrade(m.band_overlap_bull_neutral)}
                  tooltip={{ text: 'Bull과 Neutral 군집 P10-P90 밴드의 평균 겹침 비율 (평균 폭 기준)', best: '낮을수록 군집 구분 뚜렷 (30%↓ 권장)' }}
                />
                <MetricCard
                  label="Neutral ↔ Bear 겹침"
                  value={m.band_overlap_neutral_bear == null ? '-' : `${m.band_overlap_neutral_bear}%`}
                  grade={overlapGrade(m.band_overlap_neutral_bear)}
                  tooltip={{ text: 'Neutral과 Bear 군집 밴드의 평균 겹침 비율', best: '낮을수록 좋음 (30%↓ 권장)' }}
                />
                <MetricCard
                  label="Bull ↔ Bear 겹침"
                  value={m.band_overlap_bull_bear == null ? '-' : `${m.band_overlap_bull_bear}%`}
                  grade={overlapGrade(m.band_overlap_bull_bear)}
                  tooltip={{ text: 'Bull과 Bear 군집 밴드의 평균 겹침 비율 (서비스 의미상 가장 낮아야 함)', best: '거의 0% 이상적' }}
                />
              </div>

              <AdminSectionTitle>⑤ 군집 매칭 정확도 (Cluster Matching Accuracy)</AdminSectionTitle>
              <div className="admin-metric-grid">
                <MetricCard
                  label="실제 시장 국면"
                  value={m.actual_regime ? CLUSTER_LABEL[m.actual_regime] : '-'}
                  grade={m.actual_regime === 'bull' ? 'good' : m.actual_regime === 'bear' ? 'bad' : 'warn'}
                  tooltip={{ text: '테스트 구간 마지막 실제값의 학습 마지막값 대비 수익률을 ±3% 기준으로 분류', best: '서비스 목적상 실제 국면과 매칭되는 군집이 우수해야 좋음' }}
                />
                <MetricCard
                  label="실제 총 수익률"
                  value={fmtSigned(m.actual_total_return_pct, 2, '%')}
                  tooltip={{ text: '테스트 마지막 실제값 vs 학습 마지막값', best: '판단 기준 (절대치 의미 없음)' }}
                />
                <MetricCard
                  label="매칭 군집 포괄율"
                  value={m.matched_cluster_coverage == null ? '-' : `${m.matched_cluster_coverage}%`}
                  grade={coverageGrade(m.matched_cluster_coverage)}
                  tooltip={{ text: '실제 국면과 같은 이름의 군집이 실제값을 P10-P90 안에 포함한 비율', best: '70%↑ 권장' }}
                />
                <MetricCard
                  label="매칭 군집 MAE"
                  value={fmtVal(m.matched_cluster_mae)}
                  tooltip={{ text: '실제 국면과 같은 이름의 군집 P50과 실제값의 평균 절대 오차', best: '낮을수록 좋음' }}
                />
                <MetricCard
                  label="최고 포괄률 군집"
                  value={m.best_cluster_by_coverage ? CLUSTER_LABEL[m.best_cluster_by_coverage] : '-'}
                  grade={matchGrade(m.cluster_match_by_coverage)}
                  tooltip={{ text: '실제값을 P10-P90 밴드에 가장 많이 포함한 군집', best: '실제 국면과 일치할 때 ✓' }}
                />
                <MetricCard
                  label="최저 MAE 군집"
                  value={m.best_cluster_by_mae ? CLUSTER_LABEL[m.best_cluster_by_mae] : '-'}
                  grade={matchGrade(m.cluster_match_by_mae)}
                  tooltip={{ text: 'P50 오차가 가장 작은 군집', best: '실제 국면과 일치할 때 ✓' }}
                />
                <MetricCard
                  label="국면-Coverage 매칭"
                  value={m.cluster_match_by_coverage == null ? '-' : (m.cluster_match_by_coverage ? '✓ 일치' : '✗ 불일치')}
                  grade={matchGrade(m.cluster_match_by_coverage)}
                  tooltip={{ text: '최고 포괄률 군집이 실제 국면과 일치하는지', best: '일치 (모델이 시장 국면을 잘 분류한 것)' }}
                />
                <MetricCard
                  label="국면-MAE 매칭"
                  value={m.cluster_match_by_mae == null ? '-' : (m.cluster_match_by_mae ? '✓ 일치' : '✗ 불일치')}
                  grade={matchGrade(m.cluster_match_by_mae)}
                  tooltip={{ text: '최저 MAE 군집이 실제 국면과 일치하는지', best: '일치' }}
                />
              </div>

              <AdminSectionTitle>⑥ 군집별 P50 정확도 (P50 Accuracy)</AdminSectionTitle>
              <div className="admin-metric-grid">
                {['bull', 'neutral', 'bear'].flatMap((d) => {
                  const a = accMap[d] || {};
                  return [
                    <MetricCard
                      key={`mae_${d}`}
                      label={`${CLUSTER_LABEL[d]} MAE`}
                      value={fmtVal(a.mae)}
                      tooltip={{ text: `${CLUSTER_LABEL[d]} 군집 P50과 실제값의 평균 절대 오차`, best: '낮을수록 좋음 (보조 지표)' }}
                    />,
                    <MetricCard
                      key={`rmse_${d}`}
                      label={`${CLUSTER_LABEL[d]} RMSE`}
                      value={fmtVal(a.rmse)}
                      tooltip={{ text: `${CLUSTER_LABEL[d]} 군집 P50과 실제값의 RMSE`, best: '낮을수록 좋음' }}
                    />,
                    <MetricCard
                      key={`mape_${d}`}
                      label={`${CLUSTER_LABEL[d]} MAPE`}
                      value={a.mape == null ? '-' : `${a.mape}%`}
                      grade={mapeGrade(a.mape)}
                      tooltip={{ text: `${CLUSTER_LABEL[d]} 군집 P50의 평균 절대 백분율 오차`, best: '3% 이하면 양호 (보조 지표)' }}
                    />,
                  ];
                })}
              </div>

              <AdminSectionTitle>⑦ 방향 정확도 (Direction Accuracy)</AdminSectionTitle>
              <div className="admin-metric-grid">
                {['bull', 'neutral', 'bear'].map((d) => (
                  <MetricCard
                    key={`dir_${d}`}
                    label={`${CLUSTER_LABEL[d]} 방향 정확도`}
                    value={dirAccMap[d] == null ? '-' : `${dirAccMap[d]}%`}
                    grade={dirAccGrade(dirAccMap[d])}
                    tooltip={{ text: `${CLUSTER_LABEL[d]} 군집 P50이 실제 가격 상승/하락 방향을 맞춘 비율`, best: '실제 국면과 일치하는 군집에서 높을수록 좋음 (60%↑)' }}
                  />
                ))}
                <MetricCard
                  label="앙상블 평균 방향 정확도"
                  value={m.direction_accuracy == null ? '-' : `${m.direction_accuracy}%`}
                  grade={dirAccGrade(m.direction_accuracy)}
                  tooltip={{ text: '세 군집 P50의 평균이 실제 방향을 맞춘 비율', best: '높을수록 좋음' }}
                />
              </div>

              <AdminSectionTitle>⑧ Naive 기준선 대비 비교 </AdminSectionTitle>
              <div className="admin-metric-grid">
                <MetricCard
                  label="Naive 밴드 포괄율"
                  value={m.naive_range_coverage == null ? '-' : `${m.naive_range_coverage}%`}
                  tooltip={{ text: '학습 마지막값 ±1% 밴드에 실제값이 포함된 비율 (단순 기준선)', best: '낮을수록 모델 우위 확보 여지' }}
                />
                <MetricCard
                  label="Naive MAE"
                  value={fmtVal(m.naive_mae)}
                  tooltip={{ text: '학습 마지막값을 그대로 예측한 Naive 모델의 평균 절대 오차', best: '비교 기준' }}
                />
                <MetricCard
                  label="Naive MAPE"
                  value={m.naive_mape == null ? '-' : `${m.naive_mape}%`}
                  tooltip={{ text: 'Naive 모델의 평균 절대 백분율 오차', best: '비교 기준' }}
                />
                <MetricCard
                  label="앙상블 P10-P90 vs Naive"
                  value={m.naive_improvement == null ? '-' : `${m.naive_improvement >= 0 ? '+' : ''}${m.naive_improvement}%p`}
                  grade={m.naive_improvement > 10 ? 'good' : m.naive_improvement >= 0 ? 'warn' : 'bad'}
                  tooltip={{ text: '전체 시나리오 P10-P90 포괄율 - Naive 포괄율', best: '양수일수록 좋음' }}
                />
                {['bull', 'neutral', 'bear'].map((d) => (
                  <MetricCard
                    key={`cov_n_${d}`}
                    label={`${CLUSTER_LABEL[d]} 포괄율 vs Naive`}
                    value={covVsNaive[d] == null ? '-' : `${covVsNaive[d] >= 0 ? '+' : ''}${covVsNaive[d]}%p`}
                    grade={improveGrade(covVsNaive[d])}
                    tooltip={{ text: `${CLUSTER_LABEL[d]} 군집 포괄율 - Naive 포괄율`, best: '실제 국면과 일치하는 군집에서 양수일수록 좋음' }}
                  />
                ))}
                {['bull', 'neutral', 'bear'].map((d) => (
                  <MetricCard
                    key={`imp_${d}`}
                    label={`${CLUSTER_LABEL[d]} P50 MAE 개선율`}
                    value={p50Improve[d] == null ? '-' : `${p50Improve[d] >= 0 ? '+' : ''}${p50Improve[d]}%`}
                    grade={improveGrade(p50Improve[d])}
                    tooltip={{ text: `(Naive MAE − ${CLUSTER_LABEL[d]} P50 MAE) / Naive MAE`, best: '양수 + 클수록 Naive보다 우수' }}
                  />
                ))}
              </div>
            </>
          );
        })()}

        <AdminSectionTitle>⑨ 군집별 P50 궤적 (P10–P90 밴드 포함)</AdminSectionTitle>
        <div className="admin-chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartDataWithBands} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Math.round(v).toLocaleString()} />
              <Tooltip
                formatter={(v, n) => {
                  if (Array.isArray(v)) return [`${fmtNum(v[0])} ~ ${fmtNum(v[1])}`, n];
                  return [v != null ? `${fmtNum(v)}` : '-', n];
                }}
              />
              <Legend />
              {/* P10-P90 bands first so P50 lines and actual sit on top */}
              <Area dataKey="bull_band" name="Bull P10–P90" stroke="none" fill={CC.bull} fillOpacity={0.14} isAnimationActive={false} connectNulls />
              <Area dataKey="neutral_band" name="Neutral P10–P90" stroke="none" fill={CC.neutral} fillOpacity={0.12} isAnimationActive={false} connectNulls />
              <Area dataKey="bear_band" name="Bear P10–P90" stroke="none" fill={CC.bear} fillOpacity={0.12} isAnimationActive={false} connectNulls />
              <Line dataKey="actual" name="실제" stroke="#0a1628" strokeWidth={2.5} dot={false} connectNulls />
              <Line dataKey="bull_p50" name="Bull P50" stroke={CC.bull} strokeWidth={2} dot={false} connectNulls />
              <Line dataKey="neutral_p50" name="Neutral P50" stroke={CC.neutral} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
              <Line dataKey="bear_p50" name="Bear P50" stroke={CC.bear} strokeWidth={2} strokeDasharray="2 4" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
          </div>
        </>
      )}
    </div>
  );
}
// ===========================================================================
const ADMIN_TABS = [
  { id: 'var', label: 'VAR 모델', icon: '📊' },
  { id: 'diffusion', label: 'Diffusion 모델', icon: '🌊' },
  { id: 'tft', label: 'TFT 군집', icon: '🧠' },
];

function AdminPage({ onBack }) {
  const [activeTab, setActiveTab] = useState('var');

  return (
    <div className="admin-page">
      <div className="admin-header">
        <button className="admin-back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          메인으로
        </button>
        <div className="admin-header-title">
          <span className="admin-badge">Admin</span>
          <h2>모델 성능 검증 대시보드</h2>
          <p>Train/Test Split · 지역 선택 · VAR · Diffusion · TFT 품질 검증</p>
        </div>
      </div>

      <div className="admin-tab-bar">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.id}
            className={`admin-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="admin-body">
        {activeTab === 'var' && <VARValidationTab />}
        {activeTab === 'diffusion' && <DiffusionValidationTab />}
        {activeTab === 'tft' && <TFTValidationTab />}
      </div>
    </div>
  );
}


// ===========================================================================
// 최상위 App
// ===========================================================================
export default function App() {
  const [activeTab, setActiveTab] = useState("user");
  const [showAdmin, setShowAdmin] = useState(false);

  const TABS = [
    { id: "user", label: "User 분석", sub: "Diffusion-TFT" },
    { id: "cluster", label: "대표 시나리오 분석", sub: "Diffusion-TFT · Phase 군집 분석" },
  ];

  if (showAdmin) {
    return <AdminPage onBack={() => setShowAdmin(false)} />;
  }

  return (
    <div className="sim-page">
      <section className="sim-hero">
        <div className="sim-hero-top-row">
          <p className="sim-tag">2026 비즈니스 응용을 위한 인공지능 - 5조</p>
          <button
            className="admin-icon-btn"
            onClick={() => setShowAdmin(true)}
            title="Admin 검증 대시보드"
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17.21 10a7.37 7.37 0 01-.08 1.09l1.9 1.48a.45.45 0 01.1.58l-1.8 3.11a.45.45 0 01-.55.2l-2.24-.9a7.3 7.3 0 01-.94.54l-.34 2.37a.45.45 0 01-.44.38h-3.6a.45.45 0 01-.44-.38l-.34-2.37a7.3 7.3 0 01-.94-.54l-2.24.9a.45.45 0 01-.55-.2l-1.8-3.11a.45.45 0 01.1-.58l1.9-1.48A7.37 7.37 0 012.79 10c0-.37.03-.74.08-1.09L.97 7.43a.45.45 0 01-.1-.58L2.67 3.74a.45.45 0 01.55-.2l2.24.9c.3-.2.62-.38.94-.54l.34-2.37A.45.45 0 017.18 1.15h3.6c.23 0 .42.17.44.38l.34 2.37c.32.16.64.34.94.54l2.24-.9a.45.45 0 01.55.2l1.8 3.11a.45.45 0 01-.1.58l-1.9 1.48c.05.35.08.72.08 1.09z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <h1>AI 기반 부동산 시나리오 분석</h1>
        <p>
          Diffusion-TFT 기반 집값 분석을 제공합니다<div className=""></div>
        </p>
      </section>

      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="tab-label">{t.label}</span>
            <span className="tab-sub">{t.sub}</span>
          </button>
        ))}
      </div>

      <div className="tab-body">
        {activeTab === "user" && <UserAnalysisTab />}
        {activeTab === "cluster" && <ClusterAnalysisTab />}
      </div>

      <MascotCorner />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 우측 하단 마스코트 (카이스트 넙죽이 + 오리)
// ---------------------------------------------------------------------------
function MascotCorner() {
  return (
    <div className="mascot-corner" aria-hidden="true" title="KAIST 넙죽이">
      <img src={nubjukImg} alt="KAIST 넙죽이" className="mascot mascot-neopjuk" />
    </div>
  );
}

