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

export interface GuFanRow {
  ts: string;
  label: string;
  hist?: number | null;
  point?: number | null;
  bandInner?: [number, number] | null; // p10–p90
  bandLow?: [number, number] | null; // p1–p10
  bandHigh?: [number, number] | null; // p90–p99
  isForecast: boolean;
}

function GuFanTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row: GuFanRow = payload[0].payload;
  return (
    <div className="rounded-xl border border-cyan-neon/25 bg-coal/95 px-3 py-2 text-xs backdrop-blur">
      <div className="mb-1 font-medium text-gray-300">{label}</div>
      {row.hist != null && (
        <div className="text-white">
          실측 지수 <span className="num">{row.hist.toFixed(1)}</span>
        </div>
      )}
      {row.point != null && (
        <div className="text-amber-300">
          점예측 <span className="num">{row.point.toFixed(1)}</span>
        </div>
      )}
      {row.bandInner && (
        <div className="font-light text-gray-300">
          P10–P90 {row.bandInner[0].toFixed(1)} ~ {row.bandInner[1].toFixed(1)}
        </div>
      )}
      {(row.bandLow || row.bandHigh) && (
        <div className="font-light text-gray-500">
          P1–P99 {row.bandLow ? row.bandLow[0].toFixed(1) : row.bandInner?.[0].toFixed(1)} ~{" "}
          {row.bandHigh ? row.bandHigh[1].toFixed(1) : row.bandInner?.[1].toFixed(1)}
        </div>
      )}
    </div>
  );
}

/**
 * 구 단위 지수 팬차트.
 *  - 과거 실측 지수 라인(history)
 *  - 점예측 라인(point, 선택)  ※ p50 중심선은 그리지 않는다
 *  - 밴드: P10–P90(내부) + P1–P10·P90–P99(외부)
 * colorHue: "cyan"(TFT 주분석) | "rose"(RandomWalk 급등·급락)
 */
export default function GuFanChart({
  data,
  colorHue = "cyan",
  showPoint = true,
}: {
  data: GuFanRow[];
  colorHue?: "cyan" | "rose";
  showPoint?: boolean;
}) {
  const tickInterval = Math.max(0, Math.floor(data.length / 7));
  const C =
    colorHue === "rose"
      ? { inner: "#FB7185", outer: "#9F1239", innerStop: "#FB7185" }
      : { inner: "#00E5FF", outer: "#1E3A8A", innerStop: "#00E5FF" };
  const idInner = `gufanInner_${colorHue}`;
  const idOuter = `gufanOuter_${colorHue}`;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -6 }}>
        <defs>
          <linearGradient id={idInner} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.innerStop} stopOpacity={0.34} />
            <stop offset="100%" stopColor={C.outer} stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id={idOuter} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.innerStop} stopOpacity={0.14} />
            <stop offset="100%" stopColor={C.outer} stopOpacity={0.04} />
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
          width={40}
          domain={["auto", "auto"]}
        />
        <Tooltip content={<GuFanTooltip />} />

        {/* 외부 밴드: P1–P10 (하단 꼬리) */}
        <Area
          type="monotone"
          dataKey="bandLow"
          stroke="none"
          fill={`url(#${idOuter})`}
          isAnimationActive={false}
          connectNulls
        />
        {/* 외부 밴드: P90–P99 (상단 꼬리) */}
        <Area
          type="monotone"
          dataKey="bandHigh"
          stroke="none"
          fill={`url(#${idOuter})`}
          isAnimationActive={false}
          connectNulls
        />
        {/* 내부 밴드: P10–P90 */}
        <Area
          type="monotone"
          dataKey="bandInner"
          stroke="none"
          fill={`url(#${idInner})`}
          isAnimationActive={false}
          connectNulls
        />
        {/* 과거 실측 지수 */}
        <Line
          type="monotone"
          dataKey="hist"
          stroke="#E2E8F0"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        {/* 점예측 (BVAR-X) — p50 중심선 대용 아님, 별도 결정론 경로 */}
        {showPoint && (
          <Line
            type="monotone"
            dataKey="point"
            stroke="#FBBF24"
            strokeWidth={2.2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
