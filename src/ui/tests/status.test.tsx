import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, type ObjectState } from "../components/StatusBadge";
import { statusBadge, toObjectState } from "../components/status";
import { FrozenMark } from "../components/FrozenMark";
import { ObjectIcon, type ObjectKind, om3ObjectKind } from "../components/ObjectIcon";

describe("StatusBadge", () => {
  test.each([
    ["up", "up", "●", "text-state-up"],
    ["warn", "warn", "▲", "text-state-warn"],
    ["down", "down", "■", "text-state-down"],
    ["unknown", "n/a", "○", "text-state-unknown"],
  ] as [ObjectState, string, string, string][])(
    "%s reads %s with the glyph %s in %s",
    (state, label, glyph, ink) => {
      const { container } = render(<StatusBadge state={state} />);
      const badge = container.firstElementChild;
      expect(badge).toHaveTextContent(`${glyph}${label}`);
      expect(badge).toHaveClass(ink);
      const mark = screen.getByText(glyph);
      expect(mark).toHaveAttribute("aria-hidden", "true");
    },
  );

  test("label replaces the state's label, keeping its shape", () => {
    const { container } = render(<StatusBadge state="up" label="stdby up" className="extra" />);
    const badge = container.firstElementChild;
    expect(badge).toHaveTextContent("●stdby up");
    expect(badge).toHaveClass("text-state-up", "extra");
  });
});

describe("toObjectState", () => {
  test.each([
    ["up", "up"],
    ["warn", "warn"],
    ["down", "down"],
    ["n/a", "unknown"],
    ["", "unknown"],
    [undefined, "unknown"],
    ["stdby up", "unknown"],
  ] as [string | undefined, ObjectState][])("%j is %s", (value, state) => {
    expect(toObjectState(value)).toBe(state);
  });
});

describe("statusBadge", () => {
  test("standby values take the colour of their state and keep their label", () => {
    expect(statusBadge("stdby up")).toEqual({ state: "up", label: "stdby up" });
    expect(statusBadge("stdby down")).toEqual({ state: "down", label: "stdby down" });
  });

  test("undef is unknown, with its own label", () => {
    expect(statusBadge("undef")).toEqual({ state: "unknown", label: "undef" });
  });

  test("other values map through toObjectState, without a label", () => {
    expect(statusBadge("warn")).toEqual({ state: "warn" });
    expect(statusBadge("n/a")).toEqual({ state: "unknown" });
    expect(statusBadge(undefined)).toEqual({ state: "unknown" });
  });
});

describe("FrozenMark", () => {
  test("renders nothing when not frozen", () => {
    const { container } = render(<FrozenMark frozen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("frozen, a snowflake doubled by a text and a tooltip", () => {
    const { container } = render(<FrozenMark frozen />);
    const mark = screen.getByTitle("frozen");
    expect(mark).toHaveTextContent("frozen");
    expect(mark.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".sr-only")).toHaveTextContent("frozen");
  });
});

describe("ObjectIcon", () => {
  const TINTS: Record<ObjectKind, string> = {
    dashboard: "text-icon-dashboard",
    node: "text-icon-node",
    cluster: "text-icon-node",
    service: "text-icon-service",
    instance: "text-icon-service",
    network: "text-icon-network",
    disk: "text-icon-disk",
    app: "text-icon-app",
    tag: "text-icon-tag",
    tags: "text-icon-tag",
    group: "text-icon-group",
    user: "text-icon-group",
    obsolescence: "text-icon-node",
    log: "text-icon-dashboard",
    filter: "text-icon-dashboard",
    filterset: "text-icon-dashboard",
    form: "text-icon-form",
    package: "text-icon-package",
    hardware: "text-icon-node",
    switch: "text-icon-network",
    metric: "text-icon-metric",
    report: "text-icon-metric",
    chart: "text-icon-metric",
    moduleset: "text-icon-compliance",
    ruleset: "text-icon-compliance",
    complianceLog: "text-icon-compliance",
    designer: "text-icon-compliance",
    namespace: "text-icon-app",
    kind: "text-icon-tag",
    pool: "text-icon-disk",
    heartbeat: "text-icon-network",
    config: "text-icon-form",
    secret: "text-icon-compliance",
  };

  test.each(Object.entries(TINTS) as [ObjectKind, string][])(
    "%s renders a hidden svg tinted %s",
    (kind, tint) => {
      const { container } = render(<ObjectIcon kind={kind} className="h-4" />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveClass("shrink-0", tint, "h-4");
    },
  );

  test("om3 kinds reuse the collector glyphs of their family", () => {
    const glyph = (kind: ObjectKind) =>
      render(<ObjectIcon kind={kind} />).container.querySelector("svg")?.innerHTML;
    expect(glyph("pool")).toBe(glyph("disk"));
    expect(glyph("kind")).toBe(glyph("tag"));
  });
});

describe("om3ObjectKind", () => {
  test.each([
    ["svc", "service"],
    ["vol", "disk"],
    ["cfg", "config"],
    ["sec", "secret"],
    ["usr", "user"],
    ["ccfg", "cluster"],
    ["nscfg", "namespace"],
    ["unknown", "service"],
    [undefined, "service"],
  ] as const)("maps the om3 kind %s to the %s pictogram", (kind, expected) => {
    expect(om3ObjectKind(kind)).toBe(expected);
  });
});
