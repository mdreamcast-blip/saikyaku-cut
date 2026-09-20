// 文節分割と行分けの本体。Node(Electron)でもブラウザでも同じものを使う。
// kuromoji の tokenizer だけ外から渡してもらう(辞書の置き場所が環境で違うため)。
import type { Granularity, Line, Word } from "./types";

/** whisper が返すトークン(1〜数文字)と時刻。 */
export type Token = { text: string; startMs: number; endMs: number };

/** kuromoji の形態素のうち使う項目だけ */
export type Morph = { surface_form: string; pos: string; pos_detail_1: string };
export type Tokenizer = { tokenize: (text: string) => Morph[] };

// 文節の頭になれる品詞(自立語)
const HEAD_POS = new Set(["名詞", "動詞", "形容詞", "副詞", "連体詞", "接続詞", "感動詞", "接頭詞"]);
const PUNCT_END = /[。！？!?]$/;
const PUNCT_ANY = /[、。,.!?！？]$/;
const len = (s: string) => Array.from(s).length;

/**
 * whisper のトークンを、kuromoji で文節にまとめ直す。
 * 1. 全トークンをつないだ文字列を形態素解析する
 * 2. 各文字が「どのトークンの何文字目か」を覚えておき、文節の時刻はそこから引く
 * 3. 自立語で文節を始め、助詞・助動詞・接尾・非自立はその文節に付ける
 */
export function tokensToChunksWith(tokenizer: Tokenizer, tokens: Token[]): Word[] {
  const charStart: number[] = [];
  const charEnd: number[] = [];
  let text = "";
  for (const t of tokens) {
    const chars = Array.from(t.text);
    const step = (t.endMs - t.startMs) / Math.max(1, chars.length);
    chars.forEach((ch, i) => {
      text += ch;
      charStart.push(Math.round(t.startMs + step * i));
      charEnd.push(Math.round(t.startMs + step * (i + 1)));
    });
  }

  const morphs = tokenizer.tokenize(text);
  const chunks: Word[] = [];
  let cur: { text: string; from: number; to: number } | null = null;
  let pos = 0;
  const push = () => {
    if (!cur) return;
    chunks.push({ text: cur.text, startMs: charStart[cur.from], endMs: charEnd[cur.to] });
    cur = null;
  };
  for (const m of morphs) {
    const surface = m.surface_form;
    const n = len(surface);
    const from = pos;
    const to = pos + n - 1;
    pos += n;
    if (!surface.trim()) continue;
    const isPunct = m.pos === "記号";
    const isHead = HEAD_POS.has(m.pos) && m.pos_detail_1 !== "非自立" && m.pos_detail_1 !== "接尾";
    const glue = !isHead || isPunct;
    if (cur && (glue || (cur.text.length < 2 && !PUNCT_ANY.test(cur.text)))) {
      cur.text += surface;
      cur.to = to;
    } else {
      push();
      cur = { text: surface, from, to };
    }
    if (PUNCT_ANY.test(surface)) push();
  }
  push();
  return chunks;
}

/** 手で直した文言を文節に分け、区間内に文字数比で時刻を割り振る。 */
export function textToWordsWith(tokenizer: Tokenizer, text: string, startMs: number, endMs: number): Word[] {
  const clean = text.replace(/\s+/g, "");
  if (!clean) return [];
  return tokensToChunksWith(tokenizer, [{ text: clean, startMs, endMs }])
    .map((c) => ({ ...c, text: c.text.replace(/[、。,.!?！？]+$/g, "") }))
    .filter((w) => w.text);
}

/**
 * 文節を行にまとめる。
 * ・句点で必ず改行、読点でも一定文字数あれば改行
 * ・maxChars / maxDurMs を超える場合は文節の境目で改行(文節の途中では切らない)
 * ・一定以上の間があれば改行
 */
export function chunksToLines(chunks: Word[], maxChars: number, granularity: Granularity = "normal"): Line[] {
  const lines: Line[] = [];
  let cur: Word[] = [];
  const curLen = () => cur.reduce((n, w) => n + len(w.text), 0);
  const cfg = {
    fine:   { gapMs: 250, maxChunks: 1, commaMin: 1, tailMs: 100, holdMs: 120, maxDurMs: 1000 },
    normal: { gapMs: 700, maxChunks: 99, commaMin: 6, tailMs: 250, holdMs: 400, maxDurMs: 3000 },
    long:   { gapMs: 1000, maxChunks: 99, commaMin: 99, tailMs: 300, holdMs: 600, maxDurMs: 5000 },
  }[granularity];

  const flush = () => {
    if (!cur.length) return;
    const words = cur
      .map((w) => ({ text: w.text.replace(/[、。,.!?！？]+$/g, ""), startMs: w.startMs, endMs: w.endMs }))
      .filter((w) => w.text);
    const text = words.map((w) => w.text).join("");
    if (text) lines.push({ id: `${lines.length + 1}`, text, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs, words });
    cur = [];
  };

  for (const c of chunks) {
    const prev = cur[cur.length - 1];
    if (prev && c.startMs - prev.endMs > cfg.gapMs) flush();
    if (cur.length && curLen() + len(c.text) > maxChars) flush();
    if (cur.length && c.endMs - cur[0].startMs > cfg.maxDurMs) flush();
    cur.push(c);
    if (PUNCT_END.test(c.text) || (PUNCT_ANY.test(c.text) && curLen() >= cfg.commaMin)) flush();
    else if (cur.length >= cfg.maxChunks && curLen() >= 3) flush();
  }
  flush();

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const next = lines[i + 1];
    const minEnd = l.startMs + (granularity === "fine" ? 350 : 500);
    let end = Math.max(l.endMs + cfg.tailMs, minEnd);
    if (next) end = Math.min(end, next.startMs - 40 > l.endMs ? Math.min(next.startMs - 40, l.endMs + cfg.holdMs) : next.startMs - 40);
    l.endMs = Math.max(end, l.startMs + 250);
  }
  return lines;
}

/** 動画の長さを超える字幕を切り詰める */
export function clampLines(lines: Line[], durationMs: number): Line[] {
  if (!(durationMs > 0)) return lines;
  return lines
    .filter((l) => l.startMs < durationMs - 100)
    .map((l) => (l.endMs > durationMs ? { ...l, endMs: durationMs, words: l.words.map((w) => ({ ...w, endMs: Math.min(w.endMs, durationMs) })) } : l));
}
