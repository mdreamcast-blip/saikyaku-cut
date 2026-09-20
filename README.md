# 細客CUT

音声から自動で字幕を起こし、1 行ごとに違う演出を付けた縦型リール動画(1080×1920)を書き出す macOS アプリ。
Electron + Remotion + whisper.cpp(ローカル・API 不要)。

## 使う(配布版)

[Releases](../../releases) から `細客CUT-<version>-mac-arm64.zip` をダウンロードし、`はじめに.txt` の手順で開く。
Apple シリコン Mac(macOS 13 以降)専用。

## 開発

```bash
npm install
npm start            # ビルドして Electron で起動
```

- `npm run test:group -- samples/sample.aiff 8 "用語 用語"` … 文字起こしと行分けの確認(Electron 不要)
- `npm run test:silence -- samples/pause.mp4` … 無音カットの確認
- `npm run test:render -- samples/sample.mp4 samples/out.mp4 horror` … 書き出しの確認
- `npx vite --config vite.web.config.ts` … ブラウザで UI だけ確認(`window.api` はモック)

## 配布版を作る

```bash
npx electron-builder --mac --arm64
codesign --force --deep --sign - "release/mac-arm64/細客CUT.app"
```

`resources/whisper/main` はこの Mac で `make` ビルドした whisper.cpp 1.7.2(arm64)。配布先ではビルド不要。

## 構成

- `electron/` メインプロセス(ffmpeg、whisper、kuromoji、sherpa-onnx、Remotion レンダー)
- `src/remotion/` 字幕・テキストの描画(プレビューと書き出しで共通)
- `src/renderer/` 画面(CapCut 風: 左タブ / 中央プレビュー / 右属性 / 下タイムライン)
- `assets/sfx/` 効果音(`scripts/make-sfx.sh` で ffmpeg 合成)
