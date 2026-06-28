import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // legacy-kindergarten/은 폐기된 컨셉 백업본 — 모듈 경로가 깨져 있어 테스트 대상에서 제외한다.
    exclude: ["**/node_modules/**", "legacy-kindergarten/**"],
  },
});
