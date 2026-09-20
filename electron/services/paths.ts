import path from "node:path";
import fs from "node:fs";
import os from "node:os";

/** Electron 外(テストスクリプト)から呼ばれても同じ場所を返す。 */
function userDataDir() {
  try {
    const { app } = require("electron");
    if (app?.getPath) return app.getPath("userData") as string;
  } catch { /* electron なし */ }
  return path.join(os.homedir(), "Library/Application Support/ReelCaption");
}

/** whisper.cpp 本体・モデル・Remotion バンドルなど、重いものの置き場。 */
export function dataDir(...sub: string[]) {
  const dir = path.join(userDataDir(), ...sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 1.7.3 以降は Makefile が廃止され cmake が必要になる。cmake 無しの Mac でも
// ビルドできる最後の版が 1.7.2(large-v3-turbo にも対応)。
export const WHISPER_VERSION = "1.7.2";
export const WHISPER_MODEL = "large-v3-turbo" as const;

// installWhisperCpp は「フォルダが既にあるのに実行ファイルがない」とエラーにするので、
// ここでは mkdir しない(親フォルダだけ用意する)。
export const whisperDir = () => path.join(dataDir(), "whisper.cpp");
export const modelDir = () => dataDir("whisper-models");
export const tmpDir = () => dataDir("tmp");
export const bundleDir = () => dataDir("remotion-bundle");
