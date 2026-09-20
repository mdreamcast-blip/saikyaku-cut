import fs from "node:fs";
import path from "node:path";

/** 同梱効果音(assets/sfx)の場所。開発時はプロジェクト直下、パッケージ後は resources 内。 */
export function sfxDir(): string {
  const candidates = [
    path.join(process.cwd(), "assets/sfx"),
    path.join(__dirname, "../assets/sfx"),
    path.join(process.resourcesPath ?? "", "sfx"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

export const sfxPath = (name: string) => path.join(sfxDir(), `${name.replace(/[^a-z0-9_-]/gi, "")}.wav`);
