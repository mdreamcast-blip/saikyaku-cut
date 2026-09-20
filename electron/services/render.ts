import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";
import type { CompositionProps, Progress, Project } from "../../src/shared/types";
import { bundleDir } from "./paths";
import { sfxPath } from "./sfx";

type Report = (p: Progress) => void;

const COMP_ID = "Reel";
let cachedServeUrl: string | null = null;

/** Remotion のエントリ。開発時はソース、パッケージ後は同梱した src を指す。 */
function entryPoint() {
  const candidates = [
    path.join(process.cwd(), "src/remotion/index.ts"),
    path.join(__dirname, "../src/remotion/index.ts"),
    path.join(process.resourcesPath ?? "", "src/remotion/index.ts"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error("Remotion のエントリ(src/remotion/index.ts)が見つかりません");
  return found;
}

async function getServeUrl(report: Report) {
  if (cachedServeUrl && fs.existsSync(cachedServeUrl)) return cachedServeUrl;
  report({ stage: "render", ratio: 0, message: "描画エンジンを準備しています(初回は時間がかかります)" });
  await ensureBrowser();
  cachedServeUrl = await bundle({
    entryPoint: entryPoint(),
    outDir: bundleDir(),
    onProgress: (p) => report({ stage: "render", ratio: p / 100 * 0.2, message: `バンドル中 ${p}%` }),
  });
  return cachedServeUrl;
}

/** Project を mp4 に書き出す。 */
export async function renderProject(project: Project, outPath: string, report: Report) {
  const serveUrl = await getServeUrl(report);
  // 描画エンジンは file:// を読めないので、配信フォルダ(serveUrl)にリンクを置いて
  // http://localhost:xxxx/<名前> として読ませる。
  // 静的配信はシンボリックリンクを辿らないので、ハードリンク(同一ボリューム)かコピー
  const placed: string[] = [];
  const place = (src: string, name: string) => {
    const link = path.join(serveUrl, name);
    fs.rmSync(link, { force: true });
    try { fs.linkSync(src, link); } catch { fs.copyFileSync(src, link); }
    placed.push(link);
    return `/${name}`;
  };
  let mediaSrc = "";
  if (project.mediaPath) mediaSrc = place(project.mediaPath, `media-${Date.now()}${path.extname(project.mediaPath)}`);

  // 使われている効果音だけ配信フォルダに置く
  const sfxUrls: Record<string, string> = {};
  const used = new Set([...project.lines.map((l) => l.sfx), ...project.overlays.map((o) => o.sfx)].filter(Boolean) as string[]);
  for (const name of used) {
    const src = sfxPath(name);
    if (fs.existsSync(src)) sfxUrls[name] = place(src, `sfx-${name}.wav`);
  }
  const inputProps: CompositionProps = { ...project, mediaSrc, sfxUrls };

  report({ stage: "render", ratio: 0.2, message: "構成を読み込んでいます" });
  const composition = await selectComposition({ serveUrl, id: COMP_ID, inputProps });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outPath,
    inputProps,
    // 縦型 SNS 向け: 高めのビットレートで文字の縁をきれいに
    crf: 18,
    pixelFormat: "yuv420p",
    // 長尺動画でフレームの取り出しが遅れても失敗しないよう、待ち時間を長めに
    timeoutInMilliseconds: 180000,
    // M シリーズ Mac なら並列数を上げても安定する
    concurrency: "75%",
    chromiumOptions: { enableMultiProcessOnLinux: true },
    onProgress: ({ progress }) => report({ stage: "render", ratio: 0.2 + 0.8 * progress, message: `書き出し中 ${Math.round(progress * 100)}%` }),
  });
  report({ stage: "render", ratio: 1, message: "完了" });
  for (const f of placed) fs.rmSync(f, { force: true });
}
