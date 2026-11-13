import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../i18n";
import { RecordPanel } from "../RecordPanel";

vi.mock("../../hooks/useAiAvailable.js", () => ({ default: () => true }));

const renderPanel = (ask?: string) =>
  render(
    <MemoryRouter>
      <RecordPanel open kind="node" recordId="dev5n1" title="dev5n1" onClose={() => undefined} ask={ask}>
        {() => <p>content</p>}
      </RecordPanel>
    </MemoryRouter>,
  );

describe("the question of a record panel", () => {
  test("opens the assistant from the title bar", () => {
    renderPanel("Review the health of the node dev5n1.");
    const link = screen.getByRole("link", { name: "Analyze with the assistant" });
    expect(new URL(link.getAttribute("href") ?? "", "https://webapp.example.com").searchParams.get("prompt")).toBe(
      "Review the health of the node dev5n1.",
    );
  });
  test("none, no link", () => {
    renderPanel();
    expect(screen.queryByRole("link", { name: "Analyze with the assistant" })).toBeNull();
  });
  test.each([
    ["ai.askAbout.object", { path: "prod/svc/web", context: "down" }, "Analyze why the object prod/svc/web is down"],
    ["ai.askAbout.object", { path: "prod/svc/web", context: "warn" }, "Analyze why the object prod/svc/web is in warn"],
    ["ai.askAbout.object", { path: "prod/svc/web" }, "Review the object prod/svc/web"],
    ["ai.askAbout.instance", { path: "prod/svc/web", node: "dev5n1", context: "down" }, "Analyze why the instance of prod/svc/web on the node dev5n1 is down"],
    ["ai.askAbout.resource", { path: "prod/svc/web", rid: "fs#1", node: "dev5n1", context: "node" }, "Review the resource fs#1 of prod/svc/web on the node dev5n1"],
    ["ai.askAbout.node", { node: "dev5n1", context: "overloaded" }, "Analyze why the node dev5n1 is overloaded"],
  ])("asks %s by its state", (key, options, start) => {
    expect(i18n.t(key, options)).toMatch(new RegExp(`^${start.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`));
  });
});
