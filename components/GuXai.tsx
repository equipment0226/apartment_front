"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { GuTopFeature } from "@/lib/api";
import { iconFor } from "@/lib/icons";

function FactorRow({ f }: { f: GuTopFeature }) {
  const Icon = iconFor(f.icon);
  const up = f.direction === "up";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
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
}

function FactorChips({ items }: { items: GuTopFeature[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((f, i) => {
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
  );
}

/**
 * 구 단위 XAI — 실제 final_gu_shap 테이블 기반.
 *  - 점예측(BVAR-X) 상위 5개 요인
 *  - 밴드예측(TFT)  상위 5개 요인
 * 각 섹션에 칩(요약) + 가중치 바(상세)를 함께 노출한다.
 */
export default function GuXai({
  shapPoint,
  shapBand,
}: {
  shapPoint: GuTopFeature[];
  shapBand: GuTopFeature[];
}) {
  return (
    <div className="space-y-6">
      {/* 점예측 — BVAR-X */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-light uppercase tracking-[0.2em] text-gray-500">
            점예측 영향 요인 · BVAR-X
          </div>
          <span className="rounded-full border border-amber-300/30 bg-amber-300/[0.08] px-2.5 py-0.5 text-[10px] font-light text-amber-200">
            잔차상관 기여도
          </span>
        </div>
        {shapPoint.length ? (
          <>
            <div className="mt-3">
              <FactorChips items={shapPoint} />
            </div>
            <div className="mt-3 space-y-2">
              {shapPoint.map((f) => (
                <FactorRow key={f.feature} f={f} />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm font-light text-gray-500">기여도 데이터가 없습니다.</p>
        )}
      </div>

      {/* 밴드예측 — TFT */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-light uppercase tracking-[0.2em] text-gray-500">
            밴드예측 영향 요인 · TFT
          </div>
          <span className="rounded-full border border-cyan-neon/30 bg-cyan-neon/[0.08] px-2.5 py-0.5 text-[10px] font-light text-cyan-soft">
            변수선택망(VSN)
          </span>
        </div>
        {shapBand.length ? (
          <>
            <div className="mt-3">
              <FactorChips items={shapBand} />
            </div>
            <div className="mt-3 space-y-2">
              {shapBand.map((f) => (
                <FactorRow key={f.feature} f={f} />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm font-light text-gray-500">기여도 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
