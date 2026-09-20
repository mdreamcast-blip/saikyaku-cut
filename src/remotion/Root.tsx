import React from "react";
import { Composition } from "remotion";
import { ReelComposition } from "./ReelComposition";
import { DEFAULT_PROJECT, type CompositionProps } from "../shared/types";

export const COMP_ID = "Reel";

const sample: CompositionProps = {
  ...DEFAULT_PROJECT,
  sourcePath: "",
  mediaPath: "",
  mediaSrc: "",
  sfxUrls: {},
  mediaIsVideo: false,
  durationMs: 6000,
  lines: [
    { id: "1", text: "今日は本気で", startMs: 0, endMs: 1200, words: [{ text: "今日は", startMs: 0, endMs: 600 }, { text: "本気で", startMs: 600, endMs: 1200 }] },
    { id: "2", text: "リールの作り方を", startMs: 1200, endMs: 2600, words: [{ text: "リールの", startMs: 1200, endMs: 1900 }, { text: "作り方を", startMs: 1900, endMs: 2600 }] },
    { id: "3", text: "全部話します", startMs: 2600, endMs: 4000, words: [{ text: "全部", startMs: 2600, endMs: 3200 }, { text: "話します", startMs: 3200, endMs: 4000 }], emphasis: [0] },
    { id: "4", text: "最後まで見てね", startMs: 4000, endMs: 5800, words: [{ text: "最後まで", startMs: 4000, endMs: 4900 }, { text: "見てね", startMs: 4900, endMs: 5800 }] },
  ],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id={COMP_ID}
    component={ReelComposition}
    width={sample.width}
    height={sample.height}
    fps={sample.fps}
    durationInFrames={Math.round((sample.durationMs / 1000) * sample.fps)}
    defaultProps={sample}
    // レンダー時に inputProps の長さ・サイズを反映する
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round((props.durationMs / 1000) * props.fps)),
      width: props.width,
      height: props.height,
      fps: props.fps,
    })}
  />
);
