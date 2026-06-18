"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart as LineIcon, Layers } from "lucide-react";
import { Report } from "@/lib/api";
import { shortDate } from "@/lib/format";
import FanChart, { FanRow } from "./FanChart";
import XaiChart, { XaiRow } from "./XaiChart";
import RangeSlider from "./RangeSlider";

export default function ChartsSection({ report }: { report: Report }) {
  const { fan, shap } = report;
  const horizon = fan.forecast.length || 120;
  const [range, setRange] = useState<[number, number]>([1, horizon]);
  const [start, end] = range;

  // 분석 기간(슬라이더 max)이 바뀌면 차트 구간을 전체로 리셋
  useEffect(() => {
    setRange([1, horizon]);
  }, [horizon]);

  // ---- 팬차트 결합 데이터 (과거 + 예측) ----
  const fanData: FanRow[] = useMemo(() => {
    const hist: FanRow[] = fan.history.map((h) => ({
      ts: h.ts,
      label: shortDate(h.ts),
      hist: h.price ?? null,
      isForecast: false,
    }));
    // 예측 시작점 연결: 마지막 실거래에 중앙값/밴드 시드
    if (hist.length && start === 1) {
      const last = hist[hist.length - 1];
      const v = last.hist ?? null;
      if (v != null) {
        last.p50 = v;
        last.p10 = v;
        last.p90 = v;
        last.band = [v, v];
      }
    }
    const fc: FanRow[] = fan.forecast
      .map((f, i) => ({ f, month: i + 1 }))
      .filter(({ month }) => month >= start && month <= end)
      .map(({ f }) => ({
        ts: f.ts,
        label: shortDate(f.ts),
        p10: f.p10 ?? null,
        p50: f.p50 ?? null,
        p90: f.p90 ?? null,
        band: f.p10 != null && f.p90 != null ? ([f.p10, f.p90] as [number, number]) : null,
        isForecast: true,
      }));
    return [...hist, ...fc];
  }, [fan, start, end]);

  // ---- XAI 100% 스택 데이터 (예측 구간만) ----
  const xaiData: XaiRow[] = useMemo(() => {
    return shap.vsn_series
      .filter((v) => v.h_step >= start && v.h_step <= end)
      .map((v) => {
        const row: XaiRow = { h_step: v.h_step, label: String(v.h_step) };
        shap.groups.forEach((g) => {
          row[g.name] = (v[g.name] as number) ?? 0;
        });
        return row;
      });
  }, [shap, start, end]);

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
          <FanChart data={fanData} />
        </div>
      </div>

      {/* XAI 100% 스택 */}
      <div className="glass p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-soft" />
            <h3 className="text-lg font-semibold text-white">설명가능성(XAI) 기여도</h3>
          </div>
          <span className="text-[11px] font-light text-gray-500">시점별 요인 비중(100%)</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {shap.groups.map((g) => (
            <span key={g.name} className="flex items-center gap-1.5 text-[11px] font-light text-gray-400">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} />
              {g.name}
            </span>
          ))}
        </div>
        <div className="mt-4">
          <XaiChart data={xaiData} groups={shap.groups} />
        </div>
      </div>

      {/* 글로벌 레인지 슬라이더 — 두 차트 X축 동기화 */}
      <div className="glass animate-pulseglow p-6 sm:p-7">
        <RangeSlider min={1} max={horizon} value={range} onChange={setRange} />
        <p className="mt-3 text-[11px] font-light text-gray-500">
          슬라이더를 움직이면 팬 차트와 XAI 차트의 예측 구간이 실시간으로 함께 조정됩니다.
        </p>
      </div>
    </div>
  );
}
