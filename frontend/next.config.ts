import type { NextConfig } from "next";

// E2E가 다른 워크트리(다른 체크아웃)의 dev 서버를 실수로 재사용하는 사고를 막기
// 위한 식별자. 워크트리마다 절대경로가 다르므로, 이 값으로 "지금 응답한 서버가
// 정말 이 체크아웃의 코드인지"를 검증할 수 있다. frontend/e2e/auth.setup.ts 의
// 가드가 이 헤더를 읽는다. (frontend/playwright.config.ts 참고)
// 슬래시로 정규화: Windows 경로의 백슬래시가 HTTP 헤더 값 직렬화 과정에서
// 유실되는 게 실측으로 확인돼(Node 응답 헤더 왕복 시 `\`가 임의로 사라짐),
// 백슬래시 자체를 아예 안 쓴다.
const CHECKOUT_ROOT = process.cwd().replace(/\\/g, "/");

const nextConfig: NextConfig = {
  async headers() {
    // `next build`가 headers()를 routes-manifest.json에 정적으로 구워 넣으므로, 이 가드가
    // 없으면 프로덕션 응답(및 `/:path*`이 매칭하는 /_next/static/* 자산까지) 전부에 빌드
    // 머신의 절대 경로가 노출된다. 이 헤더는 E2E가 로컬 dev 서버를 식별하기 위한 진단용일
    // 뿐이므로 프로덕션 빌드에서는 아예 빼야 한다.
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "x-egong-checkout-root", value: CHECKOUT_ROOT }],
      },
    ];
  },
};

export default nextConfig;
