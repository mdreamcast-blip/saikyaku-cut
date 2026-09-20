import React, { useEffect, useState } from "react";
import { OVERLAY_FONTS, SFX_LIST, type AnimationKind, type Overlay } from "../shared/types";

const ANIMS: { v: AnimationKind; label: string }[] = [
  { v: "pop", label: "ポップ" }, { v: "slideUp", label: "下から" }, { v: "bounce", label: "バウンド" }, { v: "shake", label: "揺れ" },
  { v: "typewriter", label: "タイプ" }, { v: "flip", label: "回転" }, { v: "zoomBlur", label: "ズーム" }, { v: "slam", label: "叩きつけ" },
  { v: "flicker", label: "明滅" }, { v: "drip", label: "にじみ" }, { v: "glitch", label: "グリッチ" }, { v: "karaoke", label: "なし(静止)" },
];

type Props = {
  overlay: Overlay;
  onChange: (patch: Partial<Overlay>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSeek: (ms: number) => void;
};

const toSec = (ms: number) => (ms / 1000).toFixed(2);
const fromSec = (s: string) => Math.max(0, Math.round(parseFloat(s || "0") * 1000));

/** 追加テキスト 1 つ分の編集パネル。 */
export const OverlayEditor: React.FC<Props> = ({ overlay: o, onChange, onDelete, onDuplicate, onSeek }) => {
  const [start, setStart] = useState(toSec(o.startMs));
  const [end, setEnd] = useState(toSec(o.endMs));
  useEffect(() => { setStart(toSec(o.startMs)); setEnd(toSec(o.endMs)); }, [o.id, o.startMs, o.endMs]);

  const commitTime = () => {
    const s = fromSec(start);
    const e = Math.max(fromSec(end), s + 200);
    if (s !== o.startMs || e !== o.endMs) onChange({ startMs: s, endMs: e });
  };

  return (
    <div className="editor">
      <div className="editorHead">
        <b>追加テキスト</b>
        <span>
          <button className="mini" onClick={() => onSeek(o.startMs)}>▶ ここを再生</button>{" "}
          <button className="mini" onClick={onDuplicate}>複製</button>{" "}
          <button className="mini danger" onClick={onDelete}>削除</button>
        </span>
      </div>

      <label className="field">
        <span>文言(改行可)</span>
        <textarea rows={2} value={o.text} onChange={(e) => onChange({ text: e.target.value })} />
      </label>

      <div className="row">
        <label className="field inline"><span>開始(秒)</span><input type="number" step={0.05} value={start} onChange={(e) => setStart(e.target.value)} onBlur={commitTime} /></label>
        <label className="field inline"><span>終了(秒)</span><input type="number" step={0.05} value={end} onChange={(e) => setEnd(e.target.value)} onBlur={commitTime} /></label>
        <label className="field inline">
          <span>フォント</span>
          <select value={o.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>
            {OVERLAY_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="field inline">
          <span>動き</span>
          <select value={o.animation} onChange={(e) => onChange({ animation: e.target.value as AnimationKind })}>
            {ANIMS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
          </select>
        </label>
      </div>

      <div className="row">
        <label className="field inline"><span>横位置 {Math.round(o.x * 100)}%</span><input type="range" min={0} max={1} step={0.01} value={o.x} onChange={(e) => onChange({ x: Number(e.target.value) })} /></label>
        <label className="field inline"><span>縦位置 {Math.round(o.y * 100)}%</span><input type="range" min={0} max={1} step={0.01} value={o.y} onChange={(e) => onChange({ y: Number(e.target.value) })} /></label>
        <label className="field inline"><span>大きさ {o.fontSize}</span><input type="range" min={32} max={220} step={2} value={o.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} /></label>
        <label className="field inline"><span>回転 {o.rotate}°</span><input type="range" min={-30} max={30} step={1} value={o.rotate} onChange={(e) => onChange({ rotate: Number(e.target.value) })} /></label>
      </div>

      <div className="row">
        <label className="check">
          <input type="checkbox" checked={!!o.sfx} onChange={(e) => onChange({ sfx: e.target.checked ? "bishi" : undefined })} />
          出るときに効果音
        </label>
        {o.sfx && (
          <>
            <select value={o.sfx} onChange={(e) => onChange({ sfx: e.target.value })}>
              {SFX_LIST.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
            </select>
            <button className="mini" onClick={() => { const a = new Audio(window.api.sfxUrl(o.sfx!)); a.play().catch(() => {}); }}>🔊 試聴</button>
          </>
        )}
      </div>

      <div className="row">
        <label className="field inline"><span>文字色</span><input type="color" value={o.color} onChange={(e) => onChange({ color: e.target.value })} /></label>
        <label className="field inline"><span>縁色</span><input type="color" value={o.strokeColor} onChange={(e) => onChange({ strokeColor: e.target.value })} /></label>
        <label className="field inline"><span>縁の太さ {o.strokeWidth}</span><input type="range" min={0} max={24} step={1} value={o.strokeWidth} onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })} /></label>
        <label className="field inline">
          <span>帯</span>
          <input type="color" value={o.background || "#000000"} onChange={(e) => onChange({ background: e.target.value })} disabled={!o.background} />
          <label className="check"><input type="checkbox" checked={!!o.background} onChange={(e) => onChange({ background: e.target.checked ? "#000000cc" : "" })} />帯を付ける</label>
        </label>
      </div>
    </div>
  );
};
