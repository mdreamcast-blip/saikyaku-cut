import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import type { SilenceOptions } from "../../src/shared/types";
import { tmpDir } from "./paths";

const run = promisify(execFile);

// asar に入ると実行できないので unpacked 側を指す
export const FFMPEG = (ffmpegStatic as unknown as string).replace("app.asar", "app.asar.unpacked");

/** whisper.cpp 用に 16kHz モノラル wav へ変換する。 */
export async function toWav16k(input: string): Promise<string> {
  const out = path.join(tmpDir(), `${path.parse(input).name}-${Date.now()}.wav`);
  await run(FFMPEG, ["-y", "-loglevel", "error", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", out]);
  return out;
}

/** ffmpeg の stderr を返す(出力先なしで起動すると即終了し、メディア情報だけが得られる)。 */
async function probeStderr(input: string): Promise<string> {
  try {
    const r = await run(FFMPEG, ["-hide_banner", "-i", input], { maxBuffer: 16 * 1024 * 1024 });
    return r.stderr;
  } catch (e: any) {
    // 「出力ファイルが指定されていない」で終了コード 1 になるのが正常
    return String(e.stderr ?? "");
  }
}

/** 長さ(ms)と映像ストリームの有無。 */
export async function probe(input: string): Promise<{ durationMs: number; isVideo: boolean }> {
  const stderr = await probeStderr(input);
  const m = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/.exec(stderr);
  const durationMs = m ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + Number(m[4].padEnd(3, "0").slice(0, 3)) : 0;
  // カバーアート(png/mjpeg の 1 枚絵)は動画扱いにしない
  const isVideo = /Stream #\d+:\d+.*Video: (?!png|mjpeg)/.test(stderr);
  return { durationMs, isVideo };
}

export type Segment = { startMs: number; endMs: number };

/** 無音区間を検出して、残す区間(声のある区間)の一覧を返す。 */
export async function detectSpeechSegments(input: string, opts: SilenceOptions, durationMs: number): Promise<Segment[]> {
  const { stderr } = await run(
    FFMPEG,
    ["-hide_banner", "-i", input, "-vn", "-af", `silencedetect=noise=${opts.thresholdDb}dB:d=${opts.minSilenceMs / 1000}`, "-f", "null", "-"],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const silences: Segment[] = [];
  let start: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = /silence_start:\s*([\d.]+)/.exec(line);
    const e = /silence_end:\s*([\d.]+)/.exec(line);
    if (s) start = Math.round(parseFloat(s[1]) * 1000);
    if (e && start !== null) {
      silences.push({ startMs: start, endMs: Math.round(parseFloat(e[1]) * 1000) });
      start = null;
    }
  }
  if (start !== null) silences.push({ startMs: start, endMs: durationMs }); // 末尾まで無音

  // 無音の両端に余白を残し、余白を引いてもまだ minSilenceMs 以上あるものだけ削る
  const cuts = silences
    .map((s) => ({ startMs: s.startMs + opts.paddingMs, endMs: s.endMs - opts.paddingMs }))
    .filter((s) => s.endMs - s.startMs >= opts.minSilenceMs);

  const keep: Segment[] = [];
  let cursor = 0;
  for (const c of cuts) {
    if (c.startMs > cursor) keep.push({ startMs: cursor, endMs: c.startMs });
    cursor = Math.max(cursor, c.endMs);
  }
  if (cursor < durationMs) keep.push({ startMs: cursor, endMs: durationMs });
  return keep.filter((k) => k.endMs - k.startMs > 80);
}

/**
 * 残す区間だけをつないだファイルを作る(ジャンプカット)。
 * trim/atrim + concat で 1 パス。映像は再エンコードするので長い動画は時間がかかる。
 */
export async function cutToSegments(
  input: string,
  segments: Segment[],
  isVideo: boolean,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const total = segments.reduce((n, s) => n + (s.endMs - s.startMs), 0);
  const out = path.join(tmpDir(), `${path.parse(input).name}-cut-${Date.now()}.${isVideo ? "mp4" : "m4a"}`);

  const parts: string[] = [];
  const labels: string[] = [];
  segments.forEach((s, i) => {
    const a = (s.startMs / 1000).toFixed(3);
    const b = (s.endMs / 1000).toFixed(3);
    if (isVideo) {
      parts.push(`[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[v${i}]`);
      labels.push(`[v${i}]`);
    }
    parts.push(`[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS[a${i}]`);
    labels.push(`[a${i}]`);
  });
  const concat = `${labels.join("")}concat=n=${segments.length}:v=${isVideo ? 1 : 0}:a=1${isVideo ? "[v][a]" : "[a]"}`;
  const filter = [...parts, concat].join(";");

  const args = ["-y", "-hide_banner", "-i", input, "-filter_complex", filter];
  if (isVideo) args.push("-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p");
  else args.push("-map", "[a]");
  args.push("-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(FFMPEG, args);
    let err = "";
    child.stderr.on("data", (d) => {
      const s = String(d);
      err += s;
      const m = /time=(\d+):(\d+):(\d+)\.(\d+)/.exec(s);
      if (m && onProgress) {
        const ms = (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + +m[4] * 10;
        onProgress(Math.min(1, ms / Math.max(1, total)));
      }
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg が失敗しました (code ${code})\n${err.slice(-600)}`))));
  });
  return out;
}
