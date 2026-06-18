import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QUANT ESTATE · 프리미엄 시세 예측",
  description: "AR → CatBoost → 시나리오 부트스트랩 기반 서울 아파트 10년 시세 예측",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
