"use client";

import { GraduationCap, Hammer, MapPin, TrainFront } from "lucide-react";
import { useState } from "react";
import { MapInfo } from "@/lib/api";
import { lineColor, lineLabel } from "@/lib/subway";

const TILE = 256;

/** Web Mercator 투영 (zoom 0 기준, scale=256). */
function project0(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * TILE;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE;
  return { x, y };
}

/** V-World 정적 지도 이미지 URL 생성 (EPSG:4326, center=lng,lat) */
function vworldStaticUrl(
  key: string,
  lng: number,
  lat: number,
  w: number,
  h: number,
  zoom: number
): string {
  const params = new URLSearchParams({
    service: "image",
    request: "GetMap",
    key,
    format: "png",
    basemap: "GRAPHIC",
    crs: "EPSG:4326",
    center: `${lng},${lat}`,
    zoom: String(zoom),
    size: `${w},${h}`,
  });
  return `https://api.vworld.kr/req/image?${params.toString()}`;
}

interface Pt {
  lat: number;
  lng: number;
}

/** 단지를 중심으로, 주어진 점들이 모두 화면에 들어오는 정수 줌을 구한다. */
function fitZoom(center: Pt, pts: Pt[], w: number, h: number, pad = 0.8, minZ = 12, maxZ = 17): number {
  if (!pts.length) return 16;
  const c = project0(center.lat, center.lng);
  let maxDx = 0;
  let maxDy = 0;
  for (const p of pts) {
    const q = project0(p.lat, p.lng);
    maxDx = Math.max(maxDx, Math.abs(q.x - c.x));
    maxDy = Math.max(maxDy, Math.abs(q.y - c.y));
  }
  if (maxDx === 0 && maxDy === 0) return 16;
  const limX = (w / 2) * pad;
  const limY = (h / 2) * pad;
  const zx = maxDx > 0 ? Math.log2(limX / maxDx) : maxZ;
  const zy = maxDy > 0 ? Math.log2(limY / maxDy) : maxZ;
  const z = Math.floor(Math.min(zx, zy));
  return Math.max(minZ, Math.min(maxZ, z));
}

export default function MiniMap({
  map,
  width = 760,
  height = 300,
  label,
  showMarkers = true,
}: {
  map: MapInfo;
  width?: number;
  height?: number;
  label?: string;
  showMarkers?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const hasCoords = map.lat != null && map.lng != null;

  if (!hasCoords) {
    return (
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-deepblue/30 to-black"
        style={{ width: "100%", aspectRatio: `${width} / ${height}` }}
      >
        <span className="text-xs font-light text-gray-500">지도 정보 없음</span>
      </div>
    );
  }

  const center: Pt = { lat: map.lat!, lng: map.lng! };

  // 줌 산정에는 실측 좌표(역/학교/정확한 호재)만 사용. 근사(approx) 호재는 줌을 왜곡하므로 제외.
  const fitPts: Pt[] = showMarkers
    ? [
        ...map.subways.map((s) => ({ lat: s.lat, lng: s.lng })),
        ...map.schools.map((s) => ({ lat: s.lat, lng: s.lng })),
        ...map.catalysts.filter((c) => !c.approx).map((c) => ({ lat: c.lat, lng: c.lng })),
      ]
    : [];
  const zoom = fitZoom(center, fitPts, width, height);

  const c0 = project0(center.lat, center.lng);
  const scale = Math.pow(2, zoom);

  /** 좌표 → 컨테이너 내 % 위치. 화면 밖이면 가장자리로 클램프. */
  function posOf(lat: number, lng: number): { left: number; top: number } {
    const q = project0(lat, lng);
    const dxPx = (q.x - c0.x) * scale;
    const dyPx = (q.y - c0.y) * scale;
    let left = 50 + (dxPx / width) * 100;
    let top = 50 + (dyPx / height) * 100;
    left = Math.max(3, Math.min(97, left));
    top = Math.max(6, Math.min(94, top));
    return { left, top };
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-coal"
      style={{ width: "100%", aspectRatio: `${width} / ${height}` }}
    >
      {!failed ? (
        <img
          src={vworldStaticUrl(map.vworld_key, map.lng!, map.lat!, width, height, zoom)}
          alt="단지 위치 지도"
          className="h-full w-full object-cover opacity-90"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-deepblue/30 to-black">
          <span className="text-xs font-light text-gray-500">지도 이미지를 불러올 수 없습니다</span>
        </div>
      )}

      {/* 다크 비네트 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

      {showMarkers && (
        <>
          {/* 개발 호재 마커 */}
          {map.catalysts.map((c, i) => {
            const p = posOf(c.lat, c.lng);
            return (
              <div
                key={`cat-${i}`}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.left}%`, top: `${p.top}%` }}
                title={c.raw}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border bg-amber-500/90 shadow-lg ${
                    c.approx ? "border-dashed border-amber-100" : "border-amber-100"
                  }`}
                >
                  <Hammer className="h-3.5 w-3.5 text-black" strokeWidth={2.2} />
                </div>
              </div>
            );
          })}

          {/* 초등학교 마커 */}
          {map.schools.map((s, i) => {
            const p = posOf(s.lat, s.lng);
            return (
              <div
                key={`sch-${i}`}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.left}%`, top: `${p.top}%` }}
                title={`${s.name}${s.walk_min ? ` · 도보 ${s.walk_min}분` : ""}`}
              >
                <div className="flex flex-col items-center">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-100 bg-emerald-500/90 shadow-lg">
                    <GraduationCap className="h-3.5 w-3.5 text-black" strokeWidth={2.2} />
                  </div>
                  <span className="mt-0.5 max-w-[72px] truncate rounded bg-black/60 px-1 text-[9px] font-light text-emerald-100">
                    {s.name.replace(/^서울/, "").replace(/초등학교$/, "초")}
                  </span>
                </div>
              </div>
            );
          })}

          {/* 지하철역 마커 */}
          {map.subways.map((s, i) => {
            const p = posOf(s.lat, s.lng);
            return (
              <div
                key={`sub-${i}`}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.left}%`, top: `${p.top}%` }}
                title={`${s.name} ${s.lines.join("·")}${s.walk_min ? ` · 도보 ${s.walk_min}분` : ""}`}
              >
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-0.5 rounded-full border border-white/40 bg-black/70 px-1 py-0.5 shadow-lg">
                    {s.lines.length ? (
                      s.lines.map((ln, k) => (
                        <span
                          key={k}
                          className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                          style={{ backgroundColor: lineColor(ln) }}
                        >
                          {lineLabel(ln)}
                        </span>
                      ))
                    ) : (
                      <TrainFront className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
                    )}
                  </div>
                  <span className="mt-0.5 rounded bg-black/60 px-1 text-[9px] font-light text-gray-200">{s.name}</span>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* 단지 중심 핀 */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-full">
        <MapPin
          className="h-8 w-8 text-cyan-neon drop-shadow-[0_0_8px_rgba(0,229,255,0.9)]"
          fill="rgba(0,229,255,0.3)"
          strokeWidth={2}
        />
      </div>

      {label && (
        <div className="absolute bottom-2 left-3 z-30 text-[11px] font-light text-gray-200 drop-shadow">{label}</div>
      )}

      {/* 범례 */}
      {showMarkers && (
        <div className="absolute right-2 top-2 z-30 flex flex-col gap-1 rounded-lg bg-black/55 px-2 py-1.5 text-[9px] font-light text-gray-200 backdrop-blur">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-cyan-neon" /> 단지
          </span>
          {map.subways.length > 0 && (
            <span className="flex items-center gap-1">
              <TrainFront className="h-3 w-3 text-white" /> 지하철
            </span>
          )}
          {map.schools.length > 0 && (
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3 text-emerald-300" /> 초등학교
            </span>
          )}
          {map.catalysts.length > 0 && (
            <span className="flex items-center gap-1">
              <Hammer className="h-3 w-3 text-amber-300" /> 개발호재
            </span>
          )}
        </div>
      )}
    </div>
  );
}
