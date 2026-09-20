import fs from "node:fs";
import path from "node:path";
import type { Line } from "../../src/shared/types";
import { dataDir } from "./paths";

/** 話者ごとの区間。speaker は 0 始まりの番号。 */
export type SpeakerSegment = { startMs: number; endMs: number; speaker: number };

const MODEL_DIR = () => dataDir("diarization-models");
const SEG_MODEL = () => path.join(MODEL_DIR(), "sherpa-onnx-pyannote-segmentation-3-0/model.onnx");
const EMB_MODEL = () => path.join(MODEL_DIR(), "3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx");

const SEG_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2";
const EMB_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx";

export function diarizationModelsReady() {
  return fs.existsSync(SEG_MODEL()) && fs.existsSync(EMB_MODEL());
}

/** モデル(約 45MB)を初回だけダウンロードする。 */
export async function ensureDiarizationModels(report: (msg: string, ratio: number) => void) {
  if (diarizationModelsReady()) return;
  const dir = MODEL_DIR();
  report("話者分離モデルをダウンロード中(初回のみ・約 45MB)", 0);
  if (!fs.existsSync(SEG_MODEL())) {
    const tar = path.join(dir, "seg.tar.bz2");
    await download(SEG_URL, tar);
    const { execFileSync } = await import("node:child_process");
    execFileSync("tar", ["xjf", tar, "-C", dir]);
    fs.rmSync(tar, { force: true });
  }
  report("話者分離モデルをダウンロード中(初回のみ・約 45MB)", 0.3);
  if (!fs.existsSync(EMB_MODEL())) await download(EMB_URL, EMB_MODEL());
  report("話者分離モデルの準備完了", 1);
}

async function download(url: string, to: string) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`ダウンロードに失敗しました: ${url} (${res.status})`);
  fs.writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}

/**
 * 16kHz モノラル wav を話者ごとの区間に分ける。
 * numSpeakers に人数を渡すと精度が上がる。0 なら自動推定。
 */
export async function diarize(wav16k: string, numSpeakers = 0, opts: { embModel?: string; threshold?: number; minOff?: number } = {}): Promise<SpeakerSegment[]> {
  // ネイティブアドオンなので必要になった時だけ読み込む
  const sherpa = require("sherpa-onnx-node");
  const sd = new sherpa.OfflineSpeakerDiarization({
    segmentation: { pyannote: { model: SEG_MODEL() }, numThreads: 4, debug: false },
    embedding: { model: opts.embModel ?? EMB_MODEL(), numThreads: 4, debug: false },
    // 自動推定は小さいしきい値だと分けすぎるので高めにしておく
    clustering: numSpeakers > 0 ? { numClusters: numSpeakers } : { threshold: opts.threshold ?? 0.8 },
    minDurationOn: 0.2,
    minDurationOff: opts.minOff ?? 0.3,
  });
  const wave = sherpa.readWave(wav16k) as { samples: Float32Array; sampleRate: number };
  if (wave.sampleRate !== sd.sampleRate) throw new Error(`wav は ${sd.sampleRate}Hz が必要です(実際: ${wave.sampleRate}Hz)`);
  const segs = sd.process(wave.samples) as { start: number; end: number; speaker: number }[];
  return segs
    .map((s) => ({ startMs: Math.round(s.start * 1000), endMs: Math.round(s.end * 1000), speaker: s.speaker }))
    .sort((a, b) => a.startMs - b.startMs);
}

/**
 * 各行に話者番号を付ける。行の区間と最も長く重なる話者を採用する。
 * 話者番号は登場順に 0,1,2... へ振り直す(最初に話した人が 0)。
 */
export function assignSpeakers(lines: Line[], segs: SpeakerSegment[]): Line[] {
  const remap = new Map<number, number>();
  const out = lines.map((l) => {
    const overlap = new Map<number, number>();
    for (const s of segs) {
      const o = Math.min(l.endMs, s.endMs) - Math.max(l.startMs, s.startMs);
      if (o > 0) overlap.set(s.speaker, (overlap.get(s.speaker) ?? 0) + o);
    }
    let best: number | undefined;
    let bestLen = 0;
    for (const [sp, len] of overlap) if (len > bestLen) { best = sp; bestLen = len; }
    if (best === undefined) {
      // 重なりがなければ最も近い区間の話者
      let nearest = segs[0];
      for (const s of segs) if (Math.abs(s.startMs - l.startMs) < Math.abs(nearest.startMs - l.startMs)) nearest = s;
      best = nearest?.speaker ?? 0;
    }
    if (!remap.has(best)) remap.set(best, remap.size);
    return { ...l, speaker: remap.get(best)! };
  });
  return out;
}
