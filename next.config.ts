import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E 테스트 서버는 개발 서버와 빌드 디렉터리를 분리한다 (동시 실행 가능)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  // 화면을 역할별로 재구성하기 전의 주소로 들어와도 새 화면으로 연결한다
  async redirects() {
    return [
      { source: "/campaigns", destination: "/advertiser", permanent: false },
      { source: "/shopping", destination: "/consumer", permanent: false },
      { source: "/dashboard", destination: "/verifier", permanent: false },
      { source: "/policy", destination: "/", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
