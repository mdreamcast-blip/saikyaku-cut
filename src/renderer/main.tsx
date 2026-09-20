import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { mockApi } from "./mockApi";

// Electron 外(ブラウザでの UI 確認)では preload が無いので、代わりのモックを差す
if (!window.api) window.api = mockApi;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
