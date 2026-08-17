import { describe, expect, it } from "vitest";
import {
  applyPrediction,
  EMPTY_EVIDENCE,
  isMastered,
  overallMastery,
  scoreExplanation,
} from "./mastery.ts";
import { inspectSource } from "./sandbox-policy.ts";
import { TWO_REMOTE_CONTROLS } from "./lessons/two-remote-controls.ts";

describe("mastery", () => {
  it("does not treat a lucky click as mastery", () => {
    let e = applyPrediction(EMPTY_EVIDENCE, true, true, 1000);
    expect(isMastered(e, [])).toBe(false);
    expect(overallMastery(e)).toBeLessThan(0.5);
  });

  it("rejects pass-by-reference myth in explanations", () => {
    const s = scoreExplanation(
      "Java passes objects by reference so b is another array",
      ["reference", "object"],
      ["pass objects by reference", "b is another array"],
    );
    expect(s.score).toBeLessThan(0.4);
    expect(s.hitTrap).toBeTruthy();
  });

  it("accepts a precise explanation", () => {
    const s = scoreExplanation(
      "Assignment copies the reference value. Both variables point at the same array object. Mutation is visible through either name.",
      ["reference", "object"],
      ["pass objects by reference"],
    );
    expect(s.missing).toEqual([]);
    expect(s.score).toBe(1);
  });
});

describe("lesson", () => {
  it("requires prediction before the run blocks in the authored order", () => {
    const kinds = TWO_REMOTE_CONTROLS.blocks.map((b) => b.kind);
    expect(kinds.indexOf("predict")).toBeLessThan(kinds.indexOf("run"));
    expect(TWO_REMOTE_CONTROLS.blocks.some((b) => b.kind === "debug")).toBe(true);
  });
});

describe("sandbox policy", () => {
  it("blocks process spawning patterns", () => {
    expect(inspectSource("class Main { ProcessBuilder p; }", 1000)).toMatch(/Process/);
  });
});
