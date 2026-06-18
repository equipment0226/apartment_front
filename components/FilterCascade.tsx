"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";

export interface Selection {
  si?: string;
  gu?: string;
  dong?: string;
  complex_name?: string;
}

const LEVELS: { key: keyof Selection; label: string }[] = [
  { key: "si", label: "시/도" },
  { key: "gu", label: "구" },
  { key: "dong", label: "동" },
  { key: "complex_name", label: "단지" },
];

export default function FilterCascade({
  value,
  onChange,
}: {
  value: Selection;
  onChange: (s: Selection) => void;
}) {
  const [opts, setOpts] = useState<Record<string, string[]>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  // 드롭다운이 열려 있는 동안 버튼 위치 추적(스크롤/리사이즈) 및 바깥 클릭 시 닫기
  useEffect(() => {
    if (!openKey) return;
    const update = () => {
      const el = btnRefs.current[openKey];
      if (el) setRect(el.getBoundingClientRect());
    };
    update();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (btnRefs.current[openKey]?.contains(t)) return;
      setOpenKey(null);
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", onDown);
    };
  }, [openKey]);

  // 각 단계 옵션 로드
  async function load(level: keyof Selection, base: Selection) {
    const params: Record<string, string> = {};
    if (base.si) params.si = base.si;
    if (base.gu) params.gu = base.gu;
    if (base.dong) params.dong = base.dong;
    try {
      const res = await api.filters(params);
      setOpts((o) => ({ ...o, [level]: res.options }));
    } catch {
      setOpts((o) => ({ ...o, [level]: [] }));
    }
  }

  useEffect(() => {
    load("si", {});
  }, []);

  function pick(level: keyof Selection, option: string) {
    const idx = LEVELS.findIndex((l) => l.key === level);
    const next: Selection = { ...value };
    next[level] = option;
    // 하위 단계 초기화
    LEVELS.slice(idx + 1).forEach((l) => delete next[l.key]);
    onChange(next);
    setOpenKey(null);
    // 다음 단계 옵션 미리 로드
    const nextLevel = LEVELS[idx + 1];
    if (nextLevel) load(nextLevel.key, next);
  }

  function disabled(idx: number): boolean {
    if (idx === 0) return false;
    const prev = LEVELS[idx - 1].key;
    return !value[prev];
  }

  const openLevelKey = openKey as keyof Selection | null;
  const openList = openKey ? opts[openKey] || [] : [];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {LEVELS.map((lv, idx) => {
        const selected = value[lv.key];
        const isOpen = openKey === lv.key;
        const list = opts[lv.key] || [];
        const dis = disabled(idx);
        return (
          <div key={lv.key} className="relative">
            <button
              ref={(el) => {
                btnRefs.current[lv.key] = el;
              }}
              disabled={dis}
              onClick={() => {
                if (dis) return;
                if (!list.length) load(lv.key, value);
                setOpenKey(isOpen ? null : lv.key);
              }}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                dis
                  ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-gray-600"
                  : selected
                  ? "border-cyan-neon/40 bg-cyan-neon/5 text-white shadow-glow"
                  : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20"
              }`}
            >
              <span className="truncate">
                <span className="block text-[10px] font-light uppercase tracking-wider text-gray-500">
                  {lv.label}
                </span>
                <span className="truncate font-medium">{selected || "선택"}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition ${isOpen ? "rotate-180 text-cyan-soft" : "text-gray-500"}`}
              />
            </button>
          </div>
        );
      })}
      {mounted &&
        openKey &&
        rect &&
        openLevelKey &&
        openList.length > 0 &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: rect.bottom + 8,
              left: rect.left,
              width: Math.max(rect.width, 180),
              zIndex: 9999,
            }}
            className="max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-coal/95 p-2 shadow-glow backdrop-blur-xl"
          >
            {openList.map((o) => (
              <button
                key={o}
                onClick={() => pick(openLevelKey, o)}
                className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition hover:bg-cyan-neon/10 ${
                  value[openLevelKey] === o ? "text-cyan-neon" : "text-gray-300"
                }`}
              >
                {o}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
