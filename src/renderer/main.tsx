import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { mockApi } from "./mockApi";
import { webApi } from "../web/webApi";

// Electron 外では preload が無い。
//   ・GitHub Pages 版(VITE_PLATFORM=web) … ブラウザ実装(webApi)
//   ・UI 確認用の vite.web.config … サンプル入りのモック(mockApi)
if (!window.api) window.api = import.meta.env.VITE_PLATFORM === "web" ? webApi : mockApi;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
