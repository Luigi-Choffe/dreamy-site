import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "tests/components/**/*.test.tsx"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/components/forms/**", "src/components/ui/**"],
    },
  },
});
