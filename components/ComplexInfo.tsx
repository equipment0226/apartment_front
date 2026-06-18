"use client";

import { Building2, ChevronDown, GraduationCap, Hammer, MapPin, Sparkles, TrainFront, Users } from "lucide-react";
import { useState } from "react";
import { Report } from "@/lib/api";
import { parseSubways } from "@/lib/format";
import MiniMap from "./MiniMap";

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] py-3 last:border-0">
      <span className="flex items-center gap-2 text-sm font-light text-gray-400">
        <Icon className="h-4 w-4 text-cyan-soft" strokeWidth={1.5} />
        {label}
      </span>
      <span className="text-sm font-medium text-platinum">{value || "-"}</span>
    </div>
  );
}

export default function ComplexInfo({ report }: { report: Report }) {
  const { listing, detail, map } = report;
  const [open, setOpen] = useState(false);
  const subways = parseSubways(detail.subways);
  const catalysts = [detail.rail_catalyst, detail.devel_catalyst].filter(Boolean) as string[];

  return (
    <div className="glass overflow-hidden">
      <div className="p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-cyan-soft" />
          <h3 className="text-lg font-semibold text-white">단지 정보</h3>
        </div>
        <div className="mt-1 text-sm font-light text-gray-500">{map.address}</div>

        {/* V-World 지도 */}
        <div className="mt-5">
          <MiniMap
            map={map}
            width={760}
            height={300}
            label={`${listing.dong} ${listing.complex_name}`}
          />
        </div>

        {/* 핵심 3정보 */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { icon: "y", label: "준공", value: detail.approval_year ? `${detail.approval_year}년` : "-" },
            { icon: "h", label: "세대수", value: detail.household ? `${detail.household}세대` : "-" },
            { icon: "b", label: "건설사", value: detail.builder || "-" },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <div className="text-[11px] font-light text-gray-500">{c.label}</div>
              <div className="mt-1 truncate text-sm font-semibold text-white" title={c.value}>
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* 펼치기 토글 */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] py-3 text-sm font-light text-gray-300 transition hover:border-white/20"
        >
          {open ? "접기" : "상세 정보 펼치기"}
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* 펼침 영역 */}
      {open && (
        <div className="animate-fadeup border-t border-white/[0.06] bg-black/20 p-6 sm:p-7">
          <Row icon={Building2} label="준공년도" value={detail.approval_year ? `${detail.approval_year}년` : "-"} />
          <Row icon={Users} label="총 세대수" value={detail.household ? `${detail.household}세대` : "-"} />
          <Row icon={Hammer} label="시공 건설사" value={detail.builder || "-"} />
          <Row icon={GraduationCap} label="인근 초등학교" value={detail.elementary_schools || "-"} />

          {subways.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-light text-gray-400">
                <TrainFront className="h-4 w-4 text-cyan-soft" strokeWidth={1.5} /> 지하철
              </div>
              <div className="flex flex-wrap gap-2">
                {subways.map((s, i) => (
                  <span key={i} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-light text-gray-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {catalysts.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-light text-gray-400">
                <Sparkles className="h-4 w-4 text-cyan-soft" strokeWidth={1.5} /> 개발 호재
              </div>
              <div className="space-y-2">
                {catalysts.map((c, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-xs font-light leading-relaxed text-gray-300">
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
