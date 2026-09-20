// whisper を直接動かして、文節分けと行分けの結果を見る(Electron 抜き)。
// 実行例: npm run test:group -- samples/sample.aiff 14 "リール 字幕"
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { runWhisper } from "../electron/services/whisper";
import { chunksToLines, tokensToChunks } from "../electron/services/segment";

const input = path.resolve(process.argv[2] || "samples/sample.aiff");
const maxChars = Number(process.argv[3] || 14);
const dictionary = process.argv[4] || "";
const wav = path.join(os.tmpdir(), "rc-test.wav");
execFileSync(ffmpeg as unknown as string, ["-y", "-loglevel", "error", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);

(async () => {
  console.time("whisper");
  const tokens = await runWhisper(wav, dictionary);
  console.timeEnd("whisper");
  console.log("tokens:", tokens.map((t) => t.text).join("|"));
  console.time("kuromoji");
  const chunks = await tokensToChunks(tokens);
  console.timeEnd("kuromoji");
  console.log("chunks:", chunks.map((c) => c.text).join("|"));
  const lines = chunksToLines(chunks, maxChars, (process.env.RC_GRAN as any) || "fine");
  for (const l of lines) {
    console.log(`${String(l.startMs).padStart(6)}-${String(l.endMs).padStart(6)} 「${l.text}」  ${l.words.map((w) => w.text).join("/")}`);
  }
  if (process.env.RC_JSON) {
    const fs = await import("node:fs");
    fs.writeFileSync(process.env.RC_JSON, JSON.stringify(lines, null, 1));
    console.log("saved", process.env.RC_JSON);
  }
})();
