"use client";

import { Sparkles, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GuTopFeature } from "@/lib/api";
import { api } from "@/lib/api";
import { iconFor } from "@/lib/icons";

/** 점예측(BVAR-X) + 밴드(TFT) 요인을 합쳐 영향 비중 순으로 정렬 */
function mergeFeatures(a: GuTopFeature[], b: GuTopFeature[]): GuTopFeature[] {
  const map = new Map<string, GuTopFeature>();
  for (const f of [...a, ...b]) {
    const cur = map.get(f.feature);
    if (!cur || f.impact_pct > cur.impact_pct) map.set(f.feature, f);
  }
  return [...map.values()].sort((x, y) => y.impact_pct - x.impact_pct);
}

/**
 * 구 단위 AI 해설 — Deepseek 가 1년 후 지수 시나리오(낙관/중립/비관)와
 * 핵심 가중치를 자연어로 풀어 설명한다. (가격이 아니라 매매가격지수 기준)
 */
export default function GuAiInsight({
  gu,
  shapPoint,
  shapBand,
}: {
  gu: string;
  shapPoint: GuTopFeature[];
  shapBand: GuTopFeature[];
}) {
  const merged = useMemo(() => mergeFeatures(shapPoint, shapBand), [shapPoint, shapBand]);
  const top5 = merged.slice(0, 5);

  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setText(null);
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.guInsight({ gu });
        if (!cancelled) setText(res.insight);
      } catch {
        if (!cancelled) setText("AI 해설을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gu]);

  return (
    <div className="glass overflow-hidden p-6 sm:p-7">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-neon/15">
          <Sparkles className="h-4 w-4 text-cyan-neon" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">AI Insight</h3>
          <p className="text-[11px] font-light text-gray-500">Deepseek · 지수 영향 요인 자동 해설</p>
        </div>
      </div>

      {/* 영향성 Top 5 */}
      <div className="mt-5">
        <div className="text-[11px] font-light uppercase tracking-[0.2em] text-gray-500">
          영향성 TOP 5
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {top5.map((f, i) => {
            const Icon = iconFor(f.icon);
            return (
              <span
                key={f.feature}
                className="flex items-center gap-1.5 rounded-full border border-cyan-neon/25 bg-cyan-neon/[0.06] px-3 py-1.5 text-xs font-medium text-platinum"
              >
                <span className="text-[10px] font-bold text-cyan-neon">{i + 1}</span>
                <Icon className="h-3.5 w-3.5 text-cyan-soft" strokeWidth={1.6} />
                {f.name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Deepseek 해설 텍스트 */}
      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/30 p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm font-light text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-soft" />
            AI가 지수 영향 요인을 분석하고 있습니다…
          </div>
        ) : (
          <div className="space-y-3 text-[15px] font-light leading-relaxed text-gray-300">
            {(text || "").split("\n").filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
