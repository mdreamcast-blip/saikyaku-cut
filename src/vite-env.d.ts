/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "web" のとき GitHub Pages 版(ブラウザ実装の window.api を使う) */
  readonly VITE_PLATFORM?: string;
}
