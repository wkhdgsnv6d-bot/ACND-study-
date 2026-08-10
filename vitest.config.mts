import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    // Node by default — the engines are pure and need no DOM. Component tests
    // opt in per file with a `// @vitest-environment jsdom` docblock.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    globals: true,
  },
});
