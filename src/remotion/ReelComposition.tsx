import React, { useMemo } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, useVideoConfig, delayRender, continueRender } from "remotion";
import type { CompositionProps } from "../shared/types";
import { THEMES, assignStyles } from "./styles";
import { loadFonts } from "./fonts";
import { CaptionLine } from "./CaptionLine";
import { OverlayText } from "./OverlayText";

/**
 * 縦型リール本体。
 * inputProps に Project を丸ごと受け取り、行ごとに <Sequence> で字幕を並べる。
 * mediaSrc は renderer(Player)では file:// URL、レンダー時は staticFile/絶対パス。
 */
export const ReelComposition: React.FC<CompositionProps> = (p) => {
  const sfxUrls = p.sfxUrls ?? {};
  const sfxVolume = p.sfxVolume ?? 0.6;
  // 字幕・テキストが出る瞬間に鳴らす効果音。音は短いので最大 1 秒で打ち切る
  const sfxFor = (name: string | undefined, key: string, durFrames: number) => {
    const src = name ? sfxUrls[name] : undefined;
    if (!src) return null;
    return <Audio key={key} src={src} volume={sfxVolume} />;
  };
  const { fps } = useVideoConfig();

  const palette = THEMES[p.theme] ?? THEMES.tempo;

  // 使うテーマのフォントだけ読み込み、終わるまでフレームを確定させない
  const families = useMemo(
    () => ["Noto Sans JP", ...palette.map((s) => s.fontFamily), ...(p.overlays ?? []).map((o) => o.fontFamily)],
    [palette, p.overlays],
  );
  const [handle] = React.useState(() => delayRender("fonts", { timeoutInMilliseconds: 120000 }));
  React.useEffect(() => {
    loadFonts(families).finally(() => continueRender(handle));
  }, [handle, families]);
  const styleIdx = useMemo(
    () => assignStyles(p.lines.length, palette.length, p.styleOrder, p.seed, p.lines.map((l) => l.styleIndex)),
    [p.lines, palette.length, p.styleOrder, p.seed],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: p.backgroundColor }}>
      {p.mediaSrc ? (
        p.mediaIsVideo ? (
          <OffthreadVideo src={p.mediaSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Audio src={p.mediaSrc} />
        )
      ) : null}

      {/* 下 1/3 を少し暗くして文字を読みやすく */}
      <AbsoluteFill
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.35) 100%)", pointerEvents: "none" }}
      />

      {p.lines.map((line, i) => {
        const from = Math.round((line.startMs / 1000) * fps);
        const dur = Math.max(1, Math.round(((line.endMs - line.startMs) / 1000) * fps));
        return (
          <Sequence key={line.id} from={from} durationInFrames={dur} name={line.text.slice(0, 12)}>
            {sfxFor(line.sfx, `sfx-${line.id}`, dur)}
            <CaptionLine
              line={line}
              style={palette[styleIdx[i]]}
              speakerColor={line.speaker ? p.speakerColors?.[line.speaker] || undefined : undefined}
              globalScale={p.fontScale ?? 1}
              // 話者 1 は中央、2 人目以降は左右に振って会話らしく見せる
              align={line.speaker === undefined ? "center" : (["center", "right", "left", "center", "right", "left"] as const)[line.speaker % 6]}
            />
          </Sequence>
        );
      })}

      {(p.overlays ?? []).map((o) => {
        const from = Math.round((o.startMs / 1000) * fps);
        const dur = Math.max(1, Math.round(((o.endMs - o.startMs) / 1000) * fps));
        return (
          <Sequence key={o.id} from={from} durationInFrames={dur} name={`T: ${o.text.slice(0, 10)}`}>
            {sfxFor(o.sfx, `sfx-${o.id}`, dur)}
            <OverlayText overlay={o} width={p.width} height={p.height} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
