// UI 確認用: Electron 抜きでブラウザに画面だけ出す設定。
// window.api が無いので src/renderer/mockApi.ts が代わりに動く。
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: "samples", // /sample.mp4 などをそのまま配信
  server: { port: 5180, strictPort: true },
});
