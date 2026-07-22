import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseEpisodePack } from "@manse/schema";
import { EpisodeSession } from "@manse/runtime-web/testing";

const PACK_URL = new URL("../public/packs/morning-star-catch/manse.pack.json", import.meta.url);
const pack = parseEpisodePack(JSON.parse(readFileSync(PACK_URL, "utf8")));

function pointerFrame(x, y, timestampMs, sequence) {
  return {
    timestampMs,
    sequence,
    source: "simulated",
    mirrored: true,
    synthetic: true,
    inferenceTimeMs: 0,
    poses: [{
      score: 1,
      landmarks: [{
        index: 16,
        name: "right_wrist",
        x,
        y,
        z: 0,
        visibility: 1,
        presence: 1,
      }],
    }],
  };
}

test("pointer play catches every authored star and reaches the terminal celebration", () => {
  const events = [];
  const session = new EpisodeSession(pack, {
    locale: "en",
    tier: "S",
    onEvent: (event) => events.push(event),
  });

  session.start(0);
  session.tick(2_500);
  assert.equal(session.getSnapshot(2_500).scene.id, "round-one");

  let timestamp = 2_500;
  let sequence = 0;
  for (let expected = 1; expected <= 3; expected += 1) {
    const target = session.getSnapshot(timestamp).targets.find((candidate) => !candidate.hit);
    assert.notEqual(target, undefined, `star ${expected} must be reachable`);
    for (const dwell of [20, 80, 80]) {
      timestamp += dwell;
      session.updatePose(pointerFrame(target.x, target.y, timestamp, sequence++));
    }
    assert.equal(session.getSnapshot(timestamp).completedTargets, expected);
  }

  timestamp += 1;
  session.tick(timestamp);
  const celebrating = session.getSnapshot(timestamp);
  assert.equal(celebrating.scene.id, "round-one");
  assert.equal(celebrating.status, "celebrating");
  assert.equal(celebrating.completedTargets, 3);
  assert.equal(events.filter((event) => event.type === "target-hit").length, 3);
  assert.equal(events.filter((event) => event.type === "challenge-progress").length, 3);
  assert.equal(events.some((event) => event.type === "audio-cue" && event.purpose === "success"), true);

  session.tick(timestamp + 1_600);
  assert.equal(session.getSnapshot(timestamp + 1_600).scene.id, "complete");
  session.tick(timestamp + 3_200);
  assert.equal(session.getSnapshot(timestamp + 3_200).status, "complete");
  assert.equal(events.at(-1)?.type, "complete");
});
