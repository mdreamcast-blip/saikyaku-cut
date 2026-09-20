import React from "react";
import type { Overlay } from "../shared/types";
import { CaptionLine } from "./CaptionLine";

/**
 * 追加テキスト。見た目のロジックは CaptionLine と同じものを使い、
 * 位置だけ任意の場所に置く。
 */
export const OverlayText: React.FC<{ overlay: Overlay; width: number; height: number }> = ({ overlay: o, width, height }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: o.x * width,
        top: o.y * height,
        width: 0,
        height: 0,
        // CaptionLine は left:0/right:0 + top:50% で中央に置くので、その基準点をここにずらす
      }}
    >
      <div style={{ position: "absolute", left: -width / 2, top: 0, width, height: 0 }}>
        <CaptionLine
          line={{ id: o.id, text: o.text, startMs: o.startMs, endMs: o.endMs, words: [{ text: o.text, startMs: o.startMs, endMs: o.endMs }] }}
          style={{
            name: "overlay",
            fontFamily: o.fontFamily,
            fontWeight: 900,
            fontSize: o.fontSize,
            color: o.color,
            strokeColor: o.strokeWidth > 0 ? o.strokeColor : undefined,
            strokeWidth: o.strokeWidth,
            background: o.background || undefined,
            backgroundRadius: 12,
            highlightColor: o.color,
            animation: o.animation,
            offsetY: 0,
            rotate: o.rotate,
          }}
        />
      </div>
    </div>
  );
};
