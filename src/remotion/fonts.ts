// Google Fonts を Remotion 経由で読み込む。
// 日本語フォントは 1 書体あたり 100 以上のファイルに分かれているので、
// 全部を一度に読むと描画エンジンがタイムアウトする。使うテーマの分だけ読む。
import { loadFont as delaGothic } from "@remotion/google-fonts/DelaGothicOne";
import { loadFont as zenKaku } from "@remotion/google-fonts/ZenKakuGothicNew";
import { loadFont as notoSansJP } from "@remotion/google-fonts/NotoSansJP";
import { loadFont as yuseiMagic } from "@remotion/google-fonts/YuseiMagic";
import { loadFont as mplusRounded } from "@remotion/google-fonts/MPLUSRounded1c";
import { loadFont as reggaeOne } from "@remotion/google-fonts/ReggaeOne";
import { loadFont as shipporiMincho } from "@remotion/google-fonts/ShipporiMincho";
import { loadFont as rocknRoll } from "@remotion/google-fonts/RocknRollOne";
import { loadFont as yujiBoku } from "@remotion/google-fonts/YujiBoku";
import { loadFont as zenAntique } from "@remotion/google-fonts/ZenAntique";
import { loadFont as dotGothic } from "@remotion/google-fonts/DotGothic16";
import { loadFont as zenOldMincho } from "@remotion/google-fonts/ZenOldMincho";
import { loadFont as trainOne } from "@remotion/google-fonts/TrainOne";
import { loadFont as rampartOne } from "@remotion/google-fonts/RampartOne";

const opts = { subsets: ["japanese", "latin"] as ("japanese" | "latin")[], ignoreTooManyRequestsWarning: true };

// フォント名(CSS の font-family) → 読み込み関数
const LOADERS: Record<string, () => Promise<unknown>> = {
  "Dela Gothic One": () => delaGothic("normal", { weights: ["400"], ...opts }).waitUntilDone(),
  "Zen Kaku Gothic New": () => zenKaku("normal", { weights: ["300", "700", "900"], ...opts }).waitUntilDone(),
  "Noto Sans JP": () => notoSansJP("normal", { weights: ["500", "700", "900"], ...opts }).waitUntilDone(),
  "Yusei Magic": () => yuseiMagic("normal", { weights: ["400"], ...opts }).waitUntilDone(),
  "M PLUS Rounded 1c": () => mplusRounded("normal", { weights: ["900"], ...opts }).waitUntilDone(),
  "Reggae One": () => reggaeOne("normal", { weights: ["400"], ...opts }).waitUntilDone(),
  "Shippori Mincho": () => shipporiMincho("normal", { weights: ["700"], ...opts }).waitUntilDone(),
  "RocknRoll One": () => rocknRoll("normal", { weights: ["400"], ...opts }).waitUntilDone(),
  "Yuji Boku": () => yujiBoku("normal", { weights: ["400"], ...opts }).waitUntilDone(),
  "Zen Antique": () => zenAntique("normal", { weights: ["400"], ...opts }).waitUntilDone(),
  "DotGothic16": () => dotGothic("normal", { weights: ["400"], ...opts }).waitUntilDone(),
  "Zen Old Mincho": () => zenOldMincho("normal", { weights: ["700", "900"], ...opts }).waitUntilDone(),
  "Train One": () => trainOne("normal", { weights: ["400"], ...opts }).waitUntilDone(),
  "Rampart One": () => rampartOne("normal", { weights: ["400"], ...opts }).waitUntilDone(),
};

const loaded = new Map<string, Promise<unknown>>();

/** 指定したフォント名だけを読み込む。同じ名前は 1 回しか読まない。 */
export function loadFonts(families: string[]) {
  const unique = Array.from(new Set(families));
  return Promise.all(
    unique.map((f) => {
      const loader = LOADERS[f];
      if (!loader) return Promise.resolve();
      if (!loaded.has(f)) loaded.set(f, loader().catch((e) => console.warn(`font load failed: ${f}`, e)));
      return loaded.get(f)!;
    }),
  );
}
