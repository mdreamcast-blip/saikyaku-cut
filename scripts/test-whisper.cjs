// whisper.cpp の導入 → 文字起こし → 行整形 を Electron 抜きで確かめる。
// 使い方: node scripts/test-whisper.cjs samples/sample.aiff [version] [model]
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const ffmpeg = require("ffmpeg-static");
const { installWhisperCpp, downloadWhisperModel, transcribe, toCaptions } = require("@remotion/install-whisper-cpp");

const input = path.resolve(process.argv[2] || "samples/sample.aiff");
const version = process.argv[3] || "1.5.5";
const model = process.argv[4] || "large-v3-turbo";
const base = path.join(os.homedir(), "Library/Application Support/ReelCaption");
const whisperDir = path.join(base, "whisper.cpp");
const modelDir = path.join(base, "whisper-models");
fs.mkdirSync(modelDir, { recursive: true });

(async () => {
  console.time("install");
  await installWhisperCpp({ to: whisperDir, version, printOutput: false });
  console.timeEnd("install");
  console.time("model");
  await downloadWhisperModel({ model, folder: modelDir, printOutput: false });
  console.timeEnd("model");

  const wav = path.join(os.tmpdir(), "rc-test.wav");
  execFileSync(ffmpeg, ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);

  console.time("transcribe");
  const json = await transcribe({
    inputPath: wav, whisperPath: whisperDir, whisperCppVersion: version, model, modelFolder: modelDir,
    language: "ja", tokenLevelTimestamps: true, splitOnWord: true, printOutput: false,
  });
  console.timeEnd("transcribe");
  const { captions } = toCaptions({ whisperCppOutput: json });
  console.log("captions:", captions.length);
  console.log(captions.slice(0, 40).map((c) => `${c.startMs}-${c.endMs} ${JSON.stringify(c.text)}`).join("\n"));
  fs.writeFileSync(path.join(base, "last-captions.json"), JSON.stringify(captions, null, 1));
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
