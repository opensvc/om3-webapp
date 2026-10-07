import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { StateGlyph } from "../components/StateGlyph";

describe("StateGlyph", () => {
  test.each([
    ["up", "circle", "currentColor"],
    ["warn", "path", "currentColor"],
    ["down", "rect", "currentColor"],
    ["unknown", "circle", "none"],
  ] as const)("draws %s as a %s, filled %s, the same size in every browser", (state, shape, fill) => {
    const { container } = render(<StateGlyph state={state} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-glyph", state);
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 12 12");
    expect(svg).toHaveClass("h-2.5", "w-2.5");
    expect(svg.querySelector(shape)).toHaveAttribute("fill", fill);
  });

  test("takes a size class", () => {
    const { container } = render(<StateGlyph state="down" className="h-2 w-2" />);
    expect(container.querySelector("svg")).toHaveClass("h-2", "w-2");
    expect(container.querySelector("svg")).not.toHaveClass("h-2.5");
  });
});
