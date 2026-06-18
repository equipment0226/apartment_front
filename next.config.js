/** @type {import('next').NextConfig} */
// 백엔드 주소: 기본은 Railway 배포 백엔드, 로컬 개발 시 BACKEND_URL 로 덮어쓴다.
//   예) frontend/.env.local 에  BACKEND_URL=http://127.0.0.1:5000
const BACKEND_URL =
  process.env.BACKEND_URL || "https://apartmentprediction-production.up.railway.app";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
