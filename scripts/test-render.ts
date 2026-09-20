// 文字起こし → 書き出し を Electron 抜きで通しで確かめる。
// 実行例: npm run test:render -- samples/sample.mp4 samples/out.mp4
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { runWhisper } from "../electron/services/whisper";
import { chunksToLines, tokensToChunks } from "../electron/services/segment";
import { probe } from "../electron/services/ffmpeg";
import { renderProject } from "../electron/services/render";
import { DEFAULT_PROJECT, type Project } from "../src/shared/types";

const input = path.resolve(process.argv[2] || "samples/sample.mp4");
const output = path.resolve(process.argv[3] || "samples/out.mp4");
const theme = (process.argv[4] || "tempo") as Project["theme"];
const wav = path.join(os.tmpdir(), "rc-test.wav");
execFileSync(ffmpeg as unknown as string, ["-y", "-loglevel", "error", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);

(async () => {
  const info = await probe(input);
  const lines = chunksToLines(await tokensToChunks(await runWhisper(wav, "一行 リール")), 14);
  const project: Project = { ...DEFAULT_PROJECT, sourcePath: input, mediaPath: input, mediaIsVideo: info.isVideo, durationMs: info.durationMs, lines, styleOrder: "rotate", theme };
  console.log(`${lines.length} lines, ${info.durationMs}ms, video=${info.isVideo}`);
  console.time("render");
  let last = "";
  await renderProject(project, output, (p) => { const m = `${p.message}`; if (m !== last) { last = m; console.log(m); } });
  console.timeEnd("render");
  console.log("out:", output, await probe(output));
})().catch((e) => { console.error(e); process.exit(1); });
