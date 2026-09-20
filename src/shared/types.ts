// main / renderer / remotion の3か所で共有する型。

/** 1単語(文節)とその時刻(ミリ秒)。 */
export type Word = { text: string; startMs: number; endMs: number };

/** 画面に出す1行。 */
export type Line = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  words: Word[];
  /** 演出プリセットのインデックス。未指定なら順番に割り当てる。 */
  styleIndex?: number;
  /** 強調したい単語のインデックス(words 内)。 */
  emphasis?: number[];
  /** 話者番号(0 始まり)。話者分離を使ったときだけ入る。 */
  speaker?: number;
  /** この行だけ文字サイズを倍率で変える(1 = テーマ既定) */
  fontScale?: number;
  /** この行だけ上下位置をずらす(px、正で下) */
  offsetY?: number;
  /** 出るときの効果音の名前(SFX_LIST の name)。未指定なら鳴らさない */
  sfx?: string;
};

/** 同梱の効果音。assets/sfx/<name>.wav */
export const SFX_LIST = [
  { name: "bishi", label: "ビシ!" },
  { name: "pon", label: "ポン" },
  { name: "kachi", label: "カチ" },
  { name: "shu", label: "シュッ" },
  { name: "don", label: "ドン" },
] as const;
export type SfxName = (typeof SFX_LIST)[number]["name"];

export type AnimationKind =
  | "pop"
  | "slideUp"
  | "typewriter"
  | "bounce"
  | "shake"
  | "karaoke"
  | "flip"
  | "zoomBlur"
  | "flicker"   // 蛍光灯のように明滅して現れる(ホラー)
  | "drip"      // にじみながら上から垂れてくる(ホラー)
  | "glitch"    // 横ずれのノイズ(レトロ・ゲーム)
  | "slam";     // 巨大→通常に叩きつける(スポーツ)

/** 1行分の見た目。 */
export type CaptionStyle = {
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  background?: string;
  backgroundRadius?: number;
  highlightColor: string;
  animation: AnimationKind;
  /** 0 = 中央, 負 = 上寄り, 正 = 下寄り (px) */
  offsetY: number;
  rotate?: number;
  letterSpacing?: number;
};

/** 音声と無関係に置く追加テキスト(タイトル・注釈・CTA など)。 */
export type Overlay = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  /** 位置。0〜1 の割合(x: 左→右, y: 上→下)。中心基準 */
  x: number;
  y: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  background: string; // "" なら帯なし
  rotate: number;
  animation: AnimationKind;
  sfx?: string;
};

export const OVERLAY_FONTS = [
  "Noto Sans JP", "Zen Kaku Gothic New", "Dela Gothic One", "M PLUS Rounded 1c", "Yusei Magic",
  "Reggae One", "RocknRoll One", "Shippori Mincho", "Zen Old Mincho", "Zen Antique", "Yuji Boku",
  "DotGothic16", "Train One", "Rampart One",
];

export const DEFAULT_OVERLAY: Omit<Overlay, "id" | "startMs" | "endMs"> = {
  text: "テキスト",
  x: 0.5,
  y: 0.2,
  fontFamily: "Dela Gothic One",
  fontSize: 96,
  color: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 12,
  background: "",
  rotate: 0,
  animation: "pop",
};

export type ThemeName =
  | "tempo" | "variety" | "pop" | "cute" | "neon" | "calm" | "lecture" | "news" | "mono"
  | "horror" | "retro" | "luxury" | "sports";

/** 無音カットの設定。 */
export type SilenceOptions = {
  /** これより小さい音量を無音とみなす(dB)。-30 前後が目安。 */
  thresholdDb: number;
  /** この長さ以上の無音だけカットする(ms)。 */
  minSilenceMs: number;
  /** 声の前後に残す余白(ms)。詰めすぎると不自然になる。 */
  paddingMs: number;
};

export const DEFAULT_SILENCE: SilenceOptions = { thresholdDb: -32, minSilenceMs: 600, paddingMs: 150 };

/** プロジェクト全体の設定。Remotion に inputProps として渡す。 */
export type Project = {
  /** ユーザーが最初に選んだファイル。 */
  sourcePath: string;
  /** 実際に字幕を付けて書き出す素材。無音カット後は一時ファイルになる。 */
  mediaPath: string;
  mediaIsVideo: boolean;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  theme: ThemeName;
  lines: Line[];
  /** 行ごとにスタイルを順に回すか、ランダムにするか */
  styleOrder: "rotate" | "random";
  seed: number;
  /** 動画がない場合の背景色 */
  backgroundColor: string;
  /** 1行に入れる最大文字数 */
  maxCharsPerLine: number;
  granularity: Granularity;
  /** 認識精度を上げるための用語(固有名詞・商品名など)。空白か改行区切り。 */
  dictionary: string;
  silence: SilenceOptions;
  /** 無音カットで削った合計(表示用) */
  removedMs?: number;
  /** 会話動画で話者ごとに分けるか */
  diarize: boolean;
  /** 話者の人数。0 なら自動推定(分けすぎることがあるので人数指定を推奨) */
  numSpeakers: number;
  /** 話者ごとの文字色。話者 1 は既定のスタイル色のまま、話者 2 以降はこの色で上書き */
  speakerColors: string[];
  /** 追加テキスト */
  overlays: Overlay[];
  /** 効果音の音量(0〜1) */
  sfxVolume: number;
  /** 新しく作る字幕・テキストに最初から付ける効果音("" なら付けない) */
  sfxDefault: string;
};

export const DEFAULT_SPEAKER_COLORS = ["", "#7CFF6B", "#5EEBFF", "#FF8FC2", "#FFB300", "#C4A7FF"];

export const DEFAULT_PROJECT: Omit<Project, "sourcePath" | "mediaPath" | "mediaIsVideo" | "durationMs"> = {
  width: 1080,
  height: 1920,
  fps: 30,
  theme: "tempo",
  lines: [],
  styleOrder: "rotate",
  seed: 1,
  backgroundColor: "#0b0b12",
  maxCharsPerLine: 8,
  granularity: "fine",
  dictionary: "",
  silence: DEFAULT_SILENCE,
  diarize: false,
  numSpeakers: 2,
  speakerColors: DEFAULT_SPEAKER_COLORS,
  overlays: [],
  sfxVolume: 0.6,
  sfxDefault: "",
};

/** 字幕の細かさ。fine = 一言ごと(文節 1〜2 個)、normal = 助詞・読点区切り、long = 句点まで */
export type Granularity = "fine" | "normal" | "long";

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  fine: "細かい(文節ごと・最長 1 秒)",
  normal: "標準(文節のまとまりごと)",
  long: "長め(文ごと)",
};

export type TranscribeOptions = { maxCharsPerLine: number; dictionary: string; diarize: boolean; numSpeakers: number; granularity: Granularity };

/** main → renderer の進捗通知 */
export type Progress = { stage: string; ratio: number; message?: string };

export type MediaInfo = { path: string; isVideo: boolean; durationMs: number };

/** preload で公開する API。 */
export type Api = {
  pickMedia: () => Promise<MediaInfo | null>;
  pickSavePath: (defaultName: string) => Promise<string | null>;
  ensureWhisper: () => Promise<{ ok: boolean; message: string }>;
  transcribe: (mediaPath: string, opts: TranscribeOptions) => Promise<Line[]>;
  /** 無音を検出して詰めた一時ファイルを作る。 */
  cutSilence: (mediaPath: string, opts: SilenceOptions) => Promise<MediaInfo & { removedMs: number; segments: number }>;
  render: (project: Project, outPath: string) => Promise<{ ok: boolean; message: string }>;
  /** 文言を直したあと、単語の区切りと時刻を振り直す。 */
  resegment: (text: string, startMs: number, endMs: number) => Promise<Word[]>;
  onProgress: (cb: (p: Progress) => void) => () => void;
  toFileUrl: (p: string) => string;
  /** 同梱効果音の再生 URL(Player 用) */
  sfxUrl: (name: string) => string;
};

/** Remotion に渡す入力。Project に、再生環境ごとの URL を足したもの */
export type CompositionProps = Project & { mediaSrc: string; sfxUrls: Record<string, string> };
