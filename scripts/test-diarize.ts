// 話者分離を Electron 抜きで確かめる。
// 実行例: npm run test:diarize -- samples/two.wav 2
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { diarize, assignSpeakers, ensureDiarizationModels } from "../electron/services/diarize";
import { runWhisper } from "../electron/services/whisper";
import { chunksToLines, tokensToChunks } from "../electron/services/segment";

const input = path.resolve(process.argv[2] || "samples/two.wav");
const n = Number(process.argv[3] || 0);
const wav = path.join(os.tmpdir(), "rc-diar.wav");
execFileSync(ffmpeg as unknown as string, ["-y", "-loglevel", "error", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);

(async () => {
  await ensureDiarizationModels((m, r) => console.log(m, r));
  console.time("diarize");
  const segs = await diarize(wav, n, { embModel: process.env.RC_EMB || undefined, threshold: Number(process.env.RC_TH || 0.5) });
  console.timeEnd("diarize");
  console.log(segs.map((s) => `S${s.speaker} ${s.startMs}-${s.endMs}`).join("\n"));
  const lines = chunksToLines(await tokensToChunks(await runWhisper(wav, "")), 14);
  for (const l of assignSpeakers(lines, segs)) console.log(`話者${(l as any).speaker + 1} ${l.startMs}-${l.endMs} ${l.text}`);
})().catch((e) => { console.error(e); process.exit(1); });
