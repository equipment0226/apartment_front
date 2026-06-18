"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, SearchItem } from "@/lib/api";

export default function SearchBar({
  onSelect,
}: {
  onSelect: (item: SearchItem) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (q.trim().length < 1) {
      setItems([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.search(q.trim());
        setItems(res);
        setOpen(true);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // 드롭다운이 열린 동안 입력창 위치 추적(스크롤/리사이즈)
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (boxRef.current) setRect(boxRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, items.length, loading]);

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-md transition focus-within:border-cyan-neon/40 focus-within:shadow-glow">
        <Search className="h-5 w-5 text-cyan-soft" strokeWidth={1.5} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          placeholder="단지명 · 동 · 구 검색"
          className="w-full bg-transparent text-base font-light text-platinum placeholder:text-gray-500 focus:outline-none"
        />
        {q && (
          <button onClick={() => { setQ(""); setItems([]); }} className="text-gray-500 hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {mounted &&
        open &&
        rect &&
        (items.length > 0 || loading) &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: rect.bottom + 8,
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
            }}
            className="max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-coal/95 p-2 shadow-glow backdrop-blur-xl"
          >
            {loading && <div className="px-4 py-3 text-sm font-light text-gray-500">검색 중…</div>}
            {items.map((it, i) => (
              <button
                key={`${it.gu}-${it.dong}-${it.complex_name}-${i}`}
                onClick={() => {
                  onSelect(it);
                  setQ(it.complex_name);
                  setOpen(false);
                }}
                className="group flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-cyan-neon/10"
              >
                <div>
                  <div className="text-sm font-medium text-platinum group-hover:text-white">
                    {it.complex_name}
                  </div>
                  <div className="text-xs font-light text-gray-500">
                    {it.gu} · {it.dong}
                  </div>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-light text-cyan-soft">
                  {it.area_cnt}개 평형
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
