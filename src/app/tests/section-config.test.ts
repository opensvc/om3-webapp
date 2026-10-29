import { describe, expect, test } from "vitest";
import { boolOn, boolWrite } from "../section-config";

describe("a boolean keyword in a wizard", () => {
  test("on as written, else as its default; the words om reads as true", () => {
    expect(boolOn("true")).toBe(true);
    expect(boolOn("Yes")).toBe(true);
    expect(boolOn("false", "true")).toBe(false);
    expect(boolOn("", "true")).toBe(true);
    expect(boolOn(undefined, "false")).toBe(false);
    expect(boolOn("")).toBe(false);
  });

  test("written only where it departs from its default: a false kept where the default is true", () => {
    expect(boolWrite(false, "true")).toBe("false");
    expect(boolWrite(true, "true")).toBe("");
    expect(boolWrite(true, "false")).toBe("true");
    expect(boolWrite(false, "false")).toBe("");
    expect(boolWrite(true)).toBe("true");
    expect(boolWrite(false)).toBe("");
  });
});
