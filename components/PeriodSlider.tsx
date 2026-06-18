"use client";

import { CalendarRange, Info } from "lucide-react";

export default function PeriodSlider({
  years,
  onChange,
}: {
  years: number;
  onChange: (y: number) => void;
}) {
  const pct = ((years - 1) / (10 - 1)) * 100;

  return (
    <div className="glass-soft p-5">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-cyan-soft" strokeWidth={1.6} />
        <span className="text-sm font-medium text-white">몇 년을 분석하시겠어요?</span>
      </div>
      <p className="mt-1 text-xs font-light text-gray-500">
        선택한 기간을 기준으로 시세 예측·군집·영향 요인이 모두 다시 계산됩니다. (최대 10년)
      </p>

      <div className="mt-5 flex items-center gap-4">
        <div className="flex-1">
          <div className="relative h-6">
            <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/10" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-soft to-cyan-neon shadow-glow"
              style={{ width: `${pct}%` }}
            />
            <input
              type="range"
              className="vsn-range"
              min={1}
              max={10}
              step={1}
              value={years}
              onChange={(e) => onChange(Number(e.target.value))}
              style={{ pointerEvents: "auto" }}
            />
          </div>

          {/* 눈금 — 슬라이더 트랙과 동일한 폭 위에서 정렬 */}
          <div className="mt-2 flex justify-between text-[10px] font-light text-gray-600">
            {[1, 3, 5, 7, 10].map((m) => (
              <button
                key={m}
                onClick={() => onChange(m)}
                className={`transition hover:text-cyan-soft ${years === m ? "text-cyan-neon" : ""}`}
              >
                {m}년
              </button>
            ))}
          </div>
        </div>

        <div className="w-16 shrink-0 text-right">
          <span className="num text-2xl text-cyan-neon">{years}</span>
          <span className="ml-1 text-sm font-light text-gray-500">년</span>
        </div>
      </div>

      {/* 신축 정확도 주의 멘트 */}
      {years > 3 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/80" strokeWidth={1.6} />
          <span className="text-[11px] font-light leading-relaxed text-amber-200/70">
            신축 아파트의 경우 거래 이력이 짧아, 3년 이후 구간부터는 예측 정확성이 다소 감소할 수 있습니다.
          </span>
        </div>
      )}
    </div>
  );
}
