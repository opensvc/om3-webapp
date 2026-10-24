import { describe, expect, test } from "vitest";
import { ALL, presetOf, presetPeriod } from "../snapshot-timeline";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const H = 3_600_000;
const D = 24 * H;

describe("snapshot periods", () => {
  test("the presets, their periods back from now; latest, from the last snapshot; a period said its preset", () => {
    const times = [NOW - 2 * H, NOW - 3 * D];
    expect(presetPeriod("24h", NOW, times)).toEqual({ since: NOW - D, until: null });
    expect(presetPeriod("latest", NOW, times)).toEqual({ since: NOW - 2 * H, until: null });
    expect(presetPeriod("all", NOW, times)).toEqual(ALL);
    expect(presetOf({ since: NOW - 7 * D, until: null }, NOW, times)).toBe("7d");
    expect(presetOf({ since: NOW - 5 * D, until: NOW - D }, NOW, times)).toBeNull();
  });

});
