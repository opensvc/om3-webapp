import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PanelHistoryRail } from "../PanelHistory";
import { setHistoryGrouping, typeOf } from "../panel-history";
import { reloadRecordHistory, useRecordHistory } from "../record-history";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  reloadRecordHistory();
  setHistoryGrouping("time");
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

/** Records shown, the last one the most recent. */
function show(...steps: [string, string][]) {
  const { result } = renderHook(() => useRecordHistory());
  steps.forEach(([kind, id]) => {
    act(() => {
      result.current.record(kind, id);
    });
  });
}

const renderRail = () =>
  render(
    <MemoryRouter>
      <PanelHistoryRail currentKey="" />
    </MemoryRouter>,
  );

/** The groups as shown: their title, then the names of their records. */
const groups = () =>
  screen.getAllByRole("region").map((group) => [
    within(group).getByRole("heading").textContent,
    within(group)
      .getAllByRole("listitem")
      // The name of the record, without the label of its remove button.
      .map((item) => item.querySelector(".truncate")?.textContent),
  ]);

describe("typeOf", () => {
  test.each([
    [{ kind: "object", id: "ns1/svc/web" }, "svc"],
    [{ kind: "object", id: "web" }, "svc"],
    [{ kind: "object", id: "vol/data" }, "vol"],
    [{ kind: "object", id: "ns1/sec/tls" }, "sec"],
    [{ kind: "object", id: "cluster" }, "ccfg"],
    [{ kind: "network", id: "lo" }, "network"],
    [{ kind: "namespace", id: "ns1" }, "namespace"],
  ])("%j is %s", (step, type) => {
    expect(typeOf(step)).toBe(type);
  });
});

describe("history grouping", () => {
  const switchOf = (container: HTMLElement = document.body) =>
    within(container).getByRole("group", { name: "Group the history" });

  test("two buttons, by time pressed by default; by kind, the om3 kinds in order, the most recent first in each", () => {
    show(["object", "ns1/sec/tls"], ["object", "ns1/svc/web"], ["network", "lo"], ["object", "ns1/svc/db"]);
    renderRail();
    const byTime = within(switchOf()).getByRole("button", { name: "By time" });
    const byKind = within(switchOf()).getByRole("button", { name: "By kind" });
    expect(byTime).toHaveAttribute("aria-pressed", "true");
    expect(byKind).toHaveAttribute("aria-pressed", "false");
    expect(groups()).toEqual([["Now", ["ns1/svc/db", "lo", "ns1/svc/web", "ns1/sec/tls"]]]);

    fireEvent.click(byKind);
    expect(byKind).toHaveAttribute("aria-pressed", "true");
    expect(byTime).toHaveAttribute("aria-pressed", "false");
    // Each heading: the kind, and how many records it holds.
    expect(groups()).toEqual([
      ["Services2", ["ns1/svc/db", "ns1/svc/web"]],
      ["Secrets1", ["ns1/sec/tls"]],
      ["Networks1", ["lo"]],
    ]);
    // Grouped by kind, a record's tooltip says when it was shown.
    expect(screen.getByRole("button", { name: "ns1/svc/web" })).toHaveAttribute(
      "title",
      expect.stringMatching(/^Show ns1\/svc\/web · shown /),
    );

    fireEvent.click(byTime);
    expect(groups()).toEqual([["Now", ["ns1/svc/db", "lo", "ns1/svc/web", "ns1/sec/tls"]]]);
  });

  test("the grouping is remembered in this browser, and shared by every panel", () => {
    show(["object", "ns1/svc/web"], ["network", "lo"]);
    const first = renderRail();
    const second = renderRail();
    fireEvent.click(within(switchOf(first.container)).getByRole("button", { name: "By kind" }));
    expect(within(switchOf(second.container)).getByRole("button", { name: "By kind" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem("om3.panelHistory.grouping")).toBe("kind");
  });
});
