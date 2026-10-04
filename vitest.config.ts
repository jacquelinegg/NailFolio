import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next's tsconfig uses `jsx: preserve`; tests need the automatic runtime.
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    // jsdom everywhere: the service suites only use fetch/Response/timers, which
    // Vitest keeps from Node even under jsdom.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: [
      "*.test.ts",
      "app/api/**/*.test.ts",
      "services/**/*.test.ts",
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "components/**/*.test.tsx",
      "apps/web/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
