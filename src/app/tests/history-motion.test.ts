import { afterEach, describe, expect, test, vi } from "vitest";
import { moveHistoryEntries } from "../history-motion";

/** A list of entries, the keys in order. */
function list(...keys: string[]): HTMLElement {
  const ol = document.createElement("ol");
  for (const key of keys) {
    const li = document.createElement("li");
    li.dataset.entry = key;
    ol.append(li);
  }
  return ol;
}

const originalAnimate = Element.prototype.animate;

afterEach(() => {
  vi.unstubAllGlobals();
  Element.prototype.animate = originalAnimate;
});

describe("moveHistoryEntries", () => {
  test("a record coming in front slides in from above; the order unchanged, nothing moves", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const animate = vi.fn();
    Element.prototype.animate = animate;
    moveHistoryEntries(list("a"), "a");
    moveHistoryEntries(list("a"), "a");
    expect(animate).not.toHaveBeenCalled();

    moveHistoryEntries(list("b", "a"), "b,a");
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]![0]).toEqual([
      { opacity: 0, transform: "translateY(-20px)" },
      { opacity: 1, transform: "none" },
    ]);
  });

  test("no move for who asked for less motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const animate = vi.fn();
    Element.prototype.animate = animate;
    moveHistoryEntries(list("c"), "c");
    moveHistoryEntries(list("d", "c"), "d,c");
    expect(animate).not.toHaveBeenCalled();
  });
});
