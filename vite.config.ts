import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "/the-situation-room/",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  envPrefix: ["VITE_"],
  // MapLibre GL v5 uses class static fields — ES2022 target prevents
  // esbuild from emitting __publicField helpers that break in workers
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("maplibre-gl") || id.includes("react-map-gl")) return "maplibre";
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/date-fns/") || id.includes("node_modules/lucide-react/")) return "vendor";
        },
      },
    },
  },
  optimizeDeps: { esbuildOptions: { target: "es2022" } },
});
