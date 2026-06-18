"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useState } from "react";
import { Cluster, ClusterBucket } from "@/lib/api";
import { eok, pct, prob } from "@/lib/format";

type Role = "bull" | "neutral" | "bear";

const META: Record<Role, { ko: string; icon: any; accent: string; ring: string; text: string }> = {
  bull: { ko: "낙관", icon: TrendingUp, accent: "from-cyan-neon/20 to-transparent", ring: "border-cyan-neon/50 shadow-glow", text: "text-cyan-neon" },
  neutral: { ko: "중립", icon: Minus, accent: "from-slate-400/15 to-transparent", ring: "border-slate-300/40", text: "text-slate-200" },
  bear: { ko: "비관", icon: TrendingDown, accent: "from-indigo-400/15 to-transparent", ring: "border-indigo-300/40", text: "text-indigo-300" },
};

const ORDER: Role[] = ["bull", "neutral", "bear"];

export default function ClusterTabs({
  cluster,
  years,
  nScenarios,
}: {
  cluster: Cluster | null;
  years: number;
  nScenarios: number;
}) {
  const [tab, setTab] = useState<Role>("bull"); // 기본값: 낙관
  if (!cluster) return null;
  const active = cluster[tab] as ClusterBucket;
  const m = META[tab];

  return (
    <div className="glass p-6 sm:p-7">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-light uppercase tracking-[0.2em] text-gray-500">
            K-Means 시나리오 군집
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white">{years}년 후 시세 전망</h3>
        </div>
        <span className="text-[11px] font-light text-gray-500">
          {nScenarios.toLocaleString()}개 시나리오 기준
        </span>
      </div>

      {/* 탭 */}
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {ORDER.map((role) => {
          const b = cluster[role] as ClusterBucket;
          const meta = META[role];
          const selected = tab === role;
          return (
            <button
              key={role}
              onClick={() => setTab(role)}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b px-3 py-4 transition ${
                selected ? `${meta.ring} ${meta.accent}` : "border-white/10 from-transparent to-transparent hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <meta.icon className={`h-4 w-4 ${selected ? meta.text : "text-gray-500"}`} strokeWidth={1.8} />
                <span className={`text-sm font-medium ${selected ? "text-white" : "text-gray-400"}`}>
                  {meta.ko}
                </span>
              </div>
              <div className={`mt-2 num text-2xl ${selected ? meta.text : "text-gray-300"}`}>
                {prob(b.prob)}
                <span className="text-sm font-light text-gray-500">%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 선택 탭 상세 */}
      <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-light text-gray-400">
            {m.ko} 시나리오 예상 가격대
          </span>
          <span className={`text-sm font-medium ${m.text}`}>
            중앙값 {eok(active.price_mid)} · {pct(active.ret_pct)}
          </span>
        </div>
        <div className="mt-4 flex items-end gap-2">
          <span className="num text-2xl">{eok(active.price_low)}</span>
          <span className="mb-1 text-gray-600">—</span>
          <span className="num text-2xl">{eok(active.price_high)}</span>
        </div>

        {/* 분포 막대 */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${
              tab === "bull" ? "from-cyan-soft to-cyan-neon" : tab === "neutral" ? "from-slate-500 to-slate-300" : "from-indigo-500 to-indigo-300"
            }`}
            style={{ width: `${prob(active.prob)}%` }}
          />
        </div>
        <div className="mt-2 text-xs font-light text-gray-500">
          전체 시나리오 중 {active.count}개({prob(active.prob)}%)가 이 구간에 분포합니다.
        </div>
      </div>
    </div>
  );
}
