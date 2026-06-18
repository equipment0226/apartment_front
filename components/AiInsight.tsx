"use client";

import { Sparkles, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Report } from "@/lib/api";
import { api } from "@/lib/api";
import { iconFor } from "@/lib/icons";

export default function AiInsight({
  report,
}: {
  report: Report;
}) {
  const { listing, shap } = report;
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const top5 = shap.top_features.slice(0, 5);
  const top10 = shap.top_features.slice(0, 10);

  useEffect(() => {
    // 단지·기간이 바뀌면 해설 초기화 후 자동 생성
    setText(null);
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.aiInsight({
          gu: listing.gu,
          dong: listing.dong,
          complex_name: listing.complex_name,
          pyeong: listing.pyeong,
          months: listing.months,
        });
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
  }, [listing.gu, listing.dong, listing.complex_name, listing.pyeong, listing.months]);

  return (
    <div className="glass overflow-hidden p-6 sm:p-7">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-neon/15">
          <Sparkles className="h-4 w-4 text-cyan-neon" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">AI Insight</h3>
          <p className="text-[11px] font-light text-gray-500">Deepseek · 시세 영향 요인 자동 해설</p>
        </div>
      </div>

      {/* 영향성 Top 5 — 짧은 단어 칩 */}
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
            AI가 시세 요인을 분석하고 있습니다…
          </div>
        ) : (
          <div className="space-y-3 text-[15px] font-light leading-relaxed text-gray-300">
            {(text || "").split("\n").filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </div>

      {/* 상세 요인 (최대 10개) — 카테고리 설명 + 영향도 바 */}
      <div className="mt-6">
        <div className="text-[11px] font-light uppercase tracking-[0.2em] text-gray-500">
          상세 영향 요인
        </div>
        <div className="mt-3 space-y-2">
          {top10.map((f) => {
            const Icon = iconFor(f.icon);
            const up = f.direction === "up";
            return (
              <div
                key={f.feature}
                className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                  <Icon className="h-4 w-4 text-cyan-soft" strokeWidth={1.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{f.name}</span>
                    {up ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-cyan-neon" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-indigo-300" />
                    )}
                  </div>
                  <div className="truncate text-xs font-light text-gray-500">{f.desc}</div>
                </div>
                <div className="w-24 shrink-0">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-soft to-cyan-neon"
                      style={{ width: `${Math.min(100, f.impact_pct)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right text-[10px] font-light text-gray-500">
                    {f.impact_pct.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
