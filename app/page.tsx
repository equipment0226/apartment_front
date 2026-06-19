"use client";

import { ArrowRight, Building2, LineChart, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 pb-20 pt-10 sm:px-8">
      {/* 헤더 */}
      <header className="mb-12 flex items-center justify-between">
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
          BVAR-X · TFT · Block Bootstrap
        </div>
      </header>

      {/* 타이틀 */}
      <section className="flex flex-1 flex-col justify-center">
        <div className="animate-fadeup">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-neon/25 bg-cyan-neon/[0.06] px-3 py-1.5 text-[11px] font-light tracking-wide text-cyan-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-neon shadow-glow" />
            AI 생성 시나리오 분석
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tighter text-white sm:text-4xl">
            AI 생성 시나리오 기반
            <br />
            <span className="text-cyan-neon">확률 분포형</span> 부동산 예측
          </h1>
          <p className="mt-4 max-w-xl text-sm font-light leading-relaxed text-gray-400">
            수백~수천 개의 생성 시나리오로 서울 부동산의 향후 1년 흐름을 확률 분포로
            예측합니다. 분석 단위를 선택해 시작하세요.
          </p>
        </div>

        {/* 두 개의 진입 버튼 */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* 우리 구 전망 분석 (지수 기반) */}
          <Link
            href="/district"
            className="group glass relative overflow-hidden p-6 transition hover:border-cyan-neon/40 hover:shadow-glow"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-neon/30 bg-cyan-neon/[0.06]">
              <LineChart className="h-5 w-5 text-cyan-neon" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">우리 구 전망 분석</h2>
            <p className="mt-1 text-[11px] font-light uppercase tracking-[0.2em] text-cyan-soft">
              Index · 지수 기반
            </p>
            <p className="mt-3 text-sm font-light leading-relaxed text-gray-400">
              서울 25개 구의 아파트 매매가격지수를 전망합니다.
            </p>
            <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-cyan-neon">
              분석 시작 <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>

          {/* 우리 단지 전망 분석 (시세 기반) */}
          <Link
            href="/complex"
            className="group glass relative overflow-hidden p-6 transition hover:border-cyan-neon/40 hover:shadow-glow"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-platinum/30 bg-white/[0.04]">
              <Building2 className="h-5 w-5 text-platinum" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">우리 단지 전망 분석</h2>
            <p className="mt-1 text-[11px] font-light uppercase tracking-[0.2em] text-gray-400">
              Price · 시세 기반
            </p>
            <p className="mt-3 text-sm font-light leading-relaxed text-gray-400">
              개별 단지·평형의 실거래 시세를 전망합니다.
            </p>
            <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-platinum">
              분석 시작 <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </section>

      <footer className="mt-16 border-t border-white/[0.06] pt-6 text-center text-[11px] font-light text-gray-600">
        본 분석은 통계적 예측이며 투자 권유가 아닙니다 · QUANT ESTATE
      </footer>
    </main>
  );
}
