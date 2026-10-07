import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { hasTimestamp, RpoBreachedMark, StoppedMark } from "../components/StateMarks";

describe("hasTimestamp", () => {
  test("is true for a set om3 timestamp only", () => {
    expect(hasTimestamp("2026-10-05T10:00:00Z")).toBe(true);
    expect(hasTimestamp("0001-01-01T00:00:00Z")).toBe(false);
    expect(hasTimestamp("")).toBe(false);
    expect(hasTimestamp(null)).toBe(false);
    expect(hasTimestamp(undefined)).toBe(false);
  });
});

describe("StoppedMark", () => {
  test("names the state and gives the stop date as its tooltip", () => {
    render(<StoppedMark stoppedAt="2026-10-05T10:00:00Z" label="Instance on node n1 is stopped" />);
    const mark = screen.getByRole("img", { name: "Instance on node n1 is stopped" });
    expect(mark.getAttribute("title")).toMatch(/^stopped at /);
    expect(mark).toHaveClass("text-ink-muted");
    expect(mark.querySelector("svg")).not.toBeNull();
  });

  test("says stopped without a date when it has none", () => {
    render(<StoppedMark />);
    expect(screen.getByRole("img", { name: "Stopped" })).toHaveAttribute("title", "stopped");
  });
});

describe("RpoBreachedMark", () => {
  test("is a warn mark named after the breach", () => {
    render(<RpoBreachedMark label="Instance on node n1 is lagging" />);
    const mark = screen.getByRole("img", { name: "Instance on node n1 is lagging" });
    expect(mark).toHaveAttribute("title", "RPO breached");
    expect(mark).toHaveClass("text-state-warn");
  });
});
