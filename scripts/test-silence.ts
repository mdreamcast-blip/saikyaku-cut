// 無音検出とジャンプカットを Electron 抜きで確かめる。
// 実行例: npm run test:silence -- samples/pause.mp4
import path from "node:path";
import { probe, detectSpeechSegments, cutToSegments } from "../electron/services/ffmpeg";
import { DEFAULT_SILENCE } from "../src/shared/types";

const input = path.resolve(process.argv[2] || "samples/pause.mp4");

(async () => {
  const info = await probe(input);
  console.log("probe:", info);
  const segs = await detectSpeechSegments(input, DEFAULT_SILENCE, info.durationMs);
  console.log("keep segments:", segs.map((s) => `${s.startMs}-${s.endMs}`).join(", "));
  const kept = segs.reduce((n, s) => n + (s.endMs - s.startMs), 0);
  console.log(`removed: ${info.durationMs - kept}ms of ${info.durationMs}ms`);
  console.time("cut");
  const out = await cutToSegments(input, segs, info.isVideo, (r) => process.stdout.write(`\r${Math.round(r * 100)}%`));
  console.timeEnd("cut");
  console.log("out:", out, await probe(out));
})().catch((e) => { console.error(e); process.exit(1); });
