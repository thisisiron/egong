import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // DDD 데이터 접근 원칙(DAL) 강제:
  // app/** 페이지·컴포넌트·액션은 Supabase 클라이언트를 직접 import하지 말고
  // lib/<domain>/service.ts(읽기)·actions.ts(쓰기)를 거칠 것. (CLAUDE.md "데이터 접근 원칙" 참조)
  // 현재 warn — 그림자 도메인 승격이 끝나면 error로 격상 예정.
  // 예외: app/(auth)/login, app/auth/logout 등 세션 인증 인프라는 인라인 eslint-disable로 허용.
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/lib/supabase/server"],
              message:
                "DDD 데이터 접근 원칙: 페이지·컴포넌트·액션에서 createClient를 직접 import하지 마세요. lib/<domain>/service.ts(읽기)·actions.ts(쓰기)를 거칠 것. (CLAUDE.md '데이터 접근 원칙' 참조)",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
