"use client";

import { useCallback } from "react";

export default function RangeSlider({
  min,
  max,
  value,
  onChange,
  title = "예측 구간",
  formatValue,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  title?: string;
  formatValue?: (v: number) => string;
}) {
  const [start, end] = value;
  const span = max - min || 1;
  const leftPct = ((start - min) / span) * 100;
  const rightPct = ((end - min) / span) * 100;
  const fmt = formatValue ?? ((v: number) => String(v));

  const setStart = useCallback(
    (v: number) => onChange([Math.min(v, end - 1), end]),
    [end, onChange]
  );
  const setEnd = useCallback(
    (v: number) => onChange([start, Math.max(v, start + 1)]),
    [start, onChange]
  );

  return (
    <div className="select-none">
      <div className="flex items-center justify-between text-xs">
        <span className="font-light text-gray-500">{title}</span>
        <span className="num text-sm text-cyan-neon">
          {fmt(start)}
          <span className="font-light text-gray-500"> ~ </span>
          {fmt(end)}
        </span>
      </div>

      <div className="relative mt-4 h-6">
        {/* 트랙 */}
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/10" />
        {/* 활성 구간 */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-soft to-cyan-neon shadow-glow"
          style={{ left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` }}
        />
        {/* 두 개의 thumb */}
        <input
          type="range"
          className="vsn-range"
          min={min}
          max={max}
          value={start}
          onChange={(e) => setStart(Number(e.target.value))}
        />
        <input
          type="range"
          className="vsn-range"
          min={min}
          max={max}
          value={end}
          onChange={(e) => setEnd(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
