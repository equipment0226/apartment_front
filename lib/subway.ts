// 서울 수도권 전철 노선 공식 색상 매핑
// 데이터의 호선 표기(예: "3호선", "수인분당", "신분당")를 색상으로 변환한다.

const LINE_COLORS: Record<string, string> = {
  "1호선": "#0052A4",
  "2호선": "#00A84D",
  "3호선": "#EF7C1C",
  "4호선": "#00A5DE",
  "5호선": "#996CAC",
  "6호선": "#CD7C2F",
  "7호선": "#747F00",
  "8호선": "#E6186C",
  "9호선": "#BDB092",
  수인분당: "#FABE00",
  분당: "#FABE00",
  수인: "#FABE00",
  신분당: "#D4003B",
  경의중앙: "#77C4A3",
  경의: "#77C4A3",
  중앙: "#77C4A3",
  공항철도: "#0090D2",
  공항: "#0090D2",
  경춘: "#0C8E72",
  우이신설: "#B7C452",
  신림: "#6789CA",
  서해: "#8FC31F",
  김포골드: "#A17800",
  김포: "#A17800",
  경강: "#003DA5",
  인천1호선: "#7CA8D5",
  인천2호선: "#ED8B00",
  GTXA: "#9A6292",
};

const DEFAULT_COLOR = "#9CA3AF";

/** 호선명 → 색상 (부분 매칭 지원) */
export function lineColor(line: string): string {
  if (!line) return DEFAULT_COLOR;
  const key = line.replace(/\s/g, "");
  if (LINE_COLORS[key]) return LINE_COLORS[key];
  // "수인분당선", "3호선(분당)" 등 부분 매칭
  for (const name of Object.keys(LINE_COLORS)) {
    if (key.includes(name)) return LINE_COLORS[name];
  }
  return DEFAULT_COLOR;
}

/** 짧은 라벨 (예: "3호선" → "3", "수인분당" → "수인분당") */
export function lineLabel(line: string): string {
  const m = line.match(/^(\d+)호선$/);
  return m ? m[1] : line;
}
