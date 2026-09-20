// GitHub Pages 向けのブラウザ版ビルド。
//   npx vite build --config vite.pages.config.ts  → dist-web/
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  publicDir: "public-web", // kuromoji 辞書、効果音
  define: { "import.meta.env.VITE_PLATFORM": JSON.stringify("web") },
  build: {
    outDir: "dist-web",
    target: "es2022",
    chunkSizeWarningLimit: 4000,
  },
  worker: { format: "es" },
  server: { port: 5181, strictPort: true },
});
