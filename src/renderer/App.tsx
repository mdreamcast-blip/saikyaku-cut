import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { ReelComposition } from "../remotion/ReelComposition";
import { THEMES, THEME_LABELS } from "../remotion/styles";
import {
  DEFAULT_OVERLAY, DEFAULT_PROJECT, GRANULARITY_LABELS,
  type Granularity, type Line, type SfxItem, type Overlay, type Progress, type Project, type SilenceOptions, type ThemeName,
} from "../shared/types";
import { LineEditor } from "./LineEditor";
import { OverlayEditor } from "./OverlayEditor";
import { Timeline } from "./Timeline";
import { PreviewLayer } from "./PreviewLayer";

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${String(Math.floor((ms % 1000) / 100))}`;
};

type Selection = { kind: "line" | "overlay"; id: string } | null;
type Tab = "captions" | "text" | "style" | "settings";

/**
 * CapCut 風の 3 ペイン + タイムライン。
 * 左: タブ(字幕 / テキスト / 演出 / 設定)  中央: プレビュー(直接編集)  右: 選択中の属性  下: タイムライン
 */
/** 元に戻す用の履歴。連続した変更(ドラッグ・スライダー)は 500ms 以内なら 1 回にまとめる */
const HISTORY_LIMIT = 100;

export const App: React.FC = () => {
  const [project, setProjectRaw] = useState<Project | null>(null);
  // 現在値の鏡。履歴の操作は React の更新関数の中ではなく、ここを基準に行う
  // (開発モードでは更新関数が 2 回呼ばれるため、中で push/pop すると二重になる)
  const projectRef = useRef<Project | null>(null);
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const lastPush = useRef(0);
  const [, bump] = useState(0); // 履歴ボタンの有効/無効を再描画するため

  /** 変更を履歴に積みながら反映する */
  const setProject = useCallback((next: Project | null | ((p: Project | null) => Project | null)) => {
    const prev = projectRef.current;
    const value = typeof next === "function" ? next(prev) : next;
    if (prev && value && value !== prev) {
      const now = Date.now();
      if (now - lastPush.current > 500) {
        past.current.push(prev);
        if (past.current.length > HISTORY_LIMIT) past.current.shift();
        future.current.length = 0;
      }
      lastPush.current = now;
    }
    projectRef.current = value;
    setProjectRaw(value);
    bump((n) => n + 1);
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    if (projectRef.current) future.current.push(projectRef.current);
    lastPush.current = 0;
    projectRef.current = prev;
    setProjectRaw(prev);
    bump((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    if (projectRef.current) past.current.push(projectRef.current);
    lastPush.current = 0;
    projectRef.current = next;
    setProjectRaw(next);
    bump((n) => n + 1);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(t.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);

  // 動作確認用(ブラウザのコンソールから履歴の長さを見る)
  (window as any).__hist = { past: past.current, future: future.current };

  const [sfxList, setSfxList] = useState<SfxItem[]>([]);
  useEffect(() => { window.api.sfxList().then(setSfxList).catch(() => setSfxList([])); }, []);
  const firstSfx = sfxList[0]?.name ?? "";
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("captions");
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [inlineText, setInlineText] = useState("");
  const player = useRef<PlayerRef>(null);

  useEffect(() => window.api.onProgress(setProgress), []);

  // 再生位置・再生状態を Player から受け取る
  useEffect(() => {
    const pl = player.current;
    if (!pl || !project) return;
    const onFrame = (e: { detail: { frame: number } }) => setCurrentMs((e.detail.frame / project.fps) * 1000);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    pl.addEventListener("frameupdate", onFrame);
    pl.addEventListener("play", onPlay);
    pl.addEventListener("pause", onPause);
    pl.addEventListener("ended", onPause);
    return () => { pl.removeEventListener("frameupdate", onFrame); pl.removeEventListener("play", onPlay); pl.removeEventListener("pause", onPause); pl.removeEventListener("ended", onPause); };
  }, [project?.mediaPath, project?.fps]);

  const update = (patch: Partial<Project>) => setProject((p) => (p ? { ...p, ...patch } : p));
  const updateSilence = (patch: Partial<SilenceOptions>) => setProject((p) => (p ? { ...p, silence: { ...p.silence, ...patch } } : p));
  const updateLine = (id: string, patch: Partial<Line>) => setProject((p) => (p ? { ...p, lines: p.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : p));
  const updateOverlay = (id: string, patch: Partial<Overlay>) => setProject((p) => (p ? { ...p, overlays: p.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)) } : p));

  const setLineText = async (id: string, text: string) => {
    const l = project?.lines.find((x) => x.id === id);
    if (!l || !text.trim() || text === l.text) return;
    const words = await window.api.resegment(text, l.startMs, l.endMs);
    updateLine(id, { text, words, emphasis: [] });
  };

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { alert(String(e?.message ?? e)); } finally { setBusy(false); setProgress(null); }
  };

  const pick = async () => {
    const m = await window.api.pickMedia();
    if (!m) return;
    if (!m.durationMs) { alert("このファイルの長さを読み取れませんでした。別の形式(mp4 / mov / mp3 / m4a / wav)でお試しください。"); return; }
    setProject({ ...DEFAULT_PROJECT, sourcePath: m.path, mediaPath: m.path, mediaIsVideo: m.isVideo, durationMs: m.durationMs, lines: [], overlays: [] });
    setSel(null);
    setTab("captions");
  };

  const transcribe = () => guard(async () => {
    if (!project) return;
    const raw = await window.api.transcribe(project.mediaPath, { maxCharsPerLine: project.maxCharsPerLine, dictionary: project.dictionary, diarize: project.diarize, numSpeakers: project.numSpeakers, granularity: project.granularity });
    // 「新しい字幕に効果音を付ける」が選ばれていれば最初から付けておく(行ごとに外せる)
    const lines = project.sfxDefault ? raw.map((l) => ({ ...l, sfx: project.sfxDefault })) : raw;
    update({ lines });
    setTab("captions");
  });

  const cutSilence = () => guard(async () => {
    if (!project) return;
    const r = await window.api.cutSilence(project.sourcePath, project.silence);
    update({ mediaPath: r.path, durationMs: r.durationMs, mediaIsVideo: r.isVideo, removedMs: r.removedMs, lines: [] });
  });

  const undoCut = () => {
    if (!project) return;
    update({ mediaPath: project.sourcePath, removedMs: undefined, lines: [] });
    alert("元の素材に戻しました。長さを正しく反映するため、もう一度「文字起こし」を実行してください。");
  };

  const render = () => guard(async () => {
    if (!project) return;
    const base = project.sourcePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "reel";
    const out = await window.api.pickSavePath(`${base}_caption.mp4`);
    if (!out) return;
    const r = await window.api.render(project, out);
    if (!r.ok) throw new Error(`書き出しに失敗しました\n${r.message}`);
  });

  // 常に最新の fps を参照できるように ref に持つ(useCallback の古い閉包を避ける)
  const fpsRef = useRef(30);
  fpsRef.current = project?.fps ?? 30;
  const seekMs = useCallback((ms: number) => {
    const pl = player.current;
    if (!pl) return;
    const frame = Math.max(0, Math.round((ms / 1000) * fpsRef.current));
    // 再生中は一度止めてから移動し、そのあと再開する(移動が無視されるのを防ぐ)
    const wasPlaying = pl.isPlaying();
    if (wasPlaying) pl.pause();
    pl.seekTo(frame);
    if (wasPlaying) pl.play();
    setCurrentMs(ms);
  }, []);

  const togglePlay = useCallback(() => {
    const pl = player.current;
    if (!pl) return;
    pl.isPlaying() ? pl.pause() : pl.play();
  }, []);

  const addOverlayAt = (ms: number) => {
    if (!project) return;
    // 再生位置の少し手前から始めて、追加した直後にプレビューで見えるようにする
    const s = Math.max(0, Math.round(ms) - 150);
    const o: Overlay = { ...DEFAULT_OVERLAY, id: `ov-${Date.now()}`, startMs: s, endMs: Math.min(project.durationMs, s + 2000), sfx: project.sfxDefault || undefined };
    update({ overlays: [...project.overlays, o] });
    setSel({ kind: "overlay", id: o.id });
    setTab("text");
    seekMs(s + 150);
  };

  const sfxUrls = useMemo(() => Object.fromEntries(sfxList.map((s) => [s.name, window.api.sfxUrl(s.name)])), [sfxList]);
  const inputProps = useMemo(
    () => (project ? { ...project, mediaSrc: project.mediaPath ? window.api.toFileUrl(project.mediaPath) : "", sfxUrls } : null),
    [project, sfxUrls],
  );
  const palette = project ? THEMES[project.theme] : [];

  /** 効果音の試聴 */
  const previewSfx = (name: string) => {
    if (!name) return;
    const a = new Audio(sfxUrls[name]);
    a.volume = project?.sfxVolume ?? 0.6;
    a.play().catch(() => {});
  };
  const setAllSfx = (name: string | undefined) => {
    if (!project) return;
    update({ lines: project.lines.map((l) => ({ ...l, sfx: name })), overlays: project.overlays.map((o) => ({ ...o, sfx: name })) });
  };

  // 出始めの 1 フレーム目は登場アニメで透明なことがあるので、少し進んだ位置に合わせる
  const selectLine = (l: Line) => { setSel({ kind: "line", id: l.id }); seekMs(Math.min(l.startMs + 150, l.endMs - 50)); };
  const activeIndex = sel?.kind === "line" ? project?.lines.findIndex((l) => l.id === sel.id) ?? -1 : -1;
  const activeLine = activeIndex >= 0 ? project!.lines[activeIndex] : null;
  const activeOverlay = sel?.kind === "overlay" ? project?.overlays.find((o) => o.id === sel.id) ?? null : null;
  const mediaName = project?.sourcePath.split("/").pop() ?? "";

  // Delete キーで選択中を削除(入力中は除く)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if ((e.key === "Backspace" || e.key === "Delete") && sel && project) {
        if (sel.kind === "overlay") update({ overlays: project.overlays.filter((o) => o.id !== sel.id) });
        else update({ lines: project.lines.filter((l) => l.id !== sel.id) });
        setSel(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sel, project]);

  return (
    <div className="app">
      <div className="titlebar">
        <span className="brand">細客<b>CUT</b></span>
        <span className="spacer" />
        <span className="file" style={{ maxWidth: 480 }} title={project?.sourcePath}>{project ? mediaName : ""}</span>
      </div>

      {/* 常に表示する操作バー(タブや選択状態に関係なく固定) */}
      <div className="toolbar">
        <button onClick={pick} disabled={busy}>📂 開く</button>
        <button className="primary" onClick={render} disabled={!project || busy || (!project.lines.length && !project.overlays.length)} title="字幕を焼き込んだ MP4 を保存します">💾 書き出し(保存)</button>
        <span className="sep" />
        <button onClick={undo} disabled={!past.current.length} title="元に戻す (⌘Z)">↩ 戻る</button>
        <button onClick={redo} disabled={!future.current.length} title="やり直す (⇧⌘Z)">↪ 進む</button>
        <span className="sep" />
        <button onClick={cutSilence} disabled={!project || busy} title="無音を検出して詰めます(設定タブで調整)">✂ 無音カット</button>
        <button onClick={transcribe} disabled={!project || busy}>🎙 文字起こし</button>
        <button onClick={() => addOverlayAt(currentMs)} disabled={!project || busy} title="再生位置にテキストを追加">Ｔ テキスト追加</button>
        <span className="spacer" />
        {project?.removedMs ? <span className="tag ok">無音 {(project.removedMs / 1000).toFixed(1)}s カット済み</span> : null}
        {project && <span className="tag">{fmt(project.durationMs)}</span>}
      </div>

      <div className="main">
        {/* 左: タブ */}
        <aside className="side">
          <div className="tabs">
            {([["captions", "字幕"], ["text", "テキスト"], ["style", "演出"], ["settings", "設定"]] as [Tab, string][]).map(([k, label]) => (
              <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>

          {tab === "captions" && (
            <div className="lines">
              {!project && <div className="empty" style={{ padding: 24 }}>「開く」で動画か音声を選んでください</div>}
              {project && !project.lines.length && <div className="empty" style={{ padding: 24 }}>「文字起こし」を押すと、ここに字幕が並びます</div>}
              {project?.lines.map((l) => (
                <div key={l.id} className={`lineItem ${sel?.id === l.id ? "active" : ""}`} onClick={() => selectLine(l)}>
                  <span className="t">{fmt(l.startMs)}</span>
                  <span className="sfxCell" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="sfxChk" title="効果音を付ける"
                      checked={!!l.sfx}
                      onChange={(e) => { const name = e.target.checked ? (project.sfxDefault || firstSfx) : undefined; updateLine(l.id, { sfx: name }); if (name) previewSfx(name); }} />
                    {l.sfx && (
                      <select className="sfxSel" value={l.sfx} title="この字幕の効果音" onChange={(e) => { updateLine(l.id, { sfx: e.target.value }); previewSfx(e.target.value); }}>
                        {sfxList.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
                      </select>
                    )}
                  </span>
                  {project.diarize && (
                    <select className="spk" value={l.speaker ?? 0} style={{ color: (l.speaker && project.speakerColors[l.speaker]) || undefined }}
                      onClick={(e) => e.stopPropagation()} onChange={(e) => updateLine(l.id, { speaker: Number(e.target.value) })}>
                      {Array.from({ length: Math.max(project.numSpeakers || 2, 2, ...project.lines.map((x) => (x.speaker ?? 0) + 1)) }, (_, k) => <option key={k} value={k}>話者{k + 1}</option>)}
                    </select>
                  )}
                  {inlineId === l.id ? (
                    <input className="inlineEdit" autoFocus value={inlineText} onChange={(e) => setInlineText(e.target.value)} onClick={(e) => e.stopPropagation()}
                      onBlur={() => { setLineText(l.id, inlineText); setInlineId(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") setInlineId(null); }} />
                  ) : (
                    <span className="lineText" title="クリックしてその場で修正" onClick={(e) => { e.stopPropagation(); selectLine(l); setInlineId(l.id); setInlineText(l.text); }}>{l.text}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "text" && (
            <div className="lines">
              <div className="section">
                <button onClick={() => addOverlayAt(currentMs)} disabled={!project}>Ｔ 再生位置にテキストを追加</button>
                <div className="hint" style={{ marginTop: 6 }}>タイムラインの「テキスト」行をダブルクリックしても追加できます。プレビュー上でドラッグして配置します。</div>
              </div>
              {project?.overlays.map((o) => (
                <div key={o.id} className={`lineItem overlayItem ${sel?.id === o.id ? "active" : ""}`} onClick={() => { setSel({ kind: "overlay", id: o.id }); seekMs(Math.min(o.startMs + 150, o.endMs - 50)); }}>
                  <span className="t">{fmt(o.startMs)}</span>
                  <span className="sfxCell" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="sfxChk" title="効果音を付ける" checked={!!o.sfx}
                      onChange={(e) => { const name = e.target.checked ? (project.sfxDefault || firstSfx) : undefined; updateOverlay(o.id, { sfx: name }); if (name) previewSfx(name); }} />
                    {o.sfx && (
                      <select className="sfxSel" value={o.sfx} onChange={(e) => { updateOverlay(o.id, { sfx: e.target.value }); previewSfx(e.target.value); }}>
                        {sfxList.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
                      </select>
                    )}
                  </span>
                  <span className="lineText">{o.text}</span>
                  <span className="hint">{((o.endMs - o.startMs) / 1000).toFixed(1)}s</span>
                </div>
              ))}
            </div>
          )}

          {tab === "style" && (
            <div className="lines">
              <div className="section">
                <h3>テーマ(字幕全体の雰囲気)</h3>
                <div className="themeGrid">
                  {(Object.keys(THEME_LABELS) as ThemeName[]).map((k) => (
                    <button key={k} className={`themeCard ${project?.theme === k ? "on" : ""}`} disabled={!project} onClick={() => update({ theme: k })}>
                      <b>{THEME_LABELS[k].split("(")[0]}</b>
                      <small>{THEME_LABELS[k].includes("(") ? THEME_LABELS[k].replace(/^[^(]*\(|\)$/g, "") : ""}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="section">
                <h3>効果音(字幕が出る瞬間)</h3>
                <div className="row">
                  <label>新しい字幕に</label>
                  <select value={project?.sfxDefault ?? ""} disabled={!project} onChange={(e) => update({ sfxDefault: e.target.value })}>
                    <option value="">付けない</option>
                    {sfxList.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
                  </select>
                  <button className="mini" disabled={!project?.sfxDefault} onClick={() => previewSfx(project!.sfxDefault)}>🔊 試聴</button>
                </div>
                <div className="row">
                  <label>音量 {Math.round((project?.sfxVolume ?? 0.6) * 100)}%</label>
                  <input type="range" min={0} max={1} step={0.05} value={project?.sfxVolume ?? 0.6} disabled={!project} onChange={(e) => update({ sfxVolume: Number(e.target.value) })} />
                </div>
                <div className="row">
                  <button className="mini" disabled={!project} onClick={() => setAllSfx(project!.sfxDefault || firstSfx)}>全部に付ける</button>
                  <button className="mini" disabled={!project} onClick={() => setAllSfx(undefined)}>全部外す</button>
                </div>
                <div className="hint">字幕一覧のチェックで 1 つずつ付け外しでき、その横のプルダウンで音を選べます。素材は Kenney(CC0)。</div>
              </div>
              <div className="section">
                <h3>文字の大きさ(全体)</h3>
                <div className="row">
                  <label>{Math.round((project?.fontScale ?? 1) * 100)}%</label>
                  <input type="range" min={0.5} max={1.8} step={0.05} value={project?.fontScale ?? 1} disabled={!project} onChange={(e) => update({ fontScale: Number(e.target.value) })} style={{ width: 160 }} />
                  <button className="mini" disabled={!project} onClick={() => update({ fontScale: 1 })}>100%</button>
                </div>
                <div className="row">
                  <button className="mini" disabled={!project || !project.lines.some((l) => l.fontScale || l.offsetY)} onClick={() => update({ lines: project!.lines.map((l) => ({ ...l, fontScale: undefined, offsetY: undefined })) })}>行ごとの個別調整をすべて解除</button>
                </div>
                <div className="hint">まず全体で決めて、そのあと字幕を選んで右のパネル(または右下ハンドル)で 1 つずつ微調整できます。</div>
              </div>
              <div className="section">
                <h3>切り替え</h3>
                <div className="row">
                  <select value={project?.styleOrder ?? "rotate"} disabled={!project} onChange={(e) => update({ styleOrder: e.target.value as Project["styleOrder"] })}>
                    <option value="rotate">順番に</option>
                    <option value="random">ランダム</option>
                  </select>
                  <button disabled={!project} onClick={() => update({ seed: (project?.seed ?? 0) + 1 })}>シャッフル</button>
                </div>
                <div className="hint">行ごとのスタイルは、字幕を選んで右のパネルで個別に変えられます。</div>
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div className="lines">
              <div className="section">
                <h3>素材</h3>
                <div className="file" title={project?.sourcePath}>{project?.sourcePath ?? "まだ選ばれていません"}</div>
                {project && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <span className="tag">{project.mediaIsVideo ? "動画" : "音声のみ"}</span>
                    <span className="tag">{fmt(project.durationMs)}</span>
                    <span className="tag">{project.width}×{project.height} / {project.fps}fps</span>
                    {project.removedMs ? <span className="tag ok">無音 {(project.removedMs / 1000).toFixed(1)}s カット済み</span> : null}
                  </div>
                )}
              </div>
              <div className="section">
                <h3>無音カット</h3>
                <div className="row"><label>しきい値</label><input type="number" step={1} min={-60} max={-10} value={project?.silence.thresholdDb ?? -32} disabled={!project} onChange={(e) => updateSilence({ thresholdDb: Number(e.target.value) })} style={{ width: 70 }} /><span className="hint">dB</span></div>
                <div className="row"><label>最短の無音</label><input type="number" step={100} min={200} max={5000} value={project?.silence.minSilenceMs ?? 600} disabled={!project} onChange={(e) => updateSilence({ minSilenceMs: Number(e.target.value) })} style={{ width: 70 }} /><span className="hint">ms</span></div>
                <div className="row"><label>残す余白</label><input type="number" step={50} min={0} max={1000} value={project?.silence.paddingMs ?? 150} disabled={!project} onChange={(e) => updateSilence({ paddingMs: Number(e.target.value) })} style={{ width: 70 }} /><span className="hint">ms</span></div>
                <div className="row">
                  <button onClick={cutSilence} disabled={!project || busy}>無音をカットする</button>
                  {project?.removedMs ? <button onClick={undoCut} disabled={busy}>元に戻す</button> : null}
                </div>
              </div>
              <div className="section">
                <h3>文字起こし</h3>
                <div className="row">
                  <label>細かさ</label>
                  <select value={project?.granularity ?? "fine"} disabled={!project}
                    onChange={(e) => { const g = e.target.value as Granularity; update({ granularity: g, maxCharsPerLine: g === "fine" ? 8 : g === "normal" ? 14 : 20 }); }}>
                    {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((g) => <option key={g} value={g}>{GRANULARITY_LABELS[g]}</option>)}
                  </select>
                </div>
                <div className="row"><label>1行の文字数</label><input type="number" min={4} max={24} value={project?.maxCharsPerLine ?? 8} disabled={!project} onChange={(e) => update({ maxCharsPerLine: Number(e.target.value) })} style={{ width: 70 }} /></div>
                <div className="row" style={{ alignItems: "flex-start" }}>
                  <label>用語辞書</label>
                  <textarea placeholder="固有名詞・商品名を空白か改行で区切って" value={project?.dictionary ?? ""} disabled={!project} rows={3} onChange={(e) => update({ dictionary: e.target.value })} />
                </div>
                <div className="row">
                  <label>話者分離</label>
                  <label className="check"><input type="checkbox" checked={project?.diarize ?? false} disabled={!project} onChange={(e) => update({ diarize: e.target.checked })} />会話動画で話者ごとに分ける</label>
                </div>
                {project?.diarize && (
                  <div className="row"><label>話者の人数</label>
                    <select value={project.numSpeakers} onChange={(e) => update({ numSpeakers: Number(e.target.value) })}>
                      <option value={0}>自動</option>{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} 人</option>)}
                    </select>
                  </div>
                )}
                <div className="hint">変更後は、もう一度「文字起こし」を押すと反映されます。</div>
              </div>
            </div>
          )}
        </aside>

        {/* 中央: プレビュー */}
        <section className="stage">
          <div className="preview" onMouseDown={() => setSel(null)}>
            {inputProps ? (
              <div className="playerWrap" onMouseDown={(e) => e.stopPropagation()}>
                <Player
                  key={inputProps.mediaPath}
                  ref={player}
                  component={ReelComposition}
                  inputProps={inputProps}
                  durationInFrames={Math.max(1, Math.round((inputProps.durationMs / 1000) * inputProps.fps))}
                  compositionWidth={inputProps.width}
                  compositionHeight={inputProps.height}
                  fps={inputProps.fps}
                  style={{ width: "100%", height: "100%" }}
                  clickToPlay={false}
                  doubleClickToFullscreen={false}
                  spaceKeyToPlayOrPause={false}
                  loop
                />
                <PreviewLayer
                  project={project!}
                  currentMs={currentMs}
                  selectedId={sel?.id ?? null}
                  onSelect={(kind, id) => { setSel({ kind, id }); setTab(kind === "line" ? "captions" : "text"); }}
                  onLineText={setLineText}
                  onLineChange={updateLine}
                  onOverlayChange={updateOverlay}
                  onEmptyClick={() => setSel(null)}
                />
              </div>
            ) : (
              <div className="empty">
                <div className="big">🎬</div>
                動画か音声ファイルを開いてください<br />
                文字起こし → 直接クリックして修正 → テキスト追加 → 書き出し
              </div>
            )}
          </div>
        </section>

        {/* 右: 属性 */}
        <aside className="inspector">
          {project && activeLine ? (
            <LineEditor
              key={activeLine.id}
              project={project}
              line={activeLine}
              index={activeIndex}
              palette={palette}
              sfxList={sfxList}
              onChange={(patch) => updateLine(activeLine.id, patch)}
              onReplace={(lines) => { update({ lines }); if (!lines.some((l) => l.id === activeLine.id)) { const nl = lines[Math.min(activeIndex, lines.length - 1)]; setSel(nl ? { kind: "line", id: nl.id } : null); } }}
              onSeek={seekMs}
            />
          ) : project && activeOverlay ? (
            <OverlayEditor
              key={activeOverlay.id}
              overlay={activeOverlay}
              sfxList={sfxList}
              onChange={(patch) => updateOverlay(activeOverlay.id, patch)}
              onDelete={() => { update({ overlays: project.overlays.filter((o) => o.id !== activeOverlay.id) }); setSel(null); }}
              onDuplicate={() => { const c = { ...activeOverlay, id: `ov-${Date.now()}`, startMs: activeOverlay.endMs + 40, endMs: activeOverlay.endMs + 40 + (activeOverlay.endMs - activeOverlay.startMs) }; update({ overlays: [...project.overlays, c] }); setSel({ kind: "overlay", id: c.id }); }}
              onSeek={seekMs}
            />
          ) : (
            <div className="editor">
              <b>属性</b>
              <div className="hint" style={{ lineHeight: 1.8, marginTop: 8 }}>
                プレビュー上の字幕やテキストをクリックすると、ここに詳細が出ます。<br />
                ・クリック: 選択(枠とハンドル)<br />
                ・ドラッグ: 移動 / 右下のハンドル: 大きさ<br />
                ・ダブルクリック: その場で文言を修正<br />
                ・Delete キー: 削除 / スペース: 再生・停止
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 下: タイムライン */}
      {project ? (
        <Timeline
          durationMs={project.durationMs}
          currentMs={currentMs}
          playing={playing}
          mediaIsVideo={project.mediaIsVideo}
          mediaName={mediaName}
          lines={project.lines}
          overlays={project.overlays}
          selectedId={sel?.id ?? null}
          speakerColors={project.speakerColors}
          onSeek={seekMs}
          onTogglePlay={togglePlay}
          onSelect={(kind, id) => {
            setSel({ kind, id });
            setTab(kind === "line" ? "captions" : "text");
            // タイムラインで選んだら、その字幕が見える位置へ再生ヘッドを動かす
            const it = kind === "line" ? project.lines.find((l) => l.id === id) : project.overlays.find((o) => o.id === id);
            if (it && (currentMs < it.startMs || currentMs >= it.endMs)) seekMs(Math.min(it.startMs + 150, it.endMs - 50));
          }}
          onMoveLine={(id, s, e) => updateLine(id, { startMs: s, endMs: e })}
          onMoveOverlay={(id, s, e) => updateOverlay(id, { startMs: s, endMs: e })}
          onAddTextAt={addOverlayAt}
        />
      ) : <div className="timeline empty" style={{ height: 160 }} />}

      <div className="status">
        <span>{progress?.message ?? (busy ? "処理中…" : "待機中")}</span>
        <div className="bar"><i style={{ width: `${Math.round((progress?.ratio ?? 0) * 100)}%` }} /></div>
        <span>{progress ? `${Math.round(progress.ratio * 100)}%` : ""}</span>
      </div>
    </div>
  );
};
