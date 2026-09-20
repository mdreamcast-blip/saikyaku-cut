import fs from "node:fs";
import path from "node:path";

/** 同梱効果音(assets/sfx)の場所。開発時はプロジェクト直下、パッケージ後は resources 内。 */
export function sfxDir(): string {
  const candidates = [
    path.join(process.env.RC_APP_ROOT ?? "", "assets/sfx"),
    path.join(__dirname, "../assets/sfx"),
    path.join(process.resourcesPath ?? "", "sfx"),
    path.join(process.cwd(), "assets/sfx"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

export const sfxPath = (name: string) => path.join(sfxDir(), `${name.replace(/[^a-z0-9_-]/gi, "")}.wav`);

/** manifest.json に書かれた順で一覧を返す。無ければフォルダ内の wav を名前のまま返す */
export function sfxList(): { name: string; label: string }[] {
  const dir = sfxDir();
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as { name: string; label: string }[];
    return m.filter((s) => fs.existsSync(path.join(dir, `${s.name}.wav`)));
  } catch {
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".wav")).map((f) => ({ name: f.replace(/\.wav$/, ""), label: f.replace(/\.wav$/, "") })) : [];
  }
}
