import { describe, expect, test } from "vitest";
import { rangeSelect, withShift, type RangeAnchor } from "../range-select";

const ORDER = ["a", "b", "c", "d", "e"];

describe("rangeSelect", () => {
  test("a tick alone: that row, it the anchor with the selection then", () => {
    expect(rangeSelect(ORDER, [], null, "b", true, false)).toEqual({ selected: ["b"], anchor: { key: "b", checked: true, base: ["b"] } });
    expect(rangeSelect(ORDER, ["b", "c"], null, "b", false, false).selected).toEqual(["c"]);
  });

  test("Shift: every row between the anchor and it, in the order shown, either way, the anchor's state", () => {
    const { anchor } = rangeSelect(ORDER, [], null, "b", true, false);
    expect(rangeSelect(ORDER, ["b"], anchor, "d", true, true).selected).toEqual(["b", "c", "d"]);
    const up = rangeSelect(ORDER, [], null, "d", true, false);
    expect(rangeSelect(ORDER, ["d"], up.anchor, "a", true, true).selected.sort()).toEqual(["a", "b", "c", "d"]);
  });

  test("the anchor unticked: the range unticked, the rows out of it kept", () => {
    const { selected, anchor } = rangeSelect(ORDER, ["a", "b", "c", "d", "e"], null, "b", false, false);
    expect(rangeSelect(ORDER, selected, anchor, "d", true, true).selected).toEqual(["a", "e"]);
  });

  test("the anchor kept: another Shift-click redoes the range from it, over the selection of its time", () => {
    const start = rangeSelect(ORDER, [], null, "b", true, false);
    const wide = rangeSelect(ORDER, start.selected, start.anchor, "e", true, true);
    expect(wide.selected).toEqual(["b", "c", "d", "e"]);
    expect(rangeSelect(ORDER, wide.selected, wide.anchor, "c", false, true).selected).toEqual(["b", "c"]);
  });

  test("no anchor, or one the list no longer shows: the row alone", () => {
    expect(rangeSelect(ORDER, [], null, "c", true, true).selected).toEqual(["c"]);
    const gone: RangeAnchor<string> = { key: "z", checked: true, base: ["z"] };
    expect(rangeSelect(ORDER, ["z"], gone, "c", true, true).selected).toEqual(["z", "c"]);
  });

  test("Shift told by the click the change comes from", () => {
    expect(withShift({ nativeEvent: { shiftKey: true } })).toBe(true);
    expect(withShift({ nativeEvent: { shiftKey: false } })).toBe(false);
    expect(withShift(undefined)).toBe(false);
  });
});
