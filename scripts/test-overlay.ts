import path from "node:path";
import { probe } from "../electron/services/ffmpeg";
import { renderProject } from "../electron/services/render";
import { DEFAULT_OVERLAY, DEFAULT_PROJECT, type Project } from "../src/shared/types";
const input = path.resolve("samples/sample.mp4");
(async () => {
  const info = await probe(input);
  const project: Project = {
    ...DEFAULT_PROJECT, sourcePath: input, mediaPath: input, mediaIsVideo: true, durationMs: 5000, theme: "pop",
    lines: [{ id: "1", text: "字幕はここ", startMs: 500, endMs: 4500, words: [{ text: "字幕は", startMs: 500, endMs: 2500 }, { text: "ここ", startMs: 2500, endMs: 4500 }], fontScale: 1.2, offsetY: 300, sfx: "bishi" }],
    overlays: [
      { ...DEFAULT_OVERLAY, id: "a", text: "タイトル", startMs: 0, endMs: 5000, y: 0.15, fontSize: 140, color: "#FFE600", sfx: "dosu" },
      { ...DEFAULT_OVERLAY, id: "b", text: "右下の注釈\n2行目", startMs: 1000, endMs: 5000, x: 0.7, y: 0.85, fontSize: 60, background: "#000000cc", animation: "slideUp", fontFamily: "Zen Old Mincho" },
    ],
  };
  await renderProject(project, path.resolve("samples/out_overlay.mp4"), () => {});
  console.log("done", await probe(path.resolve("samples/out_overlay.mp4")), info.durationMs);
})().catch((e) => { console.error(e); process.exit(1); });
