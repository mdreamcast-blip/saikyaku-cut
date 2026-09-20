import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import renderer from "vite-plugin-electron-renderer";

// Remotion のレンダラーや whisper は Node 側(main)でしか動かないので、
// バンドルせず外部依存のまま残す。
const nodeOnly = [
  "@remotion/bundler",
  "@remotion/renderer",
  "@remotion/install-whisper-cpp",
  "@remotion/captions",
  "ffmpeg-static",
  "kuromoji",
  "sherpa-onnx-node", // ネイティブアドオン。バンドルすると壊れる
  "electron",
];

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: { build: { rollupOptions: { external: nodeOnly } } },
      },
      preload: {
        input: "electron/preload.ts",
      },
    }),
    renderer(),
  ],
});
