// ブラウザ内の書き出し。
//   動画のフレームを 1 枚ずつ取り出し → Canvas に字幕・テキストを描く → WebCodecs で H.264 にエンコード → MP4 化。
//   音声は元の音声に効果音を合成して AAC にする。
// 字幕の動き(ポップ・スライドなど)は Mac 版と同じ remotion の spring / interpolate を使って計算する。
import {
  ALL_FORMATS, AudioBufferSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeAudio,
} from "mediabunny";
import { Easing, interpolate, spring } from "remotion";
import type { CaptionStyle, Line, Overlay, Project } from "../shared/types";
import { THEMES, assignStyles } from "../remotion/styles";
import { loadFonts } from "../remotion/fonts";

type Progress = (ratio: number, message: string) => void;

const BASE = import.meta.env.BASE_URL;

/** ある時刻の字幕 1 行の描画状態 */
type Anim = { opacity: number; scale: number; scaleY: number; tx: number; ty: number; rotate: number; skewX: number; blur: number; chars?: number };

function animate(kind: CaptionStyle["animation"], frame: number, fps: number, dur: number, charCount: number): Anim {
  const a: Anim = { opacity: 1, scale: 1, scaleY: 1, tx: 0, ty: 0, rotate: 0, skewX: 0, blur: 0 };
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 180, mass: 0.6 } });
  const stiff = spring({ frame, fps, config: { damping: 8, stiffness: 260, mass: 0.5 } });
  const clampR = { extrapolateRight: "clamp" as const };
  switch (kind) {
    case "pop": a.scale = interpolate(stiff, [0, 1], [0.4, 1]); a.opacity = interpolate(frame, [0, 3], [0, 1], clampR); break;
    case "slideUp": a.ty = interpolate(enter, [0, 1], [80, 0]); a.opacity = interpolate(enter, [0, 0.4], [0, 1], clampR); break;
    case "bounce": a.ty = interpolate(stiff, [0, 1], [-140, 0]); a.scaleY = interpolate(stiff, [0, 0.7, 1], [1.2, 0.9, 1]); break;
    case "shake": {
      const amp = interpolate(frame, [0, 10], [10, 0], clampR);
      a.tx = Math.sin(frame * 2.4) * amp; a.rotate = Math.sin(frame * 1.9) * amp * 0.4; a.scale = interpolate(enter, [0, 1], [0.8, 1]); break;
    }
    case "flip": a.scaleY = Math.max(0.02, Math.cos((interpolate(enter, [0, 1], [90, 0]) * Math.PI) / 180)); a.opacity = interpolate(enter, [0, 0.3], [0, 1], clampR); break;
    case "zoomBlur": a.scale = interpolate(frame, [0, 8], [2.2, 1], { ...clampR, easing: Easing.out(Easing.cubic) }); a.blur = interpolate(frame, [0, 8], [12, 0], clampR); a.opacity = interpolate(frame, [0, 4], [0, 1], clampR); break;
    case "flicker": {
      const seq = [0, 1, 0, 0, 1, 0.3, 1, 0, 1, 1, 0.2, 1, 1, 1];
      a.opacity = (frame < seq.length ? seq[frame] : 1) * (0.92 + 0.08 * Math.sin(frame * 1.7) * Math.sin(frame * 0.6)); break;
    }
    case "drip": {
      a.ty = interpolate(frame, [0, 14], [-60, 0], { ...clampR, easing: Easing.out(Easing.quad) });
      a.scaleY = interpolate(frame, [0, 14], [1.4, 1], clampR); a.blur = interpolate(frame, [0, 14], [10, 0], clampR); a.opacity = interpolate(frame, [0, 8], [0, 1], clampR); break;
    }
    case "glitch": {
      const active = frame < 8 || frame % 20 === 0;
      a.tx = active ? Math.sin(frame * 12.9898) * 18 : 0; a.skewX = active ? Math.cos(frame * 7.233) * 4 : 0; a.opacity = frame < 8 && frame % 2 === 1 ? 0.35 : 1; break;
    }
    case "slam": {
      a.scale = interpolate(frame, [0, 5], [3, 1], { ...clampR, easing: Easing.in(Easing.quad) });
      const amp = interpolate(frame, [5, 14], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      a.tx = frame > 4 ? Math.sin(frame * 4.1) * amp : 0; a.ty = frame > 4 ? Math.cos(frame * 5.3) * amp : 0; a.opacity = interpolate(frame, [0, 3], [0, 1], clampR); break;
    }
    case "typewriter": a.chars = Math.min(charCount, Math.floor(interpolate(frame, [0, Math.min(dur * 0.6, charCount * 1.5)], [0, charCount], clampR))); a.opacity = interpolate(frame, [0, 2], [0, 1], clampR); break;
    default: a.opacity = interpolate(frame, [0, 2], [0, 1], clampR);
  }
  a.opacity *= interpolate(frame, [dur - 6, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return a;
}

/** 1 行(または追加テキスト)を canvas に描く。cx, cy は中心座標 */
function drawText(
  ctx: OffscreenCanvasRenderingContext2D, W: number, H: number,
  words: { text: string; hi: boolean }[], style: CaptionStyle, cx: number, cy: number, anim: Anim, rotate: number, maxWidth: number,
) {
  const fs = style.fontSize;
  const family = `"${style.fontFamily}", "Noto Sans JP", sans-serif`;
  ctx.save();
  ctx.font = `${style.fontWeight} ${fs}px ${family}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  (ctx as any).letterSpacing = `${style.letterSpacing ?? 0}px`;

  // 文字列を(必要なら)複数行に折り返す。日本語は 1 文字ずつ測って詰める
  type Cell = { ch: string; hi: boolean };
  const cells: Cell[] = [];
  let shown = 0;
  const limit = anim.chars ?? Infinity;
  for (const w of words) for (const ch of Array.from(w.text)) { if (shown++ < limit) cells.push({ ch, hi: w.hi }); }
  const rows: Cell[][] = [[]];
  let rowW = 0;
  for (const c of cells) {
    const cw = ctx.measureText(c.ch).width;
    if (rowW + cw > maxWidth && rows[rows.length - 1].length) { rows.push([]); rowW = 0; }
    rows[rows.length - 1].push(c); rowW += cw;
  }
  const lineH = fs * 1.25;
  const widths = rows.map((r) => r.reduce((n, c) => n + ctx.measureText(c.ch).width, 0));
  const blockW = Math.max(...widths, 1);
  const blockH = lineH * rows.length;

  ctx.translate(cx + anim.tx, cy + anim.ty);
  ctx.rotate(((style.rotate ?? 0) + rotate + anim.rotate) * Math.PI / 180);
  if (anim.skewX) ctx.transform(1, 0, Math.tan((anim.skewX * Math.PI) / 180), 1, 0, 0);
  ctx.scale(anim.scale, anim.scale * anim.scaleY);
  ctx.globalAlpha = Math.max(0, Math.min(1, anim.opacity));
  if (anim.blur > 0.5) ctx.filter = `blur(${anim.blur}px)`;

  if (style.background) {
    const padX = 40, padY = 18, r = style.backgroundRadius ?? 0;
    ctx.fillStyle = style.background;
    ctx.beginPath();
    (ctx as any).roundRect(-blockW / 2 - padX, -blockH / 2 - padY, blockW + padX * 2, blockH + padY * 2, r);
    ctx.fill();
  }

  rows.forEach((row, ri) => {
    let x = -widths[ri] / 2;
    const y = -blockH / 2 + lineH * ri + fs * 1.0;
    for (const c of row) {
      const cw = ctx.measureText(c.ch).width;
      const color = c.hi ? style.highlightColor : style.color;
      ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      if (style.strokeColor && (style.strokeWidth ?? 0) > 0) {
        ctx.lineJoin = "round"; ctx.lineWidth = (style.strokeWidth ?? 8) * 2; ctx.strokeStyle = style.strokeColor; ctx.strokeText(c.ch, x, y);
      }
      ctx.shadowColor = "transparent";
      ctx.fillStyle = color; ctx.fillText(c.ch, x, y);
      x += cw;
    }
  });
  ctx.restore();
  void W; void H;
}

/** 効果音つきの音声を 1 本にミックスして返す(元の音声 + 各字幕の出だしに効果音) */
async function mixAudio(file: File, project: Project, sfxBuffers: Map<string, AudioBuffer>, durationSec: number): Promise<AudioBuffer | null> {
  const sampleRate = 48000;
  let base: AudioBuffer | null = null;
  try {
    const ctx = new AudioContext();
    base = await ctx.decodeAudioData(await file.arrayBuffer());
    await ctx.close();
  } catch { base = null; }
  const events = [...project.lines.map((l) => ({ t: l.startMs, sfx: l.sfx })), ...project.overlays.map((o) => ({ t: o.startMs, sfx: o.sfx }))].filter((e) => e.sfx && sfxBuffers.has(e.sfx));
  if (!base && !events.length) return null;
  const off = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);
  if (base) { const s = off.createBufferSource(); s.buffer = base; s.connect(off.destination); s.start(0); }
  const gain = off.createGain(); gain.gain.value = project.sfxVolume; gain.connect(off.destination);
  for (const e of events) { const s = off.createBufferSource(); s.buffer = sfxBuffers.get(e.sfx!)!; s.connect(gain); s.start(e.t / 1000); }
  return off.startRendering();
}

/** Project を MP4 の Blob に書き出す。 */
export async function exportVideo(project: Project, file: File, onProgress: Progress): Promise<Blob> {
  if (typeof VideoEncoder === "undefined") throw new Error("このブラウザは動画の書き出し(WebCodecs)に対応していません。Android の Chrome(最新版)をお使いください。");

  const W = project.width, H = project.height, fps = project.fps;
  // Android は端末の負荷とメモリを考えて 720×1280 で書き出す(描画は 1080×1920 の座標のまま縮小)
  const k = /Android/i.test(navigator.userAgent) ? 720 / 1080 : 1;
  const OW = Math.round(W * k), OH = Math.round(H * k);
  const palette = THEMES[project.theme] ?? THEMES.tempo;
  const styleIdx = assignStyles(project.lines.length, palette.length, project.styleOrder, project.seed, project.lines.map((l) => l.styleIndex));

  onProgress(0, "フォントを読み込んでいます");
  await loadFonts(["Noto Sans JP", ...palette.map((s) => s.fontFamily), ...project.overlays.map((o) => o.fontFamily)]);
  await document.fonts.ready;

  // 効果音の読み込み
  const sfxBuffers = new Map<string, AudioBuffer>();
  const used = new Set([...project.lines.map((l) => l.sfx), ...project.overlays.map((o) => o.sfx)].filter(Boolean) as string[]);
  if (used.size) {
    const ac = new AudioContext();
    for (const name of used) {
      try { sfxBuffers.set(name, await ac.decodeAudioData(await (await fetch(`${BASE}sfx/${name}.wav`)).arrayBuffer())); } catch { /* 無ければ鳴らさない */ }
    }
    await ac.close();
  }

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const vTrack = project.mediaIsVideo ? await input.getPrimaryVideoTrack() : null;
  const durationSec = project.durationMs / 1000;

  const canvas = new OffscreenCanvas(OW, OH);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const vSource = new CanvasSource(canvas, { codec: "avc", quality: QUALITY_HIGH, keyFrameInterval: 2 } as any);
  output.addVideoTrack(vSource, { frameRate: fps } as any);

  onProgress(0.02, "音声を準備しています");
  const mixed = await mixAudio(file, project, sfxBuffers, durationSec);
  let aSource: AudioBufferSource | null = null;
  if (mixed) {
    // AAC を符号化できない端末では Opus(MP4 に入れられる)にする
    const codec = (await canEncodeAudio("aac", { bitrate: 192000 } as any).catch(() => false)) ? "aac" : "opus";
    aSource = new AudioBufferSource({ codec, bitrate: 192000 } as any);
    output.addAudioTrack(aSource);
  }

  await output.start();
  if (aSource && mixed) await aSource.add(mixed);

  const sink = vTrack ? new CanvasSink(vTrack, { width: OW, height: OH, fit: "cover" } as any) : null;
  const total = Math.max(1, Math.round(durationSec * fps));
  const ratioBase = 0.05;

  for (let i = 0; i < total; i++) {
    const tSec = i / fps;
    const tMs = tSec * 1000;

    // 背景: 動画のフレーム or 単色
    ctx.filter = "none"; ctx.globalAlpha = 1;
    if (sink) {
      const wrapped = await sink.getCanvas(tSec);
      if (wrapped) ctx.drawImage(wrapped.canvas as CanvasImageSource, 0, 0, W, H); else { ctx.fillStyle = project.backgroundColor; ctx.fillRect(0, 0, W, H); }
    } else { ctx.fillStyle = project.backgroundColor; ctx.fillRect(0, 0, W, H); }
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 字幕
    for (let li = 0; li < project.lines.length; li++) {
      const l: Line = project.lines[li];
      if (tMs < l.startMs || tMs >= l.endMs) continue;
      const st = palette[styleIdx[li]];
      const style: CaptionStyle = { ...st, fontSize: Math.round(st.fontSize * (project.fontScale ?? 1) * (l.fontScale ?? 1)), color: (l.speaker && project.speakerColors[l.speaker]) || st.color };
      const frame = Math.floor(((tMs - l.startMs) / 1000) * fps);
      const dur = Math.max(1, Math.round(((l.endMs - l.startMs) / 1000) * fps));
      const chars = Array.from(l.text).length;
      const words = l.words.length ? l.words.map((w, wi) => ({ text: w.text, hi: !!l.emphasis?.includes(wi) || (style.animation === "karaoke" && tMs >= w.startMs && tMs < w.endMs + 80) })) : [{ text: l.text, hi: false }];
      const align = l.speaker === undefined ? "center" : (["center", "right", "left", "center", "right", "left"] as const)[l.speaker % 6];
      const cxBase = align === "left" ? W * 0.3 : align === "right" ? W * 0.7 : W / 2;
      drawText(ctx, W, H, words, style, cxBase, H / 2 + style.offsetY + (l.offsetY ?? 0), animate(style.animation, frame, fps, dur, chars), 0, W - 140);
    }
    // 追加テキスト
    for (const o of project.overlays) {
      if (tMs < o.startMs || tMs >= o.endMs) continue;
      const style: CaptionStyle = { name: "overlay", fontFamily: o.fontFamily, fontWeight: 900, fontSize: o.fontSize, color: o.color, strokeColor: o.strokeWidth > 0 ? o.strokeColor : undefined, strokeWidth: o.strokeWidth, background: o.background || undefined, backgroundRadius: 12, highlightColor: o.color, animation: o.animation, offsetY: 0, rotate: 0 };
      const frame = Math.floor(((tMs - o.startMs) / 1000) * fps);
      const dur = Math.max(1, Math.round(((o.endMs - o.startMs) / 1000) * fps));
      drawText(ctx, W, H, [{ text: o.text.replace(/\n/g, ""), hi: false }], style, o.x * W, o.y * H, animate(o.animation, frame, fps, dur, Array.from(o.text).length), o.rotate, W - 140);
    }

    await vSource.add(tSec, 1 / fps);
    if (i % 5 === 0) {
      onProgress(ratioBase + (1 - ratioBase) * (i / total), `書き出し中 ${Math.round((i / total) * 100)}%`);
      await new Promise((r) => setTimeout(r)); // 画面を固めない
    }
  }

  onProgress(0.98, "仕上げています");
  await output.finalize();
  const buf = target.buffer;
  if (!buf) throw new Error("書き出しデータを作れませんでした");
  onProgress(1, "完了");
  return new Blob([buf], { type: "video/mp4" });
}
