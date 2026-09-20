// ブラウザ内で whisper を動かす Web Worker(Transformers.js)。
// メインスレッドを止めないよう、モデルの読み込みと推論はここで行う。
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import type { Token } from "../shared/segmentCore";

env.allowLocalModels = false;

type Req = { id: number; audio: Float32Array; model: string; prompt?: string };
type Res =
  | { id: number; type: "progress"; ratio: number; message: string }
  | { id: number; type: "done"; tokens: Token[]; text: string }
  | { id: number; type: "error"; message: string };

let pipe: AutomaticSpeechRecognitionPipeline | null = null;
let loadedModel = "";

async function getPipe(model: string, post: (r: Res) => void, id: number) {
  if (pipe && loadedModel === model) return pipe;
  const hasWebGPU = typeof (self as any).navigator?.gpu !== "undefined";
  post({ id, type: "progress", ratio: 0, message: `音声認識モデルを読み込み中(${hasWebGPU ? "WebGPU" : "CPU"})` });
  pipe = await pipeline("automatic-speech-recognition", model, {
    device: hasWebGPU ? "webgpu" : "wasm",
    // WebGPU は量子化モデルと相性が悪いので、エンコーダーは fp32、デコーダーは q8 にする
    dtype: hasWebGPU ? { encoder_model: "fp32", decoder_model_merged: "q8" } : "q8",
    progress_callback: (p: any) => {
      if (p.status === "progress" && p.total) post({ id, type: "progress", ratio: Math.min(0.3, 0.3 * (p.loaded / p.total)), message: `モデルをダウンロード中 ${Math.round(p.loaded / 1048576)}MB / ${Math.round(p.total / 1048576)}MB` });
    },
  } as any);
  loadedModel = model;
  return pipe;
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, audio, model, prompt } = e.data;
  const post = (r: Res) => (self as any).postMessage(r);
  try {
    const asr = await getPipe(model, post, id);
    post({ id, type: "progress", ratio: 0.35, message: "文字起こし中" });
    const out: any = await asr(audio, {
      language: "japanese",
      task: "transcribe",
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
      ...(prompt ? { prompt_ids: undefined } : {}),
    } as any);
    // chunks: [{text, timestamp:[start,end]}] 単語(日本語は 1〜数文字)ごと
    const tokens: Token[] = (out.chunks ?? []).map((c: any) => ({
      text: String(c.text ?? "").replace(/^\s+/, ""),
      startMs: Math.round((c.timestamp?.[0] ?? 0) * 1000),
      endMs: Math.round(((c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0) + 0.02) * 1000),
    })).filter((t: Token) => t.text.trim());
    post({ id, type: "done", tokens, text: out.text ?? "" });
  } catch (err: any) {
    post({ id, type: "error", message: String(err?.message ?? err) });
  }
};
