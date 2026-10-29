import { describe, expect, test } from "vitest";
import { APP_VERSION, isRelease } from "../version";

describe("the version of the webapp", () => {
  test("embedded at its build", () => {
    expect(APP_VERSION).toMatch(/\S/);
  });

  test("whether it is exactly a release, neither past it nor dirty", () => {
    expect(isRelease("v1.0.0-rc7", "1.0.0-rc7")).toBe(true);
    expect(isRelease("v1.0.0-rc7-2-gb70a232", "1.0.0-rc7")).toBe(false);
    expect(isRelease("", "1.0.0")).toBe(false);
  });
});
