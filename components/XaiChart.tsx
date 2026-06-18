"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface XaiRow {
  h_step: number;
  label: string;
  [group: string]: number | string;
}

function XaiTooltip({ active, payload, label, groups }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0) || 1;
  return (
    <div className="rounded-xl border border-cyan-neon/25 bg-coal/95 px-3 py-2 text-xs backdrop-blur">
      <div className="mb-1.5 font-medium text-gray-300">{label}개월 후</div>
      {[...payload].reverse().map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 font-light text-gray-300">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="num text-[11px]">{((p.value / total) * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function XaiChart({
  data,
  groups,
}: {
  data: XaiRow[];
  groups: { name: string; color: string }[];
}) {
  const tickInterval = Math.max(0, Math.floor(data.length / 7));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        stackOffset="expand"
        margin={{ top: 10, right: 12, bottom: 0, left: -6 }}
      >
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
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
        />
        <Tooltip content={<XaiTooltip groups={groups} />} />
        {groups.map((g) => (
          <Area
            key={g.name}
            type="monotone"
            dataKey={g.name}
            stackId="1"
            stroke={g.color}
            strokeWidth={0.5}
            fill={g.color}
            fillOpacity={0.55}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
