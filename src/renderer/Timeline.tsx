import React, { useEffect, useRef, useState } from "react";
import type { Line, Overlay } from "../shared/types";

type Item = { id: string; startMs: number; endMs: number; label: string; color?: string };

type Props = {
  durationMs: number;
  currentMs: number;
  playing: boolean;
  mediaIsVideo: boolean;
  mediaName: string;
  lines: Line[];
  overlays: Overlay[];
  selectedId: string | null;
  speakerColors: string[];
  onSeek: (ms: number) => void;
  onTogglePlay: () => void;
  onSelect: (kind: "line" | "overlay", id: string) => void;
  onMoveLine: (id: string, startMs: number, endMs: number) => void;
  onMoveOverlay: (id: string, startMs: number, endMs: number) => void;
  onAddTextAt: (ms: number) => void;
};

const MIN_LEN = 200;
const LABEL_W = 84;

const tc = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const f = Math.floor((ms % 1000) / 33.34);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
};

/**
 * CapCut 風のタイムライン。
 * 上: 再生/停止・タイムコード・拡大率。中: 目盛りと再生ヘッド(ドラッグ可)。
 * 下: 動画 / 字幕 / テキスト の 3 トラック。ブロックはドラッグで移動、両端で長さ変更。
 */
export const Timeline: React.FC<Props> = (p) => {
  const [pxPerSec, setPxPerSec] = useState(60);
  const scroller = useRef<HTMLDivElement>(null);
  const width = (p.durationMs / 1000) * pxPerSec + 120;
  const x = (ms: number) => (ms / 1000) * pxPerSec;
  const toMs = (clientX: number) => {
    const el = scroller.current!;
    const rect = el.getBoundingClientRect();
    const px = clientX - rect.left - LABEL_W + el.scrollLeft;
    return Math.max(0, Math.min(p.durationMs, (px / pxPerSec) * 1000));
  };

  // 再生中は再生ヘッドに追従
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const hx = x(p.currentMs) + LABEL_W;
    if (hx < el.scrollLeft + LABEL_W || hx > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, hx - LABEL_W - el.clientWidth / 3);
  }, [p.currentMs, pxPerSec]);

  // スペースキーで再生/停止(入力中は除く)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code === "Space" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) { e.preventDefault(); p.onTogglePlay(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [p.onTogglePlay]);

  const drag = useRef<{ kind: "line" | "overlay"; id: string; mode: "move" | "start" | "end"; originX: number; s: number; e: number } | null>(null);
  const onBlockDown = (ev: React.MouseEvent, kind: "line" | "overlay", it: Item, mode: "move" | "start" | "end") => {
    ev.stopPropagation(); ev.preventDefault();
    p.onSelect(kind, it.id);
    drag.current = { kind, id: it.id, mode, originX: ev.clientX, s: it.startMs, e: it.endMs };
    const move = (e: MouseEvent) => {
      const d = drag.current; if (!d) return;
      const delta = ((e.clientX - d.originX) / pxPerSec) * 1000;
      let s = d.s, en = d.e;
      if (d.mode === "move") { s = d.s + delta; en = d.e + delta; if (s < 0) { en -= s; s = 0; } if (en > p.durationMs) { s -= en - p.durationMs; en = p.durationMs; } }
      if (d.mode === "start") s = Math.min(d.s + delta, d.e - MIN_LEN);
      if (d.mode === "end") en = Math.max(d.e + delta, d.s + MIN_LEN);
      (d.kind === "line" ? p.onMoveLine : p.onMoveOverlay)(d.id, Math.max(0, Math.round(s)), Math.min(p.durationMs, Math.round(en)));
    };
    const up = () => { drag.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  // 目盛り・トラックの空き部分: 押した位置へ移動し、そのままドラッグでスクラブ
  const onScrubDown = (ev: React.MouseEvent) => {
    ev.preventDefault();
    p.onSeek(toMs(ev.clientX));
    const move = (e: MouseEvent) => p.onSeek(toMs(e.clientX));
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  const step = pxPerSec >= 120 ? 1 : pxPerSec >= 50 ? 2 : pxPerSec >= 25 ? 5 : pxPerSec >= 10 ? 10 : 30;
  const ticks: number[] = [];
  for (let t = 0; t <= p.durationMs / 1000; t += step) ticks.push(t);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const track = (kind: "line" | "overlay", label: string, items: Item[], onDbl?: (ms: number) => void) => (
    <div className="tlRow">
      <div className="tlLabel">{label}</div>
      <div className="track" onMouseDown={onScrubDown} onDoubleClick={onDbl ? (e) => onDbl(toMs(e.clientX)) : undefined} title={onDbl ? "ダブルクリックでここにテキスト追加" : undefined}>
        {items.map((it) => (
          <div
            key={it.id}
            className={`block ${kind} ${p.selectedId === it.id ? "sel" : ""}`}
            style={{ left: x(it.startMs), width: Math.max(6, x(it.endMs) - x(it.startMs)), borderColor: it.color }}
            onMouseDown={(e) => onBlockDown(e, kind, it, "move")}
            onDoubleClick={(e) => e.stopPropagation()}
            title={it.label}
          >
            <span className="grip l" onMouseDown={(e) => onBlockDown(e, kind, it, "start")} />
            <span className="blockLabel">{it.label}</span>
            <span className="grip r" onMouseDown={(e) => onBlockDown(e, kind, it, "end")} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="timeline">
      <div className="transport">
        <button className="play" onClick={p.onTogglePlay} title="スペースキーでも再生/停止">{p.playing ? "❚❚" : "▶"}</button>
        <span className="tcode">{tc(p.currentMs)} <span className="hint">/ {tc(p.durationMs)}</span></span>
        <span className="spacer" />
        <span className="hint">ブロック: ドラッグで移動・両端で長さ変更 / 空き部分: クリックで移動 / テキスト行: ダブルクリックで追加</span>
        <span className="spacer" />
        <span className="hint">－</span>
        <input type="range" min={8} max={240} value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} />
        <span className="hint">＋</span>
      </div>
      <div className="tlScroll" ref={scroller}>
        <div className="tlInner" style={{ width: width + LABEL_W }}>
          <div className="tlRow">
            <div className="tlLabel" />
            <div className="ruler" onMouseDown={onScrubDown}>
              {ticks.map((t) => <span key={t} className="tick" style={{ left: x(t * 1000) }}>{fmt(t)}</span>)}
            </div>
          </div>
          <div className="tlRow">
            <div className="tlLabel">{p.mediaIsVideo ? "動画" : "音声"}</div>
            <div className="track media" onMouseDown={onScrubDown}>
              <div className="block media" style={{ left: 0, width: x(p.durationMs) }}><span className="blockLabel">🎞 {p.mediaName}</span></div>
            </div>
          </div>
          {track("line", "字幕", p.lines.map((l) => ({ id: l.id, startMs: l.startMs, endMs: l.endMs, label: (l.sfx ? "🔊" : "") + l.text, color: l.speaker ? p.speakerColors[l.speaker] : undefined })))}
          {track("overlay", "テキスト", p.overlays.map((o) => ({ id: o.id, startMs: o.startMs, endMs: o.endMs, label: (o.sfx ? "🔊" : "") + o.text })), p.onAddTextAt)}
          <div className="playhead" style={{ left: LABEL_W + x(p.currentMs) }}><span className="phHead" /></div>
        </div>
      </div>
    </div>
  );
};
