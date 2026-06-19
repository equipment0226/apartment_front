"use client";

import { ArrowLeft, Info, Layers, LineChart as LineIcon, Loader2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, GuItem, GuReport } from "@/lib/api";
import { shortDate } from "@/lib/format";
import PeriodSlider from "@/components/PeriodSlider";
import GuFanChart, { GuFanRow } from "@/components/GuFanChart";
import GuXai from "@/components/GuXai";

interface BandLike {
  forecast: { ts: string; p1: number; p10: number; p50: number; p90: number; p99: number }[];
}

/** 과거 실측 + (선택)점예측 + 밴드 → GuFanChart 행 결합 */
function buildRows(
  history: { ts: string; value: number }[],
  band: BandLike,
  point?: { ts: string; value: number }[]
): GuFanRow[] {
  const pointMap = new Map<string, number>();
  (point || []).forEach((p) => pointMap.set(p.ts, p.value));

  const hist: GuFanRow[] = history.map((h) => ({
    ts: h.ts,
    label: shortDate(h.ts),
    hist: h.value,
    isForecast: false,
  }));
  // 마지막 실측을 밴드/점예측 시작점으로 시드 (연결 매끄럽게)
  if (hist.length) {
    const last = hist[hist.length - 1];
    const v = last.hist ?? null;
    if (v != null) {
      last.bandInner = [v, v];
      last.bandLow = [v, v];
      last.bandHigh = [v, v];
      last.point = v;
    }
  }
  const fc: GuFanRow[] = band.forecast
    // anchor(과거 마지막) 중복 행은 제외하고 미래 구간만
    .filter((f) => !history.length || f.ts > history[history.length - 1].ts)
    .map((f) => ({
      ts: f.ts,
      label: shortDate(f.ts),
      bandInner: [f.p10, f.p90] as [number, number],
      bandLow: [f.p1, f.p10] as [number, number],
      bandHigh: [f.p90, f.p99] as [number, number],
      point: pointMap.has(f.ts) ? (pointMap.get(f.ts) as number) : null,
      isForecast: true,
    }));
  return [...hist, ...fc];
}

export default function DistrictPage() {
  const [gus, setGus] = useState<GuItem[]>([]);
  const [gu, setGu] = useState<string | null>(null);
  const [years, setYears] = useState(3);
  const [report, setReport] = useState<GuReport | null>(null);
  const [loading, setLoading] = useState(false);

  // 구 목록 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.guList();
        if (!cancelled) setGus(res);
      } catch {
        if (!cancelled) setGus([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 구 + 기간 → 리포트 (디바운스)
  useEffect(() => {
    if (!gu) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      (async () => {
        try {
          const res = await api.guReport(gu, years * 12);
          if (!cancelled) setReport(res);
        } catch {
          if (!cancelled) setReport(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [gu, years]);

  const tftRows = useMemo(
    () => (report ? buildRows(report.history, report.tft, report.point) : []),
    [report]
  );
  const rwRows = useMemo(
    () => (report ? buildRows(report.history, report.rw) : []),
    [report]
  );

  const si = gus[0]?.si || "서울특별시";

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 pb-28 pt-10 sm:px-8">
      {/* 헤더 */}
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-80">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-neon/30 bg-cyan-neon/[0.06] shadow-glow">
            <TrendingUp className="h-5 w-5 text-cyan-neon" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">QUANT ESTATE</div>
            <div className="text-[10px] font-light uppercase tracking-[0.25em] text-gray-500">
              Seoul Price Forecast
            </div>
          </div>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-light text-gray-400 transition hover:border-cyan-neon/30 hover:text-cyan-soft"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 메인
        </Link>
      </header>

      {/* 타이틀 */}
      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter text-white sm:text-3xl">
            우리 구 <span className="text-cyan-neon">전망 분석</span> · 지수 기반
          </h2>
          <p className="mt-2 text-sm font-light text-gray-400">
            서울 25개 구의 아파트 매매가격지수를 향후 최대 10년까지 시나리오로 예측합니다.
          </p>
        </div>

        {/* Filter: 구 선택 */}
        <div className="glass-soft p-4">
          <div className="mb-3 text-[11px] font-light uppercase tracking-[0.2em] text-gray-500">
            지역 선택 · {si}
          </div>
          <div className="flex flex-wrap gap-2">
            {gus.map((g) => (
              <button
                key={g.gu}
                onClick={() => setGu(g.gu)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  gu === g.gu
                    ? "border-cyan-neon/60 bg-cyan-neon/[0.1] text-cyan-neon shadow-glow"
                    : "border-white/10 text-gray-400 hover:border-cyan-neon/30 hover:text-cyan-soft"
                }`}
              >
                {g.gu}
              </button>
            ))}
            {!gus.length && (
              <div className="flex items-center gap-2 text-sm font-light text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-soft" /> 구 목록을 불러오는 중…
              </div>
            )}
          </div>
        </div>

        {/* 분석 기간 슬라이더 */}
        {gu && <PeriodSlider years={years} onChange={setYears} maxYears={10} />}
      </section>

      {/* 리포트 */}
      <div className="relative z-0">
        {loading && (
          <div className="mt-10 flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-neon" />
            <span className="text-sm font-light text-gray-400">구 전망을 생성하고 있습니다…</span>
          </div>
        )}

        {report && !loading && (
          <div className="mt-10 space-y-6 animate-fadeup">
            {/* 헤드라인 */}
            <div className="glass p-6 sm:p-7">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] font-light uppercase tracking-[0.2em] text-gray-500">
                    {report.si} {report.gu} · {report.years}년 전망
                  </div>
                  <div className="mt-1 text-2xl font-bold tracking-tighter text-white">
                    매매가격지수 전망
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-light text-gray-500">
                    현재 지수 ({report.last_date})
                  </div>
                  <div className="num text-2xl text-white">
                    {report.last_index != null ? report.last_index.toFixed(1) : "—"}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
                  <div className="text-[11px] font-light text-amber-200/80">
                    BVAR-X 점예측 ({report.years}년 후)
                  </div>
                  <div className="num mt-1 text-xl text-amber-200">
                    {report.point_end != null ? report.point_end.toFixed(1) : "—"}
                    {report.ret_point_pct != null && (
                      <span className="ml-2 text-sm font-light">
                        {report.ret_point_pct >= 0 ? "+" : ""}
                        {report.ret_point_pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-neon/20 bg-cyan-neon/[0.04] p-4">
                  <div className="text-[11px] font-light text-cyan-soft">
                    TFT 시나리오 밴드 (P10–P90)
                  </div>
                  <div className="num mt-1 text-xl text-cyan-soft">
                    {report.tft_band_end
                      ? `${report.tft_band_end.p10.toFixed(1)} ~ ${report.tft_band_end.p90.toFixed(1)}`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* 차트 ① — TFT 시나리오 밴드 + BVAR-X 점예측 */}
            <div className="glass p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineIcon className="h-4 w-4 text-cyan-soft" />
                  <h3 className="text-lg font-semibold text-white">지수 예측 팬 차트 · TFT</h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-light text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-platinum" /> 실측
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 border-t border-dashed border-amber-300" /> BVAR-X 점예측
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded-sm bg-cyan-neon/30" /> P10–P90
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded-sm bg-cyan-neon/15" /> P1–P99
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <GuFanChart data={tftRows} colorHue="cyan" showPoint />
              </div>
            </div>

            {/* XAI 설명 — 실제 SHAP 테이블 기반 */}
            <div className="glass p-6 sm:p-7">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-neon/15">
                  <Layers className="h-4 w-4 text-cyan-neon" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">설명가능성(XAI) 요인 분석</h3>
                  <p className="text-[11px] font-light text-gray-500">
                    실제 모델 기여도(final_gu_shap) 기반 · 점예측=BVAR-X · 밴드예측=TFT
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <GuXai shapPoint={report.shap_point} shapBand={report.shap_band} />
              </div>
            </div>

            {/* 차트 ② — RandomWalk 급등·급락 시나리오 */}
            <div className="glass p-6 sm:p-7">
              <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" strokeWidth={1.7} />
                <p className="text-sm font-light leading-relaxed text-rose-100/90">
                  급등·급락이 발생할 경우 아래와 같은 밴드가 도출될 수 있어요. (랜덤워크 기반
                  생성 시나리오)
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineIcon className="h-4 w-4 text-rose-300" />
                  <h3 className="text-lg font-semibold text-white">
                    극단 시나리오 팬 차트 · RandomWalk
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-light text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-platinum" /> 실측
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded-sm bg-rose-400/30" /> P10–P90
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded-sm bg-rose-400/15" /> P1–P99
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <GuFanChart data={rwRows} colorHue="rose" showPoint={false} />
              </div>
            </div>
          </div>
        )}

        {!report && !loading && (
          <div className="mt-16 flex flex-col items-center justify-center gap-3 py-10 text-center">
            <LineIcon className="h-10 w-10 text-gray-700" strokeWidth={1} />
            <p className="text-sm font-light text-gray-500">
              구를 선택하면 지수 기반 전망 분석이 시작됩니다.
            </p>
          </div>
        )}
      </div>

      <footer className="mt-16 border-t border-white/[0.06] pt-6 text-center text-[11px] font-light text-gray-600">
        본 분석은 통계적 예측이며 투자 권유가 아닙니다 · QUANT ESTATE
      </footer>
    </main>
  );
}
