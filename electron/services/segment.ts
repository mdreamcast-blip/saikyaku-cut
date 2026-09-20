import path from "node:path";
import fs from "node:fs";
import kuromoji, { type IpadicFeatures, type Tokenizer } from "kuromoji";
import type { Granularity, Line, Word } from "../../src/shared/types";

/** whisper が返すトークン(1〜数文字)と時刻。 */
export type Token = { text: string; startMs: number; endMs: number };

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null;

function dictPath() {
  const candidates = [
    path.join(path.dirname(require.resolve("kuromoji/package.json")), "dict"),
    path.join(process.resourcesPath ?? "", "kuromoji-dict"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error("kuromoji の辞書が見つかりません");
  return found;
}

/** 形態素解析器(初回だけ辞書を読む。1 秒弱)。 */
export function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: dictPath() }).build((err, t) => (err ? reject(err) : resolve(t)));
    });
  }
  return tokenizerPromise;
}

// 文節の頭になれる品詞(自立語)
const HEAD_POS = new Set(["名詞", "動詞", "形容詞", "副詞", "連体詞", "接続詞", "感動詞", "接頭詞"]);
const PUNCT_END = /[。！？!?]$/;
const PUNCT_ANY = /[、。,.!?！？]$/;
const len = (s: string) => Array.from(s).length;

/**
 * whisper のトークンを、kuromoji で文節にまとめ直す。
 *
 * 1. 全トークンをつないだ文字列を形態素解析する
 * 2. 各文字が「どのトークンの何文字目か」を覚えておき、文節の時刻はそこから引く
 * 3. 自立語で文節を始め、助詞・助動詞・接尾・非自立はその文節に付ける
 */
export async function tokensToChunks(tokens: Token[]): Promise<Word[]> {
  const tokenizer = await getTokenizer();

  // 文字ごとの時刻表(トークン内は等間隔に割り振る)
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
  let cur: { text: string; from: number; to: number } | null = null; // from/to は文字インデックス
  let pos = 0; // 文字インデックス(コードポイント単位)

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
    const glue = !isHead || isPunct; // 前の文節にくっつける

    if (cur && (glue || (cur.text.length < 2 && !PUNCT_ANY.test(cur.text)))) {
      cur.text += surface;
      cur.to = to;
    } else {
      push();
      cur = { text: surface, from, to };
    }
    // 句読点の後ろは必ず文節を切る
    if (PUNCT_ANY.test(surface)) push();
  }
  push();
  return chunks;
}

/**
 * 手で直した文言を文節に分け、区間内に文字数比で時刻を割り振る。
 * 元の単語時刻は失われるが、カラオケ表示が自然に見える程度には合う。
 */
export async function textToWords(text: string, startMs: number, endMs: number): Promise<Word[]> {
  const clean = text.replace(/\s+/g, "");
  if (!clean) return [];
  const chunks = await tokensToChunks([{ text: clean, startMs, endMs }]);
  return chunks.map((c) => ({ ...c, text: c.text.replace(/[、。,.!?！？]+$/g, "") })).filter((w) => w.text);
}

/**
 * 文節を行にまとめる。
 * ・句点で必ず改行、読点でも 6 文字以上あれば改行
 * ・maxChars を超える場合は文節の境目で改行(文節の途中では切らない)
 * ・700ms 以上の間があれば改行
 */
export function chunksToLines(chunks: Word[], maxChars: number, granularity: Granularity = "normal"): Line[] {
  const lines: Line[] = [];
  let cur: Word[] = [];
  const curLen = () => cur.reduce((n, w) => n + len(w.text), 0);

  // 細かさごとのしきい値
  // maxDurMs: 1 つの字幕の表示時間の上限。話が長く続いても、ここで文節の切れ目で分ける
  const cfg = {
    // fine: 文節 1 つごと(「今日は」「本気で」…)。最長 1 秒
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
    // 一言ごとモード: 文節が規定数たまったら切る。ただし 2 文字以下の短い行は次とつなぐ
    else if (cur.length >= cfg.maxChunks && curLen() >= 3) flush();
  }
  flush();

  // 行の終わり: 少しだけ余韻を残すが、次の字幕や無音にはかぶせない。
  // holdMs より長い無音があれば、そこで字幕は消える(だらだら残さない)。
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
