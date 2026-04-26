import { defineConfig } from "vite";

export default defineConfig({
  // Make `vite build` output work when opened from a subpath / file host
  base: "./",
  server: {
    port: 5173,
    strictPort: true
  }
});

