// Unit tests for the LLM-facing text renderers. These are the load-bearing
// surface for agent quality, so they get explicit assertions on the
// non-obvious bits: the in/out mirroring legend, library-vs-inline route
// labelling, motion endPoint emission, named-color fallback to RGB, and
// the route-coordinate-frame note.

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDefaultPlaybook } from "../../src/data/defaultPlaybook.js";
import { Play } from "../../src/models/play.js";
import { Route } from "../../src/models/route.js";
import { Motion } from "../../src/models/motion.js";
import { Path } from "../../src/models/path.js";
import { Color } from "../../src/models/color.js";
import { Category } from "../../src/models/category.js";

import { describePlaybook, describePlay } from "../describe.js";

function buildBookWithSamplePlay() {
  const pb = buildDefaultPlaybook("Test Book", 5);
  pb.addCategory(new Category("Pass"));
  pb.addCategory(new Category("Quick Game"));

  const formation = pb.getFormation("Spread Right");
  const play = Play.fromFormation("Smash Right", "SR-1", formation);
  play.comment = "high-low concept on the corner";
  play.categoryNames = new Set(["Pass", "Quick Game"]);

  // Assign a library route to WRR (deep-cloned, as the editor would do)
  const wrr = play.players.find((p) => p.role.shortName === "WRR");
  wrr.route = pb.getRoute("Corner").clone();
  wrr.color = new Color(40, 80, 220); // blue

  // Inline route + motion on SRR
  const srr = play.players.find((p) => p.role.shortName === "SRR");
  srr.route = new Route("", "", [new Path(8, 0)]);
  srr.motion = new Motion([new Path(4, -2)], { x: 4, y: -2 });
  srr.color = new Color(40, 170, 80); // green

  // Curved alt-route on WRL to exercise Bezier formatting
  const wrl = play.players.find((p) => p.role.shortName === "WRL");
  wrl.altRoute1 = new Route("Wheel", "", [new Path(-3, 4, -2, 2), new Path(0, 12)]);

  pb.addPlay(play);
  return pb;
}

test("describePlaybook lists formations, routes, categories, plays", () => {
  const pb = buildBookWithSamplePlay();
  const out = describePlaybook(pb);

  assert.match(out, /Playbook: "Test Book" \(5-on-5\)/);
  assert.match(out, /Spread Right \(5 players\)/);
  assert.match(out, /Routes \(library, 14\)/);
  assert.match(out, /Hook/);
  assert.match(out, /Pass \(1 plays\)/);
  assert.match(out, /"Smash Right" \[SR-1\] \(Spread Right\)/);
  assert.match(out, /Pass, Quick Game/);
  assert.match(out, /\+x right/);
});

test("describePlay shows positions, library route, inline route, motion, alt route", () => {
  const pb = buildBookWithSamplePlay();
  const out = describePlay(pb, "Smash Right");

  assert.match(out, /Play "Smash Right" \(code: SR-1\)/);
  assert.match(out, /Formation: Spread Right \(5p\)/);
  assert.match(out, /Categories: Pass, Quick Game/);
  assert.match(out, /Comment: high-low concept on the corner/);

  // SRR row with named color "green"
  assert.match(out, /SRR.+green/);

  // Library label for WRR's Corner route
  assert.match(out, /WRR[\s\S]*route \(library\) "Corner"/);
  // Inline label for SRR's anonymous route
  assert.match(out, /SRR[\s\S]*route \(inline\):/);
  // Motion endpoint emitted
  assert.match(out, /motion \(pre-snap, dashed\) → ends at \(4, -2\)/);
  // Alt-route 1 with curved path notation
  assert.match(out, /alt-route 1 \(orange dashed\) "Wheel"/);
  assert.match(out, /curve via control \(-2, 2\)/);

  // The mirror legend MUST be present — agents need it.
  assert.match(out, /5 In/);
  assert.match(out, /un-mirrored frame/);
});

test("describePlay throws on unknown play", () => {
  const pb = buildBookWithSamplePlay();
  assert.throws(() => describePlay(pb, "no-such-play"), /No play named/);
});

test("describeColor falls back to rgb() for unrecognized colors", () => {
  const pb = buildBookWithSamplePlay();
  const wrl = pb.getPlay("Smash Right").players.find((p) => p.role.shortName === "WRL");
  wrl.color = new Color(100, 200, 200); // cyan-ish; no named palette match
  const out = describePlay(pb, "Smash Right");
  assert.match(out, /WRL.+rgb\(100, 200, 200\)/);
});
