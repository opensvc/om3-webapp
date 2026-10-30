import { describe, expect, test } from "vitest";
import { cardLeft } from "../components/card-place";

describe("cardLeft", () => {
  test("under the element, its left edge on the element's, when it fits", () => {
    expect(cardLeft({ left: 100, right: 140 }, 200, 1600)).toBe(100);
  });

  test("not fitting, its right edge on the element's: each element near the right edge its own place", () => {
    // Two node columns of a side panel, near the right edge of a 1600px window.
    expect(cardLeft({ left: 1278, right: 1420 }, 330, 1600)).toBe(1090);
    expect(cardLeft({ left: 1437, right: 1580 }, 330, 1600)).toBe(1250);
    // A narrow card fits under the element as it is.
    expect(cardLeft({ left: 1437, right: 1580 }, 120, 1600)).toBe(1437);
  });

  test("kept inside the window, a margin from either edge", () => {
    expect(cardLeft({ left: 2, right: 20 }, 100, 1600)).toBe(8);
    expect(cardLeft({ left: 1500, right: 1600 }, 384, 1600)).toBe(1208);
    expect(cardLeft({ left: 50, right: 300 }, 384, 300)).toBe(8);
  });
});
