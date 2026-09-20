import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".flac": "audio/flac", ".aiff": "audio/aiff",
};

/**
 * ローカルの動画・音声を <video> に配信する小さな HTTP サーバー。
 * Electron の独自プロトコルは再生中の連続 Range 要求で詰まることがあったので、
 * 実績のある Node の http + createReadStream で返す。127.0.0.1 のみで待ち受ける。
 */
export function startMediaServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const filePath = url.searchParams.get("p");
      if (url.pathname !== "/m" || !filePath || !path.isAbsolute(filePath)) { res.writeHead(404); res.end(); return; }
      let stat: fs.Stats;
      try { stat = fs.statSync(filePath); } catch { res.writeHead(404); res.end(); return; }
      const size = stat.size;
      const type = MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
      const range = req.headers.range;
      let start = 0, end = size - 1;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m) {
          if (m[1]) start = Number(m[1]);
          if (m[2]) end = Number(m[2]);
          if (!m[1] && m[2]) { start = Math.max(0, size - Number(m[2])); end = size - 1; }
        }
        end = Math.min(end, size - 1);
        if (start > end) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); res.end(); return; }
      }
      res.writeHead(range ? 206 : 200, {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
      });
      if (req.method === "HEAD") { res.end(); return; }
      const stream = fs.createReadStream(filePath, { start, end });
      stream.on("error", () => res.destroy());
      req.on("close", () => stream.destroy());
      stream.pipe(res);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
  });
}

export const mediaUrl = (port: number, filePath: string) => `http://127.0.0.1:${port}/m?p=${encodeURIComponent(filePath)}`;
