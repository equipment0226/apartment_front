"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface FanRow {
  ts: string;
  label: string;
  hist?: number | null;
  p10?: number | null;
  p50?: number | null;
  p90?: number | null;
  band?: [number, number] | null;
  isForecast: boolean;
}

function FanTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row: FanRow = payload[0].payload;
  return (
    <div className="rounded-xl border border-cyan-neon/25 bg-coal/95 px-3 py-2 text-xs backdrop-blur">
      <div className="mb-1 font-medium text-gray-300">{label}</div>
      {row.hist != null && (
        <div className="text-white">실거래 <span className="num">{row.hist.toFixed(1)}억</span></div>
      )}
      {row.p50 != null && (
        <>
          <div className="text-cyan-neon">예측 중앙 <span className="num">{row.p50.toFixed(1)}억</span></div>
          <div className="font-light text-gray-400">
            {row.p10?.toFixed(1)}억 ~ {row.p90?.toFixed(1)}억 (P10–P90)
          </div>
        </>
      )}
    </div>
  );
}

export default function FanChart({ data }: { data: FanRow[] }) {
  const tickInterval = Math.max(0, Math.floor(data.length / 7));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -6 }}>
        <defs>
          <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0.06} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="label"
          interval={tickInterval}
          tick={{ fill: "#64748b", fontSize: 11, fontWeight: 300 }}
          tickLine={false}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11, fontWeight: 300 }}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => `${v}억`}
          domain={["auto", "auto"]}
        />
        <Tooltip content={<FanTooltip />} />

        {/* P10–P90 신뢰 밴드 */}
        <Area
          type="monotone"
          dataKey="band"
          stroke="none"
          fill="url(#bandFill)"
          isAnimationActive={false}
          connectNulls
        />
        {/* 과거 실거래 */}
        <Line
          type="monotone"
          dataKey="hist"
          stroke="#E2E8F0"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        {/* 예측 중앙값 */}
        <Line
          type="monotone"
          dataKey="p50"
          stroke="#00E5FF"
          strokeWidth={2.2}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
