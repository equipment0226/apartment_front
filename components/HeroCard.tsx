"use client";

import { Calendar, GraduationCap, TrainFront } from "lucide-react";
import { Report } from "@/lib/api";
import { eok, firstStation, pct } from "@/lib/format";
import MiniMap from "./MiniMap";

export default function HeroCard({ report }: { report: Report }) {
  const { listing, detail, map } = report;
  const up = (listing.ret_p50_pct ?? 0) >= 0;
  const station = firstStation(detail.subways);
  const isChopuma = detail.static?.["초품아여부"] === "초품아";

  const badges = [
    detail.approval_year && {
      icon: Calendar,
      text: `${detail.approval_year}년 준공`,
    },
    station && { icon: TrainFront, text: `${station} 역세권` },
    isChopuma && { icon: GraduationCap, text: "초품아" },
  ].filter(Boolean) as { icon: any; text: string }[];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10">
      {/* Hero 배경 — 차가운 건축 그라데이션 */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-deepblue/40 via-black to-black" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(115deg, transparent 0%, rgba(0,229,255,0.10) 45%, transparent 55%), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 64px)",
          }}
        />
        {/* 하단 마스크 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black" />
      </div>

      <div className="relative flex min-h-[340px] flex-col justify-between p-7 sm:p-9">
        {/* 상단: 위치 + 배지 */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-light tracking-[0.25em] text-cyan-soft">
              {listing.si} · {listing.gu}
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tighter text-white sm:text-4xl">
              {listing.complex_name}
            </h1>
            <div className="mt-1 text-sm font-light text-gray-400">
              {listing.dong} · 전용 {listing.pyeong}㎡
            </div>
          </div>
        </div>

        {/* 하단: 가격 + 미니맵 */}
        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-light uppercase tracking-[0.2em] text-gray-500">
              현재 시세
            </div>
            <div className="mt-1 flex items-end gap-3">
              <span className="num text-4xl sm:text-5xl">{eok(listing.current_price_eok)}</span>
              <span className={`mb-1 text-sm font-medium ${up ? "text-cyan-soft" : "text-rose-400"}`}>
                {listing.years}년 {pct(listing.ret_p50_pct)}
              </span>
            </div>

            {/* 배지 */}
            <div className="mt-5 flex flex-wrap gap-2">
              {badges.map((b, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-light text-platinum backdrop-blur-md"
                >
                  <b.icon className="h-3.5 w-3.5 text-cyan-soft" strokeWidth={1.5} />
                  {b.text}
                </span>
              ))}
            </div>
          </div>

          {/* 미니맵 (우측 하단) */}
          <div className="hidden w-40 shrink-0 sm:block">
            <MiniMap
              map={map}
              width={200}
              height={150}
              showMarkers={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
