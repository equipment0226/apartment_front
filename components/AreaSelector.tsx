"use client";

import { AreaItem } from "@/lib/api";
import { eok, pct } from "@/lib/format";

export default function AreaSelector({
  areas,
  selected,
  onSelect,
}: {
  areas: AreaItem[];
  selected: string | null;
  onSelect: (pyeong: string) => void;
}) {
  if (!areas.length) return null;
  return (
    <div className="space-y-3">
      <div className="text-[11px] font-light uppercase tracking-[0.2em] text-gray-500">
        전용면적 선택
      </div>
      <div className="flex flex-wrap gap-2.5">
        {areas.map((a) => {
          const active = selected === a.pyeong;
          const up = (a.ret_p50_pct ?? 0) >= 0;
          return (
            <button
              key={a.pyeong}
              onClick={() => onSelect(a.pyeong)}
              className={`group relative rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? "border-cyan-neon/50 bg-cyan-neon/10 shadow-glow"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              <div className={`num text-base ${active ? "text-cyan-neon" : ""}`}>
                {a.pyeong}
                <span className="ml-0.5 text-xs font-light text-gray-500">㎡</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                <span className="label">{eok(a.current_price_eok)}</span>
                <span className={up ? "text-cyan-soft" : "text-rose-400"}>
                  {pct(a.ret_p50_pct)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
