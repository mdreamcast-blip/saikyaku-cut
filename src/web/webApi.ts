// ブラウザ版の window.api 実装。Electron の main プロセスがやっていたことを、
// ブラウザの機能(File、Web Worker、WebCodecs)で置き換える。
import type { Api, Line, MediaInfo, Progress, SfxItem, TranscribeOptions } from "../shared/types";
import { chunksToLines, clampLines, textToWordsWith, tokensToChunksWith } from "../shared/segmentCore";
import { getBrowserTokenizer } from "./kuromojiBrowser";
import { exportVideo } from "./exporter";

const BASE = import.meta.env.BASE_URL;
/** 日本語が実用になる範囲で軽いモデル。端末が強ければ small、弱ければ base に落とす */
// 単語ごとの時刻(return_timestamps: "word")が取れるのは、注意機構を書き出した Xenova 版
export const WHISPER_MODEL = "Xenova/whisper-small";

const listeners = new Set<(p: Progress) => void>();
const report = (p: Progress) => listeners.forEach((f) => f(p));

/** 選んだファイルを保持(パスの代わりに object URL を使う) */
const files = new Map<string, File>();
let lastDuration = 0;

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

async function probe(url: string): Promise<{ durationMs: number; isVideo: boolean }> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve({ durationMs: Math.round(v.duration * 1000), isVideo: v.videoWidth > 0 });
    v.onerror = () => resolve({ durationMs: 0, isVideo: false });
    v.src = url;
  });
}

/** メディアを 16kHz モノラルの Float32 に変換(whisper の入力) */
async function decodeTo16k(file: File): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  const buf = await ctx.decodeAudioData(await file.arrayBuffer());
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  await ctx.close();
  return out.getChannelData(0);
}

let worker: Worker | null = null;
let reqId = 0;
function runWhisper(audio: Float32Array, prompt: string): Promise<{ tokens: import("../shared/segmentCore").Token[] }> {
  if (!worker) worker = new Worker(new URL("./transcribeWorker.ts", import.meta.url), { type: "module" });
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      const r = e.data;
      if (r.id !== id) return;
      if (r.type === "progress") report({ stage: "transcribe", ratio: r.ratio, message: r.message });
      if (r.type === "done") { worker!.removeEventListener("message", onMsg); resolve({ tokens: r.tokens }); }
      if (r.type === "error") { worker!.removeEventListener("message", onMsg); reject(new Error(r.message)); }
    };
    worker!.addEventListener("message", onMsg);
    worker!.postMessage({ id, audio, model: WHISPER_MODEL, prompt }, [audio.buffer]);
  });
}

/** File を登録して、画面に渡す情報を返す(「開く」ボタンと、ドラッグ&ドロップ・動作確認から共通で使う) */
async function openFile(f: File): Promise<MediaInfo> {
  const url = URL.createObjectURL(f);
  files.set(url, f);
  const info = await probe(url);
  lastDuration = info.durationMs;
  return { path: url, isVideo: info.isVideo, durationMs: info.durationMs };
}
(window as any).__rcOpenFile = openFile;

export const webApi: Api = {
  pickMedia: async (): Promise<MediaInfo | null> => {
    const f = await pickFile("video/*,audio/*");
    return f ? openFile(f) : null;
  },

  pickSavePath: async (name) => name, // ブラウザではダウンロードになるのでファイル名だけ

  ensureWhisper: async () => ({ ok: true, message: "ブラウザ内で動きます" }),

  transcribe: async (mediaPath: string, opts: TranscribeOptions): Promise<Line[]> => {
    const f = files.get(mediaPath);
    if (!f) throw new Error("ファイルが見つかりません。もう一度「開く」から選んでください。");
    report({ stage: "transcribe", ratio: 0, message: "音声を取り出しています" });
    const audio = await decodeTo16k(f);
    const { tokens } = await runWhisper(audio, opts.dictionary);
    report({ stage: "transcribe", ratio: 0.92, message: "文節に分けています(初回は辞書 17MB を取得)" });
    const tk = await getBrowserTokenizer(BASE);
    let lines = chunksToLines(tokensToChunksWith(tk, tokens), opts.maxCharsPerLine, opts.granularity);
    lines = clampLines(lines, lastDuration);
    report({ stage: "transcribe", ratio: 1, message: `${lines.length} 行になりました` });
    if (opts.diarize) report({ stage: "transcribe", ratio: 1, message: "ブラウザ版では話者分離は使えません(Mac 版をご利用ください)" });
    return lines;
  },

  cutSilence: async (mediaPath) => {
    // v1 では未対応(Mac 版のみ)
    report({ stage: "silence", ratio: 1, message: "ブラウザ版では無音カットはまだ使えません(Mac 版をご利用ください)" });
    const info = await probe(mediaPath);
    return { path: mediaPath, isVideo: info.isVideo, durationMs: info.durationMs, removedMs: 0, segments: 1 };
  },

  render: async (project, outName) => {
    const f = files.get(project.mediaPath);
    if (!f) return { ok: false, message: "ファイルが見つかりません。もう一度「開く」から選んでください。" };
    try {
      const blob = await exportVideo(project, f, (ratio, message) => report({ stage: "render", ratio, message }));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = outName.split("/").pop() || "reel.mp4";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      return { ok: true, message: a.download };
    } catch (e: any) {
      return { ok: false, message: String(e?.message ?? e) };
    }
  },

  resegment: async (text, s, e) => textToWordsWith(await getBrowserTokenizer(BASE), text, s, e),

  onProgress: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },

  toFileUrl: (p) => p,
  sfxUrl: (name) => `${BASE}sfx/${name}.wav`,
  sfxList: async (): Promise<SfxItem[]> => { try { return await (await fetch(`${BASE}sfx/manifest.json`)).json(); } catch { return []; } },
};
