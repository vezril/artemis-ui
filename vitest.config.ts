import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Vitest for the pure client-side logic (the Prometheus parser). Resolves the
 *  `@/*` path alias the same way tsconfig does. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
