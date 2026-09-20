import type { CaptionStyle, ThemeName } from "../shared/types";

// 日本語で映えるフォントをテーマごとに数種類。Google Fonts から読み込む。
// フォントの読み込みは fonts.ts で行う。

const tempo: CaptionStyle[] = [
  { name: "デラ黄", fontFamily: "Dela Gothic One", fontWeight: 400, fontSize: 92, color: "#FFE600", strokeColor: "#111", strokeWidth: 14, highlightColor: "#FF3D71", animation: "pop", offsetY: 0, rotate: -2 },
  { name: "白抜き", fontFamily: "Zen Kaku Gothic New", fontWeight: 900, fontSize: 84, color: "#fff", strokeColor: "#000", strokeWidth: 12, highlightColor: "#00E5FF", animation: "slideUp", offsetY: 40 },
  { name: "赤帯", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: 78, color: "#fff", background: "#E5163A", backgroundRadius: 8, highlightColor: "#FFE600", animation: "bounce", offsetY: -20 },
  { name: "手書き", fontFamily: "Yusei Magic", fontWeight: 400, fontSize: 88, color: "#fff", strokeColor: "#2a1a4a", strokeWidth: 10, highlightColor: "#FFB300", animation: "shake", offsetY: 20, rotate: 2 },
  { name: "カラオケ", fontFamily: "M PLUS Rounded 1c", fontWeight: 900, fontSize: 82, color: "#ffffffcc", strokeColor: "#000", strokeWidth: 10, highlightColor: "#7CFF6B", animation: "karaoke", offsetY: 0 },
  { name: "黒帯白", fontFamily: "Zen Kaku Gothic New", fontWeight: 700, fontSize: 74, color: "#fff", background: "#000000d9", backgroundRadius: 4, highlightColor: "#FF3D71", animation: "typewriter", offsetY: 60, letterSpacing: 4 },
  { name: "レゲエ", fontFamily: "Reggae One", fontWeight: 400, fontSize: 96, color: "#FF3D71", strokeColor: "#fff", strokeWidth: 12, highlightColor: "#FFE600", animation: "flip", offsetY: -40 },
  { name: "ズーム", fontFamily: "Dela Gothic One", fontWeight: 400, fontSize: 100, color: "#fff", strokeColor: "#0057FF", strokeWidth: 16, highlightColor: "#FFE600", animation: "zoomBlur", offsetY: 0 },
];

const calm: CaptionStyle[] = [
  { name: "明朝白", fontFamily: "Shippori Mincho", fontWeight: 700, fontSize: 72, color: "#fff", strokeColor: "#00000088", strokeWidth: 6, highlightColor: "#E8C872", animation: "slideUp", offsetY: 0, letterSpacing: 6 },
  { name: "ゴシック薄帯", fontFamily: "Noto Sans JP", fontWeight: 500, fontSize: 64, color: "#fff", background: "#00000099", backgroundRadius: 12, highlightColor: "#9AD0FF", animation: "typewriter", offsetY: 30 },
  { name: "明朝金", fontFamily: "Shippori Mincho", fontWeight: 700, fontSize: 76, color: "#E8C872", strokeColor: "#000", strokeWidth: 6, highlightColor: "#fff", animation: "pop", offsetY: -20, letterSpacing: 8 },
  { name: "細ゴ", fontFamily: "Zen Kaku Gothic New", fontWeight: 300, fontSize: 68, color: "#fff", strokeColor: "#00000066", strokeWidth: 4, highlightColor: "#FFD6A5", animation: "karaoke", offsetY: 0, letterSpacing: 10 },
];

const pop: CaptionStyle[] = [
  { name: "丸ピンク", fontFamily: "M PLUS Rounded 1c", fontWeight: 900, fontSize: 86, color: "#FF5FA2", strokeColor: "#fff", strokeWidth: 14, highlightColor: "#FFE600", animation: "bounce", offsetY: 0, rotate: -3 },
  { name: "丸水色", fontFamily: "M PLUS Rounded 1c", fontWeight: 900, fontSize: 86, color: "#37C6FF", strokeColor: "#fff", strokeWidth: 14, highlightColor: "#FF5FA2", animation: "pop", offsetY: 30, rotate: 2 },
  { name: "ロック", fontFamily: "RocknRoll One", fontWeight: 400, fontSize: 90, color: "#fff", background: "#7B3FF2", backgroundRadius: 40, highlightColor: "#FFE600", animation: "shake", offsetY: -30 },
  { name: "黄帯黒", fontFamily: "Dela Gothic One", fontWeight: 400, fontSize: 80, color: "#111", background: "#FFE600", backgroundRadius: 10, highlightColor: "#E5163A", animation: "flip", offsetY: 20 },
  { name: "手書き青", fontFamily: "Yusei Magic", fontWeight: 400, fontSize: 92, color: "#1E3A8A", strokeColor: "#fff", strokeWidth: 12, highlightColor: "#FF5FA2", animation: "karaoke", offsetY: 0 },
];

const mono: CaptionStyle[] = [
  { name: "白太", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: 84, color: "#fff", strokeColor: "#000", strokeWidth: 12, highlightColor: "#fff", animation: "pop", offsetY: 0 },
  { name: "黒帯", fontFamily: "Noto Sans JP", fontWeight: 700, fontSize: 76, color: "#fff", background: "#000", backgroundRadius: 0, highlightColor: "#ccc", animation: "slideUp", offsetY: 30 },
  { name: "白帯", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: 76, color: "#000", background: "#fff", backgroundRadius: 0, highlightColor: "#000", animation: "typewriter", offsetY: -30 },
];

// バラエティ番組風: 大きめ・縁取り太め・色数多め
const variety: CaptionStyle[] = [
  { name: "黄×黒縁", fontFamily: "Dela Gothic One", fontWeight: 400, fontSize: 104, color: "#FFE600", strokeColor: "#000", strokeWidth: 18, highlightColor: "#fff", animation: "pop", offsetY: 0, rotate: -3 },
  { name: "白×赤縁", fontFamily: "Dela Gothic One", fontWeight: 400, fontSize: 98, color: "#fff", strokeColor: "#E5163A", strokeWidth: 18, highlightColor: "#FFE600", animation: "bounce", offsetY: 30 },
  { name: "水色×紺", fontFamily: "RocknRoll One", fontWeight: 400, fontSize: 96, color: "#5EEBFF", strokeColor: "#0B2A6F", strokeWidth: 16, highlightColor: "#FFE600", animation: "shake", offsetY: -30, rotate: 2 },
  { name: "ピンク帯", fontFamily: "M PLUS Rounded 1c", fontWeight: 900, fontSize: 84, color: "#fff", background: "#FF3D9A", backgroundRadius: 14, highlightColor: "#FFE600", animation: "flip", offsetY: 20 },
  { name: "緑×黒縁", fontFamily: "Reggae One", fontWeight: 400, fontSize: 100, color: "#7CFF6B", strokeColor: "#000", strokeWidth: 16, highlightColor: "#fff", animation: "zoomBlur", offsetY: 0 },
  { name: "橙カラオケ", fontFamily: "Zen Kaku Gothic New", fontWeight: 900, fontSize: 90, color: "#ffffffd9", strokeColor: "#000", strokeWidth: 12, highlightColor: "#FF8A00", animation: "karaoke", offsetY: 40 },
];

// ニュース・解説風: 帯付きで読みやすさ優先。動きは控えめ
const news: CaptionStyle[] = [
  { name: "紺帯白", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: 72, color: "#fff", background: "#0B2A6F", backgroundRadius: 4, highlightColor: "#FFD400", animation: "slideUp", offsetY: 60 },
  { name: "白帯紺", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: 72, color: "#0B2A6F", background: "#ffffffee", backgroundRadius: 4, highlightColor: "#E5163A", animation: "slideUp", offsetY: 60 },
  { name: "赤帯白", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: 76, color: "#fff", background: "#C8102E", backgroundRadius: 4, highlightColor: "#FFD400", animation: "typewriter", offsetY: 60 },
  { name: "黒帯黄", fontFamily: "Zen Kaku Gothic New", fontWeight: 700, fontSize: 70, color: "#FFD400", background: "#000000e6", backgroundRadius: 4, highlightColor: "#fff", animation: "karaoke", offsetY: 60, letterSpacing: 2 },
];

// ネオン・夜系: 暗い背景に光る文字
const neon: CaptionStyle[] = [
  { name: "ネオン桃", fontFamily: "Zen Kaku Gothic New", fontWeight: 900, fontSize: 88, color: "#FF4FD8", strokeColor: "#5A0044", strokeWidth: 8, highlightColor: "#fff", animation: "zoomBlur", offsetY: 0, letterSpacing: 4 },
  { name: "ネオン青", fontFamily: "Zen Kaku Gothic New", fontWeight: 900, fontSize: 88, color: "#4FE3FF", strokeColor: "#003A5A", strokeWidth: 8, highlightColor: "#fff", animation: "pop", offsetY: 30, letterSpacing: 4 },
  { name: "ネオン緑", fontFamily: "M PLUS Rounded 1c", fontWeight: 900, fontSize: 86, color: "#8CFF5E", strokeColor: "#0F4A00", strokeWidth: 8, highlightColor: "#fff", animation: "flip", offsetY: -30, letterSpacing: 2 },
  { name: "ネオン黄", fontFamily: "Dela Gothic One", fontWeight: 400, fontSize: 92, color: "#FFF35E", strokeColor: "#5A4B00", strokeWidth: 8, highlightColor: "#fff", animation: "shake", offsetY: 0 },
  { name: "白カラオケ", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: 82, color: "#ffffffb3", strokeColor: "#000", strokeWidth: 8, highlightColor: "#FF4FD8", animation: "karaoke", offsetY: 40 },
];

// 講座・ビジネス: 落ち着いた配色で信頼感。強調はゴールドと赤
const lecture: CaptionStyle[] = [
  { name: "白ゴシック", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: 76, color: "#fff", strokeColor: "#1a1a1a", strokeWidth: 10, highlightColor: "#FFD166", animation: "slideUp", offsetY: 0 },
  { name: "黄ゴシック", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: 80, color: "#FFD166", strokeColor: "#1a1a1a", strokeWidth: 10, highlightColor: "#fff", animation: "pop", offsetY: 20 },
  { name: "赤帯白", fontFamily: "Zen Kaku Gothic New", fontWeight: 900, fontSize: 74, color: "#fff", background: "#B3261E", backgroundRadius: 6, highlightColor: "#FFD166", animation: "typewriter", offsetY: 40 },
  { name: "白帯黒", fontFamily: "Zen Kaku Gothic New", fontWeight: 900, fontSize: 74, color: "#111", background: "#ffffffee", backgroundRadius: 6, highlightColor: "#B3261E", animation: "slideUp", offsetY: 40 },
  { name: "明朝白", fontFamily: "Shippori Mincho", fontWeight: 700, fontSize: 78, color: "#fff", strokeColor: "#000", strokeWidth: 8, highlightColor: "#FFD166", animation: "karaoke", offsetY: -20, letterSpacing: 4 },
];

// 手書き・かわいい: 丸文字と手書きフォントで親しみやすく
const cute: CaptionStyle[] = [
  { name: "手書き白", fontFamily: "Yusei Magic", fontWeight: 400, fontSize: 92, color: "#fff", strokeColor: "#5A3A7A", strokeWidth: 12, highlightColor: "#FFB7D5", animation: "bounce", offsetY: 0, rotate: -2 },
  { name: "手書き桃", fontFamily: "Yusei Magic", fontWeight: 400, fontSize: 92, color: "#FF8FC2", strokeColor: "#fff", strokeWidth: 12, highlightColor: "#FFE600", animation: "shake", offsetY: 30, rotate: 2 },
  { name: "丸黄", fontFamily: "M PLUS Rounded 1c", fontWeight: 900, fontSize: 88, color: "#FFF06A", strokeColor: "#7A5A00", strokeWidth: 12, highlightColor: "#fff", animation: "pop", offsetY: -30 },
  { name: "丸帯紫", fontFamily: "M PLUS Rounded 1c", fontWeight: 900, fontSize: 82, color: "#fff", background: "#8A5CF6", backgroundRadius: 40, highlightColor: "#FFE600", animation: "flip", offsetY: 20 },
  { name: "手書きカラオケ", fontFamily: "Yusei Magic", fontWeight: 400, fontSize: 90, color: "#ffffffcc", strokeColor: "#5A3A7A", strokeWidth: 10, highlightColor: "#FF8FC2", animation: "karaoke", offsetY: 0 },
];

// ホラー・怪談: 筆文字と古い明朝、赤と青白い光。明滅と滲みで現れる
const horror: CaptionStyle[] = [
  { name: "血文字", fontFamily: "Yuji Boku", fontWeight: 400, fontSize: 100, color: "#B3001B", strokeColor: "#1a0004", strokeWidth: 10, highlightColor: "#fff", animation: "drip", offsetY: 0, rotate: -2 },
  { name: "青白明滅", fontFamily: "Zen Antique", fontWeight: 400, fontSize: 88, color: "#D9F3FF", strokeColor: "#000", strokeWidth: 8, highlightColor: "#B3001B", animation: "flicker", offsetY: 30, letterSpacing: 6 },
  { name: "闇帯白", fontFamily: "Zen Old Mincho", fontWeight: 900, fontSize: 80, color: "#e8e8e8", background: "#000000f0", backgroundRadius: 0, highlightColor: "#B3001B", animation: "typewriter", offsetY: 60, letterSpacing: 8 },
  { name: "筆黒縁赤", fontFamily: "Yuji Boku", fontWeight: 400, fontSize: 104, color: "#111", strokeColor: "#B3001B", strokeWidth: 12, highlightColor: "#fff", animation: "flicker", offsetY: -30 },
  { name: "灰明朝", fontFamily: "Zen Old Mincho", fontWeight: 700, fontSize: 84, color: "#9a9a9a", strokeColor: "#000", strokeWidth: 8, highlightColor: "#D9F3FF", animation: "drip", offsetY: 0, letterSpacing: 10 },
  { name: "赤カラオケ", fontFamily: "Zen Antique", fontWeight: 400, fontSize: 88, color: "#ffffff99", strokeColor: "#000", strokeWidth: 8, highlightColor: "#FF2A2A", animation: "karaoke", offsetY: 20, letterSpacing: 4 },
];

// レトロゲーム・8bit: ドット文字とグリッチ
const retro: CaptionStyle[] = [
  { name: "ドット白", fontFamily: "DotGothic16", fontWeight: 400, fontSize: 88, color: "#fff", strokeColor: "#000", strokeWidth: 10, highlightColor: "#FFE600", animation: "glitch", offsetY: 0, letterSpacing: 4 },
  { name: "ドット緑", fontFamily: "DotGothic16", fontWeight: 400, fontSize: 88, color: "#39FF14", strokeColor: "#003300", strokeWidth: 8, highlightColor: "#fff", animation: "typewriter", offsetY: 40, letterSpacing: 4 },
  { name: "ドット黄帯", fontFamily: "DotGothic16", fontWeight: 400, fontSize: 80, color: "#111", background: "#FFE600", backgroundRadius: 0, highlightColor: "#E5163A", animation: "pop", offsetY: -30, letterSpacing: 2 },
  { name: "ドット青帯", fontFamily: "DotGothic16", fontWeight: 400, fontSize: 80, color: "#fff", background: "#1B2CC1", backgroundRadius: 0, highlightColor: "#FFE600", animation: "glitch", offsetY: 30, letterSpacing: 2 },
  { name: "ドット桃", fontFamily: "DotGothic16", fontWeight: 400, fontSize: 92, color: "#FF5FA2", strokeColor: "#3a0020", strokeWidth: 10, highlightColor: "#fff", animation: "karaoke", offsetY: 0, letterSpacing: 4 },
];

// 高級・ラグジュアリー: 明朝とゴールド、動きは静か
const luxury: CaptionStyle[] = [
  { name: "金明朝", fontFamily: "Zen Old Mincho", fontWeight: 900, fontSize: 80, color: "#E6C067", strokeColor: "#1a1200", strokeWidth: 6, highlightColor: "#fff", animation: "slideUp", offsetY: 0, letterSpacing: 10 },
  { name: "白明朝", fontFamily: "Zen Old Mincho", fontWeight: 700, fontSize: 76, color: "#fff", strokeColor: "#000", strokeWidth: 6, highlightColor: "#E6C067", animation: "typewriter", offsetY: 30, letterSpacing: 12 },
  { name: "黒帯金", fontFamily: "Shippori Mincho", fontWeight: 700, fontSize: 70, color: "#E6C067", background: "#000000d9", backgroundRadius: 0, highlightColor: "#fff", animation: "slideUp", offsetY: 60, letterSpacing: 8 },
  { name: "金アンティーク", fontFamily: "Zen Antique", fontWeight: 400, fontSize: 84, color: "#F1D98A", strokeColor: "#2a1f00", strokeWidth: 8, highlightColor: "#fff", animation: "pop", offsetY: -20, letterSpacing: 8 },
  { name: "白カラオケ金", fontFamily: "Zen Old Mincho", fontWeight: 900, fontSize: 80, color: "#ffffffb3", strokeColor: "#000", strokeWidth: 6, highlightColor: "#E6C067", animation: "karaoke", offsetY: 0, letterSpacing: 8 },
];

// スポーツ・熱血: 斜体風の勢い、叩きつけるように登場
const sports: CaptionStyle[] = [
  { name: "叩きつけ白", fontFamily: "Train One", fontWeight: 400, fontSize: 104, color: "#fff", strokeColor: "#E5163A", strokeWidth: 16, highlightColor: "#FFE600", animation: "slam", offsetY: 0, rotate: -4 },
  { name: "叩きつけ黄", fontFamily: "Rampart One", fontWeight: 400, fontSize: 108, color: "#FFE600", strokeColor: "#000", strokeWidth: 14, highlightColor: "#fff", animation: "slam", offsetY: 30, rotate: -3 },
  { name: "青斜め帯", fontFamily: "Dela Gothic One", fontWeight: 400, fontSize: 84, color: "#fff", background: "#0057FF", backgroundRadius: 4, highlightColor: "#FFE600", animation: "slideUp", offsetY: -30, rotate: -4 },
  { name: "赤斜め帯", fontFamily: "Dela Gothic One", fontWeight: 400, fontSize: 84, color: "#fff", background: "#E5163A", backgroundRadius: 4, highlightColor: "#FFE600", animation: "bounce", offsetY: 30, rotate: -4 },
  { name: "橙カラオケ", fontFamily: "Train One", fontWeight: 400, fontSize: 96, color: "#ffffffcc", strokeColor: "#000", strokeWidth: 12, highlightColor: "#FF8A00", animation: "karaoke", offsetY: 0, rotate: -2 },
];

export const THEMES: Record<ThemeName, CaptionStyle[]> = {
  tempo, variety, pop, cute, neon, calm, lecture, news, mono, horror, retro, luxury, sports,
};

export const THEME_LABELS: Record<ThemeName, string> = {
  tempo: "テンポ重視(8 種を高速切り替え)",
  variety: "バラエティ(太縁・大文字・派手)",
  pop: "ポップ(丸文字・カラフル)",
  cute: "手書き・かわいい",
  neon: "ネオン(暗い映像向け)",
  calm: "落ち着き(明朝・細字)",
  lecture: "講座・ビジネス(信頼感)",
  news: "ニュース・解説(帯付き・動き控えめ)",
  mono: "モノトーン(白黒)",
  horror: "ホラー・怪談(筆文字・明滅・血文字)",
  retro: "レトロゲーム(ドット文字・グリッチ)",
  luxury: "高級・ラグジュアリー(明朝・金)",
  sports: "スポーツ・熱血(叩きつけ・斜め帯)",
};

/** 全テーマで使うフォントの一覧(読み込み用)。 */
export const ALL_FONT_FAMILIES = Array.from(
  new Set(Object.values(THEMES).flat().map((s) => s.fontFamily)),
);

/** 決定的な疑似乱数(seed が同じなら同じ並び)。 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 各行に使うスタイルのインデックスを決める。連続で同じにはしない。 */
export function assignStyles(
  count: number,
  paletteSize: number,
  order: "rotate" | "random",
  seed: number,
  overrides: (number | undefined)[],
): number[] {
  const rnd = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (overrides[i] !== undefined) {
      out.push(overrides[i]! % paletteSize);
      continue;
    }
    if (order === "rotate" || paletteSize < 2) {
      out.push(i % paletteSize);
      continue;
    }
    let pick = Math.floor(rnd() * paletteSize);
    if (pick === out[i - 1]) pick = (pick + 1) % paletteSize;
    out.push(pick);
  }
  return out;
}
