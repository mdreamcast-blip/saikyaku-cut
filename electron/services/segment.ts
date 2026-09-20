import path from "node:path";
import fs from "node:fs";
import kuromoji, { type IpadicFeatures, type Tokenizer } from "kuromoji";
import type { Line, Word } from "../../src/shared/types";
import { chunksToLines as chunksToLinesCore, textToWordsWith, tokensToChunksWith, type Token } from "../../src/shared/segmentCore";

export type { Token };
export { chunksToLinesCore as chunksToLines };

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

/** whisper のトークンを文節にまとめる(Node 版: 辞書はローカルファイル) */
export async function tokensToChunks(tokens: Token[]): Promise<Word[]> {
  return tokensToChunksWith(await getTokenizer(), tokens);
}

/** 手で直した文言を文節に分け直す */
export async function textToWords(text: string, startMs: number, endMs: number): Promise<Word[]> {
  return textToWordsWith(await getTokenizer(), text, startMs, endMs);
}

export type { Line };
