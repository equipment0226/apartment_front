"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart as LineIcon } from "lucide-react";
import { Report } from "@/lib/api";
import { shortDate } from "@/lib/format";
import FanChart, { FanRow } from "./FanChart";
import RangeSlider from "./RangeSlider";

// 기본 표시 구간 (yyyy-mm) — 2020-01 ~ 2027-05
const DEFAULT_START = "2020-01";
const DEFAULT_END = "2027-05";

export default function ChartsSection({ report }: { report: Report }) {
  const { fan } = report;

  // ---- 전체 결합 타임라인 (과거 실거래 + 예측) ----
  const allRows: FanRow[] = useMemo(() => {
    const hist: FanRow[] = fan.history.map((h) => ({
      ts: h.ts,
      label: shortDate(h.ts),
      hist: h.price ?? null,
      isForecast: false,
    }));
    // 예측 시작점 연결: 마지막 실거래에 중앙값/밴드 시드
    if (hist.length) {
      const last = hist[hist.length - 1];
      const v = last.hist ?? null;
      if (v != null) {
        last.p50 = v;
        last.p10 = v;
        last.p90 = v;
        last.band = [v, v];
      }
    }
    const fc: FanRow[] = fan.forecast.map((f) => ({
      ts: f.ts,
      label: shortDate(f.ts),
      p10: f.p10 ?? null,
      p50: f.p50 ?? null,
      p90: f.p90 ?? null,
      band: f.p10 != null && f.p90 != null ? ([f.p10, f.p90] as [number, number]) : null,
      isForecast: true,
    }));
    return [...hist, ...fc];
  }, [fan]);

  const total = allRows.length;

  // 기본 표시 구간 인덱스(1-base) — plot되는 전체 구간 중 2020-01 ~ 2026-05
  const defaultRange = useMemo<[number, number]>(() => {
    if (!total) return [1, 1];
    const startIdx = Math.max(
      0,
      allRows.findIndex((r) => r.ts.slice(0, 7) >= DEFAULT_START)
    );
    const after = allRows.findIndex((r) => r.ts.slice(0, 7) > DEFAULT_END);
    const endIdx = after === -1 ? total - 1 : Math.max(startIdx, after - 1);
    return [startIdx + 1, endIdx + 1];
  }, [allRows, total]);

  const [range, setRange] = useState<[number, number]>(defaultRange);
  useEffect(() => setRange(defaultRange), [defaultRange]);

  // 표시 구간 슬라이스
  const view = useMemo(
    () => allRows.slice(range[0] - 1, range[1]),
    [allRows, range]
  );

  return (
    <div className="space-y-5">
      {/* 팬차트 */}
      <div className="glass p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LineIcon className="h-4 w-4 text-cyan-soft" />
            <h3 className="text-lg font-semibold text-white">시세 예측 팬 차트</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-light text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-platinum" /> 실거래
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t border-dashed border-cyan-neon" /> 예측 중앙
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-cyan-neon/25" /> P10–P90
            </span>
          </div>
        </div>
        <div className="mt-4">
          <FanChart data={view} />
        </div>
      </div>

      {/* 글로벌 레인지 슬라이더 — 전체 plot 구간(과거+예측) X축 조정 */}
      <div className="glass animate-pulseglow p-6 sm:p-7">
        <RangeSlider
          min={1}
          max={total}
          value={range}
          onChange={setRange}
          title="표시 구간"
          formatValue={(v) => allRows[v - 1]?.label ?? String(v)}
        />
        <p className="mt-3 text-[11px] font-light text-gray-500">
          슬라이더를 움직이면 과거 실거래부터 예측까지 전체 구간을 자유롭게 조정할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
