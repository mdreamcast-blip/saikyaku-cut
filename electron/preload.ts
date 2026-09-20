import { contextBridge, ipcRenderer } from "electron";
import type { Api, Progress } from "../src/shared/types";

const api: Api = {
  pickMedia: () => ipcRenderer.invoke("pickMedia"),
  pickSavePath: (name) => ipcRenderer.invoke("pickSavePath", name),
  ensureWhisper: () => ipcRenderer.invoke("ensureWhisper"),
  transcribe: (p, opts) => ipcRenderer.invoke("transcribe", p, opts),
  cutSilence: (p, opts) => ipcRenderer.invoke("cutSilence", p, opts),
  render: (project, out) => ipcRenderer.invoke("render", project, out),
  resegment: (text, s, e) => ipcRenderer.invoke("resegment", text, s, e),
  onProgress: (cb) => {
    const h = (_: unknown, p: Progress) => cb(p);
    ipcRenderer.on("progress", h);
    return () => ipcRenderer.off("progress", h);
  },
  toFileUrl: (p) => `http://127.0.0.1:${mediaPort}/m?p=${encodeURIComponent(p)}`,
  sfxUrl: (name) => `http://127.0.0.1:${mediaPort}/m?p=${encodeURIComponent(`${sfxDir}/${name}.wav`)}`,
};

// main から additionalArguments で渡された配信ポートと効果音フォルダ
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? "").slice(k.length + 3);
const mediaPort = Number(arg("rc-media-port") || 0);
const sfxDir = arg("rc-sfx-dir");

contextBridge.exposeInMainWorld("api", api);
