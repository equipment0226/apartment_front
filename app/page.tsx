"use client";

import { Building2, Loader2, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, AreaItem, Report, SearchItem } from "@/lib/api";
import SearchBar from "@/components/SearchBar";
import FilterCascade, { Selection } from "@/components/FilterCascade";
import AreaSelector from "@/components/AreaSelector";
import PeriodSlider from "@/components/PeriodSlider";
import HeroCard from "@/components/HeroCard";
import ClusterTabs from "@/components/ClusterTabs";
import AiInsight from "@/components/AiInsight";
import ChartsSection from "@/components/ChartsSection";
import ComplexInfo from "@/components/ComplexInfo";

export default function Home() {
  const [selection, setSelection] = useState<Selection>({});
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [pyeong, setPyeong] = useState<string | null>(null);
  const [years, setYears] = useState(3); // 기본 분석 기간 3년
  const [report, setReport] = useState<Report | null>(null);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // 단지 확정 시 평형 목록 로드
  const loadAreas = useCallback(async (gu: string, dong: string, complex_name: string) => {
    setLoadingAreas(true);
    setAreas([]);
    setPyeong(null);
    setYears(3); // 새 단지 선택 시 기본 기간(3년)으로 리셋
    setReport(null);
    try {
      const res = await api.areas(gu, dong, complex_name);
      setAreas(res);
      if (res.length) setPyeong(res[0].pyeong); // 첫 평형 자동 선택
    } catch {
      setAreas([]);
    } finally {
      setLoadingAreas(false);
    }
  }, []);

  // 검색 선택
  const onSearchSelect = (item: SearchItem) => {
    const sel: Selection = {
      si: item.si,
      gu: item.gu,
      dong: item.dong,
      complex_name: item.complex_name,
    };
    setSelection(sel);
    loadAreas(item.gu, item.dong, item.complex_name);
  };

  // 필터 변경
  const onFilterChange = (sel: Selection) => {
    setSelection(sel);
    if (sel.gu && sel.dong && sel.complex_name) {
      loadAreas(sel.gu, sel.dong, sel.complex_name);
    } else {
      setAreas([]);
      setPyeong(null);
      setReport(null);
    }
  };

  // 평형 선택 + 기간 → 리포트 로드 (기간 변경 시 디바운스)
  useEffect(() => {
    if (!(selection.gu && selection.dong && selection.complex_name && pyeong)) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoadingReport(true);
      (async () => {
        try {
          const res = await api.report(
            selection.gu!,
            selection.dong!,
            selection.complex_name!,
            pyeong,
            years * 12
          );
          if (!cancelled) setReport(res);
        } catch {
          if (!cancelled) setReport(null);
        } finally {
          if (!cancelled) setLoadingReport(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [selection.gu, selection.dong, selection.complex_name, pyeong, years]);

  // 리포트가 새 매물(평형)로 로드될 때만 스크롤 (기간 변경 시엔 유지)
  const scrolledKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!report) return;
    const key = `${report.listing.complex_name}|${report.listing.pyeong}`;
    if (scrolledKeyRef.current === key) return;
    scrolledKeyRef.current = key;
    reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [report]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 pb-28 pt-10 sm:px-8">
      {/* 헤더 */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-neon/30 bg-cyan-neon/[0.06] shadow-glow">
            <TrendingUp className="h-5 w-5 text-cyan-neon" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">QUANT ESTATE</div>
            <div className="text-[10px] font-light uppercase tracking-[0.25em] text-gray-500">
              Seoul Price Forecast
            </div>
          </div>
        </div>
        <div className="hidden text-right text-[10px] font-light text-gray-600 sm:block">
          AR · CatBoost · Block Bootstrap
        </div>
      </header>

      {/* 섹션 1: 검색 + 필터 + 평형 */}
      <section className="relative z-40 space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter text-white sm:text-3xl">
            10년 시세를 <span className="text-cyan-neon">시나리오</span>로 읽다
          </h2>
          <p className="mt-2 text-sm font-light text-gray-400">
            서울 아파트의 향후 120개월 가격을 수백 개의 시나리오로 예측합니다.
          </p>
        </div>

        <SearchBar onSelect={onSearchSelect} />

        <div className="glass-soft p-4">
          <div className="mb-3 text-[11px] font-light uppercase tracking-[0.2em] text-gray-500">
            지역으로 찾기
          </div>
          <FilterCascade value={selection} onChange={onFilterChange} />
        </div>

        {loadingAreas && (
          <div className="flex items-center gap-2 px-1 text-sm font-light text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-soft" /> 평형 정보를 불러오는 중…
          </div>
        )}
        {areas.length > 0 && (
          <div className="glass-soft p-5">
            <AreaSelector areas={areas} selected={pyeong} onSelect={setPyeong} />
          </div>
        )}

        {/* 평형 선택 후 분석 기간 슬라이더 */}
        {areas.length > 0 && pyeong && (
          <PeriodSlider years={years} onChange={setYears} />
        )}
      </section>

      {/* 리포트 */}
      <div ref={reportRef} className="relative z-0 scroll-mt-6">
        {loadingReport && (
          <div className="mt-10 flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-neon" />
            <span className="text-sm font-light text-gray-400">리포트를 생성하고 있습니다…</span>
          </div>
        )}

        {report && !loadingReport && (
          <div className="mt-10 space-y-6 animate-fadeup">
            {/* 섹션 1: Hero */}
            <HeroCard report={report} />

            {/* 섹션 2: 군집 + AI */}
            <ClusterTabs
              cluster={report.cluster}
              years={report.listing.years}
              nScenarios={report.listing.n_scenarios}
            />
            <AiInsight report={report} />

            {/* 섹션 3 & 4: 차트 + 슬라이더 */}
            <ChartsSection report={report} />

            {/* 단지 정보 */}
            <ComplexInfo report={report} />
          </div>
        )}

        {!report && !loadingReport && !loadingAreas && areas.length === 0 && (
          <div className="mt-16 flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Building2 className="h-10 w-10 text-gray-700" strokeWidth={1} />
            <p className="text-sm font-light text-gray-500">
              단지를 검색하거나 지역을 선택해 분석을 시작하세요.
            </p>
          </div>
        )}
      </div>

      <footer className="mt-16 border-t border-white/[0.06] pt-6 text-center text-[11px] font-light text-gray-600">
        본 분석은 통계적 예측이며 투자 권유가 아닙니다 · QUANT ESTATE
      </footer>
    </main>
  );
}
