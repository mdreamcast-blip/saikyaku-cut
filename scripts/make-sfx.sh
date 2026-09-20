#!/bin/bash
# 字幕用の短い効果音を ffmpeg で合成して assets/sfx に置く(外部素材不要・権利フリー)。
set -e
cd "$(dirname "$0")/.."
F=node_modules/ffmpeg-static/ffmpeg
OUT=assets/sfx
mkdir -p "$OUT"

# ビシ!: 鋭いノイズの一撃 + 高域の急降下スイープ
"$F" -y -loglevel error \
  -f lavfi -i "anoisesrc=d=0.22:c=white:a=1.0,highpass=f=1800,afade=t=out:st=0.01:d=0.2" \
  -f lavfi -i "aevalsrc='0.9*sin(2*PI*(3000-18000*t)*t)*exp(-45*t)':d=0.15:s=44100" \
  -filter_complex "[0][1]amix=inputs=2:normalize=0,volume=1.6,alimiter=limit=0.95" -ac 1 -ar 44100 "$OUT/bishi.wav"

# ポン: 丸い音の短い下降
"$F" -y -loglevel error \
  -f lavfi -i "aevalsrc='0.9*sin(2*PI*(650-3500*t)*t)*exp(-38*t)':d=0.16:s=44100" \
  -af "volume=1.4,alimiter=limit=0.95" -ac 1 -ar 44100 "$OUT/pon.wav"

# カチ: ごく短いクリック
"$F" -y -loglevel error \
  -f lavfi -i "anoisesrc=d=0.05:c=white:a=1.0,highpass=f=2500,afade=t=out:st=0.005:d=0.04" \
  -af "volume=1.2" -ac 1 -ar 44100 "$OUT/kachi.wav"

# シュッ: 風切り音
"$F" -y -loglevel error \
  -f lavfi -i "anoisesrc=d=0.35:c=pink:a=1.0,bandpass=f=2500:w=1800,afade=t=in:st=0:d=0.08,afade=t=out:st=0.12:d=0.22,volume=42dB" \
  -af "volume=1.8,alimiter=limit=0.95" -ac 1 -ar 44100 "$OUT/shu.wav"

# ドン: 低い打撃
"$F" -y -loglevel error \
  -f lavfi -i "aevalsrc='sin(2*PI*(110-300*t)*t)*exp(-14*t)':d=0.45:s=44100" \
  -f lavfi -i "anoisesrc=d=0.08:c=white:a=0.6,lowpass=f=900,afade=t=out:st=0.005:d=0.07" \
  -filter_complex "[0][1]amix=inputs=2:normalize=0,volume=1.6,alimiter=limit=0.95" -ac 1 -ar 44100 "$OUT/don.wav"

ls -la "$OUT"
