import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { installWhisperCpp, downloadWhisperModel } from "@remotion/install-whisper-cpp";
import type { Line, Progress, TranscribeOptions } from "../../src/shared/types";
import { WHISPER_MODEL, WHISPER_VERSION, modelDir, tmpDir, whisperDir } from "./paths";
import { toWav16k, probe } from "./ffmpeg";
import { chunksToLines, tokensToChunks, type Token } from "./segment";
import { assignSpeakers, diarize, ensureDiarizationModels } from "./diarize";

type Report = (p: Progress) => void;

/** whisper.cpp 本体とモデルを用意する(初回のみ数分)。 */
export async function ensureWhisper(report: Report) {
  report({ stage: "whisper", ratio: 0, message: "whisper.cpp を準備しています(初回はビルドに 30 秒ほど)" });
  installPrebuiltWhisper();
  await installWhisperCpp({ to: whisperDir(), version: WHISPER_VERSION, printOutput: true });
  report({ stage: "whisper", ratio: 0.3, message: `モデル ${WHISPER_MODEL} を確認しています` });
  await downloadWhisperModel({
    model: WHISPER_MODEL,
    folder: modelDir(),
    printOutput: true,
    onProgress: (downloaded, total) =>
      report({ stage: "whisper", ratio: 0.3 + 0.7 * (downloaded / Math.max(1, total)), message: `モデルをダウンロード中 ${Math.round(downloaded / 1048576)}MB / ${Math.round(total / 1048576)}MB` }),
  });
  report({ stage: "whisper", ratio: 1, message: "準備完了" });
}

/**
 * 配布版に同梱したビルド済み whisper(resources/whisper/main)があれば、それを置く。
 * 他の Mac に開発ツール(make / clang)が無くてもビルド不要で動く。
 */
function installPrebuiltWhisper() {
  const exe = whisperExecutable();
  if (fs.existsSync(exe)) return;
  const candidates = [
    path.join(process.resourcesPath ?? "", "whisper"),
    path.join(process.cwd(), "resources/whisper"),
  ];
  const src = candidates.find((d) => fs.existsSync(path.join(d, "main")));
  if (!src) return;
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(path.dirname(exe), f));
  fs.chmodSync(exe, 0o755);
}

/** 1.7.3 以降は build/bin/whisper-cli、それ以前は make が作る main */
function whisperExecutable() {
  const [maj, min, pat] = WHISPER_VERSION.split(".").map(Number);
  const newLayout = maj > 1 || (maj === 1 && (min > 7 || (min === 7 && pat >= 3)));
  return newLayout ? path.join(whisperDir(), "build/bin/whisper-cli") : path.join(whisperDir(), "main");
}

/** メディアを文字起こしして、行(Line)に整形して返す。 */
export async function transcribeToLines(mediaPath: string, opts: TranscribeOptions, report: Report): Promise<Line[]> {
  report({ stage: "transcribe", ratio: 0, message: "音声を取り出しています" });
  const wav = await toWav16k(mediaPath);
  report({ stage: "transcribe", ratio: 0.05, message: "文字起こし中" });
  const tokens = await runWhisper(wav, opts.dictionary, (p) => report({ stage: "transcribe", ratio: 0.05 + 0.8 * p, message: `文字起こし中 ${Math.round(p * 100)}%` }));
  report({ stage: "transcribe", ratio: 0.86, message: "文節に分けています" });
  let lines = chunksToLines(await tokensToChunks(tokens), opts.maxCharsPerLine, opts.granularity ?? "normal");

  // whisper の時刻は末尾で動画の長さを少し超えることがあるので、動画内に収める
  const { durationMs } = await probe(mediaPath);
  if (durationMs > 0) {
    lines = lines
      .filter((l) => l.startMs < durationMs - 100)
      .map((l) => (l.endMs > durationMs ? { ...l, endMs: durationMs, words: l.words.map((w) => ({ ...w, endMs: Math.min(w.endMs, durationMs) })) } : l));
  }

  if (opts.diarize) {
    await ensureDiarizationModels((m, r) => report({ stage: "transcribe", ratio: 0.88 + 0.04 * r, message: m }));
    report({ stage: "transcribe", ratio: 0.92, message: "話者を分けています" });
    const segs = await diarize(wav, opts.numSpeakers);
    lines = assignSpeakers(lines, segs);
    const n = new Set(lines.map((l) => l.speaker)).size;
    report({ stage: "transcribe", ratio: 1, message: `${lines.length} 行・話者 ${n} 人になりました` });
    return lines;
  }
  report({ stage: "transcribe", ratio: 1, message: `${lines.length} 行になりました` });
  return lines;
}

/** 辞書欄の文字列を whisper の --prompt に渡す形にする。 */
export function dictionaryToPrompt(dictionary: string) {
  const words = dictionary.split(/[\s,、]+/).map((w) => w.trim()).filter(Boolean);
  if (!words.length) return "";
  // 「こういう単語が出てくる会話」だとモデルに思わせる。句点で終える方が効く。
  return `${words.join("、")}。`;
}

/**
 * whisper.cpp を直接起動して、トークン単位の時刻を取る。
 *
 * @remotion/install-whisper-cpp の transcribe() を使わない理由:
 * 日本語では 1 つの漢字が複数トークン(UTF-8 の断片)に割れて出てくることがあり、
 * ライブラリは JSON を UTF-8 文字列として読むので断片が "�" に化けて元に戻せない。
 * ここでは JSON を latin1 で読み、バイト列を自分でつなぎ直してから文字にする。
 */
export async function runWhisper(wav: string, dictionary: string, onProgress?: (p: number) => void): Promise<Token[]> {
  const exe = whisperExecutable();
  const model = path.join(modelDir(), `ggml-${WHISPER_MODEL}.bin`);
  const outBase = path.join(tmpDir(), `whisper-${Date.now()}`);
  const args = [
    "-f", wav,
    "-m", model,
    "-l", "ja",
    "--output-json", "--output-file", outBase,
    "--max-len", "1",            // トークンごとに区切る
    "--dtw", "large.v3.turbo",   // 時刻精度を上げる(モデルに合わせる)
    "-pp",                        // 進捗を stderr に出す
    "--flash-attn",
  ];
  const prompt = dictionaryToPrompt(dictionary);
  if (prompt) args.push("--prompt", prompt);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(exe, args, { cwd: whisperDir() });
    let err = "";
    child.stderr.on("data", (d) => {
      const s = String(d);
      err += s;
      const m = /progress\s*=\s*(\d+)%/.exec(s);
      if (m && onProgress) onProgress(Number(m[1]) / 100);
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`whisper.cpp が失敗しました (code ${code})\n${err.slice(-800)}`))));
  });

  const jsonPath = `${outBase}.json`;
  const raw = fs.readFileSync(jsonPath, "latin1"); // バイトを 1 文字 1 バイトのまま保持
  fs.rmSync(jsonPath, { force: true });
  const parsed = JSON.parse(raw) as { transcription: { offsets: { from: number; to: number }; text: string }[] };

  // バイト列をつなぎ直して有効な UTF-8 になった時点で 1 トークンにする
  const dec = new TextDecoder("utf-8", { fatal: true });
  const out: Token[] = [];
  let buf: Buffer = Buffer.alloc(0);
  let start = 0;
  for (const seg of parsed.transcription) {
    const bytes = Buffer.from(seg.text, "latin1");
    if (buf.length === 0) start = seg.offsets.from;
    buf = Buffer.concat([buf, bytes]);
    let text: string;
    try {
      text = dec.decode(buf);
    } catch {
      continue; // まだ断片。次のトークンと合わせる
    }
    buf = Buffer.alloc(0);
    text = text.replace(/\[_[A-Z_]+\]/g, ""); // [_BEG_] などの制御トークン
    if (!text.trim()) continue;
    out.push({ text: text.replace(/^\s+/, ""), startMs: start, endMs: Math.max(seg.offsets.to, start + 60) });
  }
  return out;
}
