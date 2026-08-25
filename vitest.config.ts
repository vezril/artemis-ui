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
  // Use React's automatic JSX runtime so component tests need no `import React`.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Default to node (the parser test); component tests opt into jsdom via a
    // `// @vitest-environment jsdom` docblock.
    environment: "node",
  },
});
