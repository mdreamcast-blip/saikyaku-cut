import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { startMediaServer } from "./services/mediaServer";
import { sfxDir, sfxList } from "./services/sfx";
import fs from "node:fs";
import { DEFAULT_PROJECT, type Progress, type Project, type SilenceOptions, type TranscribeOptions } from "../src/shared/types";
import { probe, detectSpeechSegments, cutToSegments } from "./services/ffmpeg";
import { ensureWhisper, transcribeToLines } from "./services/whisper";
import { renderProject } from "./services/render";
import { textToWords } from "./services/segment";

let win: BrowserWindow | null = null;
let mediaPort = 0;

// アプリ名を変えても、ダウンロード済みのモデル類(数 GB)を置いたフォルダはそのまま使う
app.setPath("userData", path.join(app.getPath("appData"), "ReelCaption"));

// エラーはファイルにも残す(配布版は画面のログが見えないため)
const logFile = path.join(app.getPath("userData"), "logs", "app.log");
function logLine(...args: unknown[]) {
  const line = `${new Date().toISOString()} ${args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === "string" ? a : JSON.stringify(a))).join(" ")}\n`;
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, line);
  } catch { /* ログに失敗しても本体は止めない */ }
  console.log(line.trim());
}
process.on("uncaughtException", (e) => logLine("uncaughtException", e));
process.on("unhandledRejection", (e) => logLine("unhandledRejection", e as Error));

function createWindow() {
  win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "細客CUT",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0e0e14",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // preload に動画配信サーバーのポートを渡す
      additionalArguments: [`--rc-media-port=${mediaPort}`, `--rc-sfx-dir=${sfxDir()}`],
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

const report = (p: Progress) => win?.webContents.send("progress", p);

app.whenReady().then(async () => {
  logLine("start", { version: app.getVersion(), packaged: app.isPackaged, resources: process.resourcesPath, cwd: process.cwd() });

  // 隠しオプション: 画面を開かずに 文字起こし → 書き出し を実行して終了する(配布版の動作確認用)
  //   細客CUT.app/Contents/MacOS/細客CUT --render-test <入力> <出力.mp4>
  const i = process.argv.indexOf("--render-test");
  if (i >= 0) {
    const [input, output] = [process.argv[i + 1], process.argv[i + 2]];
    try {
      const info = await probe(input);
      const lines = await transcribeToLines(input, { maxCharsPerLine: 8, dictionary: "", diarize: false, numSpeakers: 2, granularity: "fine" }, (p) => logLine("progress", p.message));
      const project: Project = { ...DEFAULT_PROJECT, sourcePath: input, mediaPath: input, mediaIsVideo: info.isVideo, durationMs: info.durationMs, lines: lines.map((l, k) => (k === 0 ? { ...l, sfx: "bishi" } : l)) };
      await renderProject(project, output, (p) => logLine("progress", p.message));
      logLine("render-test OK", output);
      app.exit(0);
    } catch (e) {
      logLine("render-test FAILED", e as Error);
      app.exit(1);
    }
    return;
  }

  // 動画・音声はローカル HTTP で <video> に配信する(Range 対応)
  mediaPort = await startMediaServer();
  createWindow();
});

app.on("window-all-closed", () => app.quit());

ipcMain.handle("pickMedia", async () => {
  const r = await dialog.showOpenDialog({
    title: "動画または音声を選ぶ",
    properties: ["openFile"],
    filters: [
      { name: "動画・音声", extensions: ["mp4", "mov", "m4v", "webm", "mp3", "m4a", "wav", "aac", "flac"] },
    ],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  const info = await probe(p);
  return { path: p, isVideo: info.isVideo, durationMs: info.durationMs };
});

ipcMain.handle("pickSavePath", async (_e, defaultName: string) => {
  const r = await dialog.showSaveDialog({
    title: "書き出し先",
    // 書き出しは「ダウンロード」フォルダに入れる(ダイアログで変更可)
    defaultPath: path.join(app.getPath("downloads"), defaultName),
    filters: [{ name: "MP4", extensions: ["mp4"] }],
  });
  return r.canceled ? null : r.filePath ?? null;
});

ipcMain.handle("ensureWhisper", async () => {
  try {
    await ensureWhisper(report);
    return { ok: true, message: "準備完了" };
  } catch (e: any) {
    return { ok: false, message: String(e?.message ?? e) };
  }
});

ipcMain.handle("transcribe", async (_e, mediaPath: string, opts: TranscribeOptions) => {
  await ensureWhisper(report);
  return transcribeToLines(mediaPath, opts, report);
});

ipcMain.handle("sfxList", () => sfxList());

ipcMain.handle("resegment", (_e, text: string, startMs: number, endMs: number) => textToWords(text, startMs, endMs));

ipcMain.handle("cutSilence", async (_e, mediaPath: string, opts: SilenceOptions) => {
  report({ stage: "silence", ratio: 0, message: "無音を検出しています" });
  const info = await probe(mediaPath);
  const segments = await detectSpeechSegments(mediaPath, opts, info.durationMs);
  const kept = segments.reduce((n, s) => n + (s.endMs - s.startMs), 0);
  const removedMs = Math.max(0, info.durationMs - kept);
  if (removedMs < 100) {
    report({ stage: "silence", ratio: 1, message: "カットできる無音はありませんでした" });
    return { path: mediaPath, isVideo: info.isVideo, durationMs: info.durationMs, removedMs: 0, segments: 1 };
  }
  report({ stage: "silence", ratio: 0.05, message: `${segments.length} 区間を残して詰めています` });
  const out = await cutToSegments(mediaPath, segments, info.isVideo, (r) =>
    report({ stage: "silence", ratio: 0.05 + 0.95 * r, message: `無音をカット中 ${Math.round(r * 100)}%` }),
  );
  const after = await probe(out);
  report({ stage: "silence", ratio: 1, message: `${(removedMs / 1000).toFixed(1)} 秒カットしました` });
  return { path: out, isVideo: after.isVideo, durationMs: after.durationMs, removedMs, segments: segments.length };
});

ipcMain.handle("render", async (_e, project: Project, outPath: string) => {
  try {
    logLine("render start", { out: outPath, lines: project.lines.length, overlays: project.overlays.length, media: project.mediaPath });
    await renderProject(project, outPath, report);
    logLine("render done", outPath);
    shell.showItemInFolder(outPath);
    return { ok: true, message: outPath };
  } catch (e: any) {
    logLine("render FAILED", e);
    return { ok: false, message: `${String(e?.message ?? e)}\n\n詳細ログ: ${logFile}` };
  }
});
