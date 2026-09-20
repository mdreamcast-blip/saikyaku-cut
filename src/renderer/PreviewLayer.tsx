import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CaptionStyle, Line, Overlay, Project } from "../shared/types";
import { THEMES, assignStyles } from "../remotion/styles";

type Props = {
  project: Project;
  currentMs: number;
  selectedId: string | null;
  onSelect: (kind: "line" | "overlay", id: string) => void;
  onLineText: (id: string, text: string) => void;
  onLineChange: (id: string, patch: Partial<Line>) => void;
  onOverlayChange: (id: string, patch: Partial<Overlay>) => void;
  onEmptyClick: () => void;
};

type Drag = { kind: "line" | "overlay"; id: string; mode: "move" | "scale"; ox: number; oy: number; sx: number; sy: number; sScale: number; sSize: number; moved: boolean };

/**
 * プレビューの上に重ねる編集レイヤー(CapCut 風)。
 * ・クリックで選択 → 枠とハンドルが出る
 * ・ドラッグで移動(字幕は上下、追加テキストは自由)
 * ・角のハンドルで拡大縮小
 * ・ダブルクリックでその場で文言を編集
 * 字幕の位置は Remotion 側と同じ計算(中央 + offsetY)で求める。
 */
export const PreviewLayer: React.FC<Props> = ({ project: p, currentMs, selectedId, onSelect, onLineText, onLineChange, onOverlayChange, onEmptyClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [editing, setEditing] = useState<{ kind: "line" | "overlay"; id: string; text: string } | null>(null);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = size.h / p.height;
  const palette = THEMES[p.theme] ?? THEMES.tempo;
  const styleIdx = useMemo(
    () => assignStyles(p.lines.length, palette.length, p.styleOrder, p.seed, p.lines.map((l) => l.styleIndex)),
    [p.lines, palette.length, p.styleOrder, p.seed],
  );

  // 今の再生位置に出ているものだけに枠を出す(選択中でも出ていなければ枠は出さない。
  // 選択時に再生位置がそこへ移動するので、通常は選択中のものが見えている)
  const visibleLines = p.lines.map((l, i) => ({ l, i })).filter(({ l }) => currentMs >= l.startMs && currentMs < l.endMs);
  const visibleOverlays = p.overlays.filter((o) => currentMs >= o.startMs && currentMs < o.endMs);

  const len = (s: string) => Array.from(s).length;

  const lineBox = (l: Line, style: CaptionStyle) => {
    const fs = style.fontSize * (p.fontScale ?? 1) * (l.fontScale ?? 1) * scale;
    const cy = size.h / 2 + (style.offsetY + (l.offsetY ?? 0)) * scale;
    const rows = Math.max(1, Math.ceil(len(l.text) / 14));
    const h = fs * 1.35 * rows + 16;
    const w = Math.min(size.w - 24, Math.max(fs * 2, Math.min(len(l.text), 14) * fs * 1.05 + 40));
    return { top: cy - h / 2, left: (size.w - w) / 2, width: w, height: h, fontSize: fs };
  };
  const overlayBox = (o: Overlay) => {
    const fs = o.fontSize * scale;
    const rows = o.text.split("\n").length;
    const h = fs * 1.35 * rows + 16;
    const w = Math.min(size.w - 16, Math.max(fs * 2, Math.max(...o.text.split("\n").map(len)) * fs * 1.05 + 40));
    return { top: o.y * size.h - h / 2, left: o.x * size.w - w / 2, width: w, height: h, fontSize: fs };
  };

  const commit = () => {
    if (!editing) return;
    const t = editing.text.trim();
    if (editing.kind === "line") { if (t) onLineText(editing.id, t); } else onOverlayChange(editing.id, { text: editing.text });
    setEditing(null);
  };

  const beginDrag = (ev: React.MouseEvent, kind: "line" | "overlay", id: string, mode: "move" | "scale") => {
    if (editing?.id === id) return;
    ev.preventDefault();
    ev.stopPropagation();
    onSelect(kind, id);
    const l = p.lines.find((x) => x.id === id);
    const o = p.overlays.find((x) => x.id === id);
    drag.current = {
      kind, id, mode, ox: ev.clientX, oy: ev.clientY,
      sx: o?.x ?? 0.5, sy: o ? o.y : (l?.offsetY ?? 0),
      sScale: l?.fontScale ?? 1, sSize: o?.fontSize ?? 96, moved: false,
    };
    const move = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.ox, dy = e.clientY - d.oy;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (d.mode === "move") {
        if (d.kind === "overlay") onOverlayChange(d.id, { x: clamp(d.sx + dx / size.w), y: clamp(d.sy + dy / size.h) });
        else onLineChange(d.id, { offsetY: Math.round(d.sy + dy / scale) });
      } else {
        // 右下ハンドル: 右下に引くほど大きく
        const k = 1 + (dx + dy) / 300;
        if (d.kind === "overlay") onOverlayChange(d.id, { fontSize: Math.round(Math.min(260, Math.max(24, d.sSize * k))) });
        else onLineChange(d.id, { fontScale: Math.round(Math.min(2.2, Math.max(0.4, d.sScale * k)) * 20) / 20 });
      }
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); drag.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  const inputStyle = (fs: number, color: string, family: string): React.CSSProperties => ({
    fontSize: Math.max(14, fs), fontFamily: `"${family}", "Noto Sans JP", sans-serif`, fontWeight: 900, color,
    textAlign: "center", lineHeight: 1.3, textShadow: "0 2px 8px #000",
  });

  const renderBox = (kind: "line" | "overlay", id: string, box: { top: number; left: number; width: number; height: number; fontSize: number }, text: string, color: string, family: string, rotate = 0) => {
    const sel = selectedId === id;
    const isEd = editing?.id === id;
    return (
      <div
        key={id}
        className={`pvBox ${sel ? "sel" : ""} ${kind}`}
        style={{ top: box.top, left: box.left, width: box.width, height: box.height, transform: `rotate(${rotate}deg)` }}
        onMouseDown={(e) => beginDrag(e, kind, id, "move")}
        onDoubleClick={(e) => { e.stopPropagation(); onSelect(kind, id); setEditing({ kind, id, text }); }}
        title={kind === "line" ? "ドラッグで上下移動・ダブルクリックで編集" : "ドラッグで移動・ダブルクリックで編集"}
      >
        {sel && !isEd && (
          <>
            <span className="hd tl" /><span className="hd tr" /><span className="hd bl" />
            <span className="hd br scale" onMouseDown={(e) => beginDrag(e, kind, id, "scale")} title="ドラッグで大きさ変更" />
          </>
        )}
        {isEd && (
          <textarea
            autoFocus
            className="pvEdit"
            style={inputStyle(box.fontSize, color, family)}
            value={editing.text}
            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); } if (e.key === "Escape") setEditing(null); }}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    );
  };

  return (
    <div className="pvLayer" ref={ref} onMouseDown={() => { if (!editing) onEmptyClick(); }}>
      {visibleLines.map(({ l, i }) => {
        const st = palette[styleIdx[i]];
        return renderBox("line", l.id, lineBox(l, st), l.text, (l.speaker && p.speakerColors[l.speaker]) || st.color, st.fontFamily, st.rotate ?? 0);
      })}
      {visibleOverlays.map((o) => renderBox("overlay", o.id, overlayBox(o), o.text, o.color, o.fontFamily, o.rotate))}
    </div>
  );
};
