import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import type { CaptionStyle, Line } from "../shared/types";

type Props = {
  line: Line;
  style: CaptionStyle;
  /** 話者ごとの色。指定があれば style.color を上書き */
  speakerColor?: string;
  align?: "center" | "left" | "right";
  /** 全体の文字サイズ倍率(Project.fontScale) */
  globalScale?: number;
};

/**
 * 1行分の字幕。行の開始フレームを 0 とした相対フレームで動かす。
 * 親の <Sequence> で行の区間に切り出されている前提。
 */
export const CaptionLine: React.FC<Props> = ({ line, style: baseStyle, speakerColor, align = "center", globalScale = 1 }) => {
  // 行ごとの上書き(話者色・サイズ倍率・位置)。サイズは 全体倍率 × 行倍率
  const style: CaptionStyle = {
    ...baseStyle,
    color: speakerColor ?? baseStyle.color,
    fontSize: Math.round(baseStyle.fontSize * globalScale * (line.fontScale ?? 1)),
    offsetY: baseStyle.offsetY + (line.offsetY ?? 0),
  };
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = Math.max(1, Math.round(((line.endMs - line.startMs) / 1000) * fps));
  const nowMs = line.startMs + (frame / fps) * 1000;

  // 退場: 最後の 6 フレームでフェード
  const exit = interpolate(frame, [durationFrames - 6, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 180, mass: 0.6 } });
  const stiff = spring({ frame, fps, config: { damping: 8, stiffness: 260, mass: 0.5 } });

  let transform = "";
  let opacity = 1;
  let filter = "";

  switch (style.animation) {
    case "pop":
      transform = `scale(${interpolate(stiff, [0, 1], [0.4, 1])})`;
      opacity = interpolate(frame, [0, 3], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "slideUp":
      transform = `translateY(${interpolate(enter, [0, 1], [80, 0])}px)`;
      opacity = interpolate(enter, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "bounce": {
      const y = interpolate(stiff, [0, 1], [-140, 0]);
      transform = `translateY(${y}px) scaleY(${interpolate(stiff, [0, 0.7, 1], [1.2, 0.9, 1])})`;
      break;
    }
    case "shake": {
      const amp = interpolate(frame, [0, 10], [10, 0], { extrapolateRight: "clamp" });
      const x = Math.sin(frame * 2.4) * amp;
      const r = Math.sin(frame * 1.9) * amp * 0.4;
      transform = `translateX(${x}px) rotate(${r}deg) scale(${interpolate(enter, [0, 1], [0.8, 1])})`;
      break;
    }
    case "flip":
      transform = `perspective(900px) rotateX(${interpolate(enter, [0, 1], [90, 0])}deg)`;
      opacity = interpolate(enter, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "zoomBlur": {
      const s = interpolate(frame, [0, 8], [2.2, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
      transform = `scale(${s})`;
      filter = `blur(${interpolate(frame, [0, 8], [12, 0], { extrapolateRight: "clamp" })}px)`;
      opacity = interpolate(frame, [0, 4], [0, 1], { extrapolateRight: "clamp" });
      break;
    }
    case "flicker": {
      // 最初の 14 フレームだけ不規則に明滅し、その後は薄く揺らぐ
      const seq = [0, 1, 0, 0, 1, 0.3, 1, 0, 1, 1, 0.2, 1, 1, 1];
      const base = frame < seq.length ? seq[frame] : 1;
      const hum = 0.92 + 0.08 * Math.sin(frame * 1.7) * Math.sin(frame * 0.6);
      opacity = base * hum;
      transform = `scale(${1 + (frame < seq.length && seq[frame] === 1 ? 0.02 : 0)})`;
      break;
    }
    case "drip": {
      const y = interpolate(frame, [0, 14], [-60, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
      const skew = interpolate(frame, [0, 14], [-6, 0], { extrapolateRight: "clamp" });
      transform = `translateY(${y}px) skewY(${skew}deg) scaleY(${interpolate(frame, [0, 14], [1.4, 1], { extrapolateRight: "clamp" })})`;
      filter = `blur(${interpolate(frame, [0, 14], [10, 0], { extrapolateRight: "clamp" })}px)`;
      opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
      break;
    }
    case "glitch": {
      // 最初の 8 フレームは横にずれてチラつく。以降は 20 フレームに一度小さくずれる
      const active = frame < 8 || frame % 20 === 0;
      const dx = active ? Math.sin(frame * 12.9898) * 18 : 0;
      const sk = active ? Math.cos(frame * 7.233) * 4 : 0;
      transform = `translateX(${dx}px) skewX(${sk}deg)`;
      opacity = frame < 8 && frame % 2 === 1 ? 0.35 : 1;
      break;
    }
    case "slam": {
      const s = interpolate(frame, [0, 5], [3, 1], { extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });
      const shakeAmp = interpolate(frame, [5, 14], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const dx = frame > 4 ? Math.sin(frame * 4.1) * shakeAmp : 0;
      const dy = frame > 4 ? Math.cos(frame * 5.3) * shakeAmp : 0;
      transform = `translate(${dx}px, ${dy}px) scale(${s})`;
      opacity = interpolate(frame, [0, 3], [0, 1], { extrapolateRight: "clamp" });
      break;
    }
    case "typewriter":
    case "karaoke":
    default:
      opacity = interpolate(frame, [0, 2], [0, 1], { extrapolateRight: "clamp" });
      break;
  }

  // タイプライター: 表示する文字数を時間で増やす
  const chars = Array.from(line.text);
  const typedCount =
    style.animation === "typewriter"
      ? Math.min(chars.length, Math.floor(interpolate(frame, [0, Math.min(durationFrames * 0.6, chars.length * 1.5)], [0, chars.length], { extrapolateRight: "clamp" })))
      : chars.length;

  const textShadow = style.strokeColor
    ? `0 4px 0 ${style.strokeColor}, 0 6px 18px rgba(0,0,0,.45)`
    : "0 6px 18px rgba(0,0,0,.45)";

  const baseText: React.CSSProperties = {
    fontFamily: `"${style.fontFamily}", "Noto Sans JP", sans-serif`,
    fontWeight: style.fontWeight,
    fontSize: style.fontSize,
    letterSpacing: style.letterSpacing ?? 0,
    lineHeight: 1.25,
    color: style.color,
    // -webkit-text-stroke は塗りの内側まで侵食するので paint-order で外側に出す
    WebkitTextStroke: style.strokeColor ? `${style.strokeWidth ?? 8}px ${style.strokeColor}` : undefined,
    paintOrder: "stroke fill",
    textShadow,
    whiteSpace: "pre-wrap",
    wordBreak: "keep-all",
    textAlign: "center",
  };

  const wrapper: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    display: "flex",
    justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
    padding: "0 60px",
    transform: `translateY(-50%) translateY(${style.offsetY}px) rotate(${style.rotate ?? 0}deg)`,
  };

  const box: React.CSSProperties = {
    display: "inline-block",
    padding: style.background ? "18px 40px" : 0,
    background: style.background,
    borderRadius: style.backgroundRadius ?? 0,
    transform,
    opacity: opacity * exit,
    filter,
    maxWidth: "100%",
  };

  // 単語ごとの描画。カラオケは発話中の単語をハイライト、強調語は常に色替え+拡大。
  const renderWords = () => {
    if (!line.words.length || style.animation === "typewriter") {
      return <span style={baseText}>{chars.slice(0, typedCount).join("")}</span>;
    }
    return (
      <span style={baseText}>
        {line.words.map((w, i) => {
          const active = style.animation === "karaoke" && nowMs >= w.startMs && nowMs < w.endMs + 80;
          const emph = line.emphasis?.includes(i);
          const hi = active || emph;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                color: hi ? style.highlightColor : undefined,
                transform: hi ? `scale(${emph ? 1.18 : 1.1})` : undefined,
                transition: "none",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <div style={wrapper}>
      <div style={box}>{renderWords()}</div>
    </div>
  );
};
