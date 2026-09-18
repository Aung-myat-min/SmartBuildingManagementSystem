import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The suite covers `src/lib` — the pure rules and the export shaping. Anything
// that needs a browser or Firebase is out of scope here on purpose: those are
// verified by running the app, and mocking them would test the mock.
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
