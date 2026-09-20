import React, { useEffect, useState } from "react";
import { SFX_LIST, type CaptionStyle, type Line, type Project } from "../shared/types";

type Props = {
  project: Project;
  line: Line;
  index: number;
  palette: CaptionStyle[];
  onChange: (patch: Partial<Line>) => void;
  onReplace: (lines: Line[]) => void; // 分割・結合・削除・追加など行の並びが変わる操作
  onSeek: (ms: number) => void;
};

const toSec = (ms: number) => (ms / 1000).toFixed(2);
const fromSec = (s: string) => Math.max(0, Math.round(parseFloat(s || "0") * 1000));

/** 選択中の 1 行を細かく直すパネル。 */
export const LineEditor: React.FC<Props> = ({ project, line, index, palette, onChange, onReplace, onSeek }) => {
  const [text, setText] = useState(line.text);
  const [start, setStart] = useState(toSec(line.startMs));
  const [end, setEnd] = useState(toSec(line.endMs));
  const [cursor, setCursor] = useState(0);

  // 別の行を選んだら入力欄を入れ替える
  useEffect(() => {
    setText(line.text);
    setStart(toSec(line.startMs));
    setEnd(toSec(line.endMs));
  }, [line.id, line.text, line.startMs, line.endMs]);

  const commitText = async () => {
    const t = text.trim();
    if (!t || t === line.text) return;
    const words = await window.api.resegment(t, line.startMs, line.endMs);
    onChange({ text: t, words, emphasis: [] });
  };

  const commitTime = async () => {
    let s = fromSec(start);
    let e = fromSec(end);
    if (e <= s + 200) e = s + 200;
    if (s === line.startMs && e === line.endMs) return;
    const words = await window.api.resegment(line.text, s, e);
    onChange({ startMs: s, endMs: e, words });
  };

  const lines = project.lines;
  const next = lines[index + 1];
  const prev = lines[index - 1];

  const split = async () => {
    const chars = Array.from(text);
    const at = Math.min(Math.max(cursor, 1), chars.length - 1);
    if (chars.length < 2) return;
    const a = chars.slice(0, at).join("");
    const b = chars.slice(at).join("");
    const mid = line.startMs + Math.round((line.endMs - line.startMs) * (at / chars.length));
    const [wa, wb] = await Promise.all([window.api.resegment(a, line.startMs, mid), window.api.resegment(b, mid, line.endMs)]);
    const la: Line = { ...line, text: a, endMs: mid, words: wa, emphasis: [] };
    const lb: Line = { ...line, id: `${line.id}-${Date.now()}`, text: b, startMs: mid, words: wb, emphasis: [], styleIndex: undefined };
    onReplace([...lines.slice(0, index), la, lb, ...lines.slice(index + 1)]);
  };

  const mergeNext = async () => {
    if (!next) return;
    const t = line.text + next.text;
    const words = await window.api.resegment(t, line.startMs, next.endMs);
    const merged: Line = { ...line, text: t, endMs: next.endMs, words, emphasis: [] };
    onReplace([...lines.slice(0, index), merged, ...lines.slice(index + 2)]);
  };

  const remove = () => onReplace(lines.filter((l) => l.id !== line.id));

  const addAfter = async () => {
    const s = line.endMs + 40;
    const e = next ? Math.max(s + 300, Math.min(next.startMs - 40, s + 1500)) : s + 1500;
    const t = "新しい字幕";
    const words = await window.api.resegment(t, s, e);
    const nl: Line = { id: `new-${Date.now()}`, text: t, startMs: s, endMs: e, words, speaker: line.speaker };
    onReplace([...lines.slice(0, index + 1), nl, ...lines.slice(index + 1)]);
  };

  const toggleEmph = (i: number) => {
    const set = new Set(line.emphasis ?? []);
    set.has(i) ? set.delete(i) : set.add(i);
    onChange({ emphasis: Array.from(set).sort((a, b) => a - b) });
  };

  return (
    <div className="editor">
      <div className="editorHead">
        <b>字幕 {index + 1} / {lines.length}</b>
        <span className="hint">
          {prev && <button className="mini" onClick={() => onSeek(prev.startMs)}>◀ 前</button>}
          {next && <button className="mini" onClick={() => onSeek(next.startMs)}>次 ▶</button>}
        </span>
      </div>

      <label className="field">
        <span>文言(プレビュー上の字幕を直接クリックしても直せます)</span>
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onSelect={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
        />
      </label>
      <div className="row">
        <button onClick={split} title="カーソル位置で 2 行に分けます">カーソル位置で分割</button>
        <button onClick={mergeNext} disabled={!next}>次の行と結合</button>
        <button onClick={addAfter}>この後に行を追加</button>
        <button className="danger" onClick={remove}>削除</button>
      </div>

      <div className="row">
        <label className="field inline"><span>開始(秒)</span><input type="number" step={0.05} value={start} onChange={(e) => setStart(e.target.value)} onBlur={commitTime} /></label>
        <label className="field inline"><span>終了(秒)</span><input type="number" step={0.05} value={end} onChange={(e) => setEnd(e.target.value)} onBlur={commitTime} /></label>
        <button className="mini" onClick={() => onSeek(line.startMs)}>▶ ここを再生</button>
      </div>

      <div className="row">
        <label className="field inline">
          <span>スタイル</span>
          <select value={line.styleIndex ?? ""} onChange={(e) => onChange({ styleIndex: e.target.value === "" ? undefined : Number(e.target.value) })}>
            <option value="">自動({palette[index % palette.length]?.name})</option>
            {palette.map((s, j) => <option key={j} value={j}>{s.name} / {s.animation}</option>)}
          </select>
        </label>
        {project.diarize && (
          <label className="field inline">
            <span>話者</span>
            <select value={line.speaker ?? 0} onChange={(e) => onChange({ speaker: Number(e.target.value) })}>
              {Array.from({ length: Math.max(project.numSpeakers || 2, 2) }, (_, k) => <option key={k} value={k}>話者{k + 1}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="row">
        <label className="field inline">
          <span>大きさ {Math.round((line.fontScale ?? 1) * 100)}%</span>
          <input type="range" min={0.5} max={1.8} step={0.05} value={line.fontScale ?? 1} onChange={(e) => onChange({ fontScale: Number(e.target.value) })} />
        </label>
        <label className="field inline">
          <span>上下位置 {line.offsetY ?? 0}px</span>
          <input type="range" min={-700} max={700} step={10} value={line.offsetY ?? 0} onChange={(e) => onChange({ offsetY: Number(e.target.value) })} />
        </label>
        <button className="mini" onClick={() => onChange({ fontScale: undefined, offsetY: undefined })}>戻す</button>
      </div>

      <div className="row">
        <label className="check">
          <input type="checkbox" checked={!!line.sfx} onChange={(e) => onChange({ sfx: e.target.checked ? (project.sfxDefault || "bishi") : undefined })} />
          出るときに効果音
        </label>
        {line.sfx && (
          <>
            <select value={line.sfx} onChange={(e) => onChange({ sfx: e.target.value })}>
              {SFX_LIST.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
            </select>
            <button className="mini" onClick={() => { const a = new Audio(window.api.sfxUrl(line.sfx!)); a.volume = project.sfxVolume; a.play().catch(() => {}); }}>🔊 試聴</button>
          </>
        )}
      </div>

      <div className="field">
        <span>強調する単語(クリックで切り替え)</span>
        <div className="words">
          {line.words.map((w, i) => (
            <button key={i} className={`word ${line.emphasis?.includes(i) ? "on" : ""}`} onClick={() => toggleEmph(i)}>{w.text}</button>
          ))}
        </div>
      </div>
    </div>
  );
};
