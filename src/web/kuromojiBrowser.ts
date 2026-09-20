// ブラウザ版の形態素解析器。辞書は public-web/dict を HTTP で読む(約 17MB、初回だけ)。
// ブラウザ用にあらかじめ束ねられたビルド(node の path 等を内蔵)を使う
// @ts-expect-error 型定義は無いが kuromoji 本体と同じ API
import kuromoji from "kuromoji/build/kuromoji.js";
import type { Tokenizer } from "../shared/segmentCore";

let promise: Promise<Tokenizer> | null = null;

/**
 * kuromoji は辞書(.dat.gz)を XHR で取って自前で gunzip する。ところが配信サーバーによっては
 * .gz を Content-Encoding: gzip 付きで返し、ブラウザが先に解凍してしまうため「invalid file signature」で落ちる。
 * どちらの返し方でも動くよう、辞書の取得だけ fetch で行い、解凍済みなら圧縮し直して kuromoji に渡す。
 */
class DictXHR {
  responseType = "";
  status = 0;
  statusText = "";
  response: ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  private url = "";
  open(_method: string, url: string) { this.url = url; }
  send() {
    fetch(this.url)
      .then(async (r) => {
        let buf = new Uint8Array(await r.arrayBuffer());
        const isGzip = buf[0] === 0x1f && buf[1] === 0x8b;
        if (r.ok && !isGzip) {
          const stream = new Blob([buf]).stream().pipeThrough(new CompressionStream("gzip"));
          buf = new Uint8Array(await new Response(stream).arrayBuffer());
        }
        this.status = r.status;
        this.statusText = r.statusText;
        this.response = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
        this.onload?.();
      })
      .catch((e) => this.onerror?.(e));
  }
}

export function getBrowserTokenizer(base = import.meta.env.BASE_URL): Promise<Tokenizer> {
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const Original = window.XMLHttpRequest;
      (window as any).XMLHttpRequest = DictXHR;
      kuromoji.builder({ dicPath: `${base}dict/` }).build((err: unknown, t: unknown) => {
        window.XMLHttpRequest = Original;
        if (err) { promise = null; reject(err); } else resolve(t as Tokenizer);
      });
    });
  }
  return promise;
}
