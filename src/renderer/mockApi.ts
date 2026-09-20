// ブラウザで UI だけ確認するときの window.api の代わり。
// サンプル動画と、あらかじめ作った字幕 JSON を返す。書き出しなどは何もしない。
import type { Api, Line, Word } from "../shared/types";

const SAMPLE = "/sample.mp4";

async function loadLines(): Promise<Line[]> {
  try {
    const r = await fetch("/sample.lines.json");
    return (await r.json()) as Line[];
  } catch {
    return [];
  }
}

/** 文言を文字数比で単語に割る(kuromoji が無いので簡易) */
function splitWords(text: string, s: number, e: number): Word[] {
  const parts = text.match(/.{1,3}/g) ?? [text];
  const step = (e - s) / parts.length;
  return parts.map((t, i) => ({ text: t, startMs: Math.round(s + step * i), endMs: Math.round(s + step * (i + 1)) }));
}

export const mockApi: Api = {
  pickMedia: async () => ({ path: SAMPLE, isVideo: true, durationMs: 15400 }),
  pickSavePath: async (name) => `/tmp/${name}`,
  ensureWhisper: async () => ({ ok: true, message: "mock" }),
  transcribe: async () => loadLines(),
  cutSilence: async (p) => ({ path: p, isVideo: true, durationMs: 15400, removedMs: 0, segments: 1 }),
  render: async () => ({ ok: true, message: "mock" }),
  resegment: async (t, s, e) => splitWords(t, s, e),
  onProgress: () => () => {},
  toFileUrl: (p) => p,
  sfxUrl: (name) => `/sfx/${name}.wav`,
  sfxList: async () => { try { return await (await fetch("/sfx/manifest.json")).json(); } catch { return []; } },
};
