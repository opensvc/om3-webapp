import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { RecordPanel } from "../RecordPanel";
import { usePanelHeader } from "../panel-header";
import { PanelAnchor } from "../PanelAnchor";
import { CrossLink } from "../CrossLink";
import { usePanelSearch } from "../panel-search";
import { readLastRecord, reloadRecordHistory } from "../record-history";
import { PanelSideProvider } from "../PanelSideProvider";
import { setPanelSide } from "../panel-side-pref";

function token(claims: Record<string, unknown>): string {
  return `h.${btoa(JSON.stringify(claims)).replace(/=+$/, "")}.s`;
}

beforeEach(() => {
  localStorage.setItem("authToken", token({ sub: "alice" }));
  sessionStorage.clear();
  reloadRecordHistory();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setPanelSide("right");
});

/** The panels open: a closed one stays mounted for its animation, inert. */
const openDialogs = () => screen.queryAllByRole("dialog").filter((d) => !d.hasAttribute("inert"));

/** The URL query, to read what a click asked for. */
function Search() {
  return <output data-testid="search">{decodeURIComponent(useLocation().search)}</output>;
}

/** A view with a record panel driven by the URL, as the views have. */
function View() {
  const { peek, peektab, setPeekTab, closePeek } = usePanelSearch();
  return (
    <>
      <CrossLink kind="network" id="lo">
        lo
      </CrossLink>
      <CrossLink kind="object" id="ns1/svc/web" tab="logs">
        web
      </CrossLink>
      <CrossLink kind="object" id={undefined}>
        plain
      </CrossLink>
      {(["network", "object"] as const).map((kind) => (
        <RecordPanel
          key={kind}
          open={peek?.kind === kind}
          kind={kind}
          recordId={peek?.kind === kind ? peek.id : undefined}
          title={peek?.kind === kind ? peek.id : ""}
          onClose={closePeek}
          tabs={[
            { key: "status", label: "Status" },
            { key: "logs", label: "Logs" },
          ]}
          tab={peektab}
          onTabChange={setPeekTab}
        >
          {(active) => <p>content of {active}</p>}
        </RecordPanel>
      ))}
      <PanelAnchor />
      <Search />
    </>
  );
}

function renderView(url = "/objects?kind=svc") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <View />
    </MemoryRouter>,
  );
}

describe("record panels", () => {
  test("a badge opens its record over the view, the filters kept, on its first tab", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "lo" }));
    expect(screen.getByTestId("search")).toHaveTextContent("?kind=svc&peek=network:lo");
    const panel = screen.getByRole("dialog", { name: "lo" });
    expect(within(panel).getByRole("tab", { name: "Status" })).toHaveAttribute("aria-selected", "true");
    expect(within(panel).getByText("content of status")).toBeInTheDocument();
  });

  test("a badge may name the tab to open on, and a tab change goes in the URL", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "web" }));
    const panel = screen.getByRole("dialog", { name: "ns1/svc/web" });
    expect(within(panel).getByText("content of logs")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("tab", { name: "Status" }));
    expect(screen.getByTestId("search")).not.toHaveTextContent("peektab");
    expect(within(panel).getByText("content of status")).toBeInTheDocument();
  });

  test("a value without an id stays plain text", () => {
    renderView();
    expect(screen.getByText("plain").closest("button")).toBeNull();
  });

  test("an unknown tab in the URL falls back to the first one", () => {
    renderView("/objects?peek=network:lo&peektab=bogus");
    expect(screen.getByText("content of status")).toBeInTheDocument();
  });

  test("a closed panel is inert, without its tabs nor its content", () => {
    renderView();
    expect(openDialogs()).toHaveLength(0);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText(/content of/)).not.toBeInTheDocument();
  });

  test("the records shown fill the history, which reopens them", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "lo" }));
    fireEvent.click(screen.getByRole("button", { name: "web" }));
    expect(readLastRecord()).toEqual({ kind: "object", id: "ns1/svc/web" });

    const panel = screen.getByRole("dialog", { name: "ns1/svc/web" });
    const history = within(panel).getByRole("navigation", { name: "Panel history" });
    expect(within(history).getByText("ns1/svc/web").closest("[aria-current]")).not.toBeNull();
    fireEvent.click(within(history).getByRole("button", { name: "lo" }));
    expect(screen.getByTestId("search")).toHaveTextContent("peek=network:lo");
    expect(screen.getByRole("dialog", { name: "lo" })).toBeInTheDocument();
  });

  test("closed, the anchor brings back the last record, and so does p", () => {
    renderView();
    expect(screen.queryByRole("button", { name: /Reopen/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "lo" }));
    fireEvent.click(screen.getByRole("button", { name: "web" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "ns1/svc/web" })).getAllByRole("button", { name: "Close" })[0]!);
    expect(screen.getByTestId("search")).toHaveTextContent("?kind=svc");

    const anchor = screen.getByRole("button", { name: /Reopen ns1\/svc\/web/ });
    expect(anchor).toHaveTextContent("2");
    fireEvent.click(anchor);
    expect(screen.getByRole("dialog", { name: "ns1/svc/web" })).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "p" });
    expect(openDialogs()).toHaveLength(0);
    fireEvent.keyDown(document.body, { key: "p" });
    expect(openDialogs().map((d) => d.getAttribute("aria-label"))).toEqual(["ns1/svc/web"]);
  });

  test("the content puts what concerns the whole record in the title bar", () => {
    function Content() {
      const slots = usePanelHeader();
      return (
        <>
          {slots.title !== null && createPortal(<span>flex</span>, slots.title)}
          {slots.actions !== null && createPortal(<button type="button">Actions</button>, slots.actions)}
        </>
      );
    }
    render(
      <MemoryRouter initialEntries={["/objects?peek=network:lo"]}>
        <RecordPanel open kind="network" recordId="lo" title="lo" onClose={() => {}}>
          {() => <Content />}
        </RecordPanel>
      </MemoryRouter>,
    );
    const actions = screen.getByRole("button", { name: "Actions" });
    // In the bar of the title, by the close button, not in the body.
    expect(actions.closest("[role=dialog] > div > div:first-child")).toContainElement(screen.getByRole("button", { name: "Close" }));
    // What qualifies the record, by its name.
    expect(screen.getByRole("heading", { name: "lo" }).nextElementSibling).toHaveTextContent("flex");
  });

  test("as in oc3, the panels move to the left edge and back, the choice kept by the browser", () => {
    render(
      <MemoryRouter initialEntries={["/objects?peek=network:lo"]}>
        <PanelSideProvider>
          <View />
        </PanelSideProvider>
      </MemoryRouter>,
    );
    const panel = () => screen.getByRole("dialog", { name: "lo" });
    expect(panel()).toHaveClass("right-0");
    fireEvent.click(within(panel()).getByRole("button", { name: "Move the panels to the left" }));
    expect(panel()).toHaveClass("left-0", "flex-row-reverse");
    expect(localStorage.getItem("om3.panelSide")).toBe("left");

    // Closed, the anchor that brings it back stands on the left edge too.
    fireEvent.click(within(panel()).getAllByRole("button", { name: "Close" })[0]!);
    expect(screen.getByRole("button", { name: /Reopen lo/ })).toHaveClass("rounded-r-(--radius-panel)");

    fireEvent.click(screen.getByRole("button", { name: /Reopen lo/ }));
    fireEvent.click(within(panel()).getByRole("button", { name: "Move the panels to the right" }));
    expect(panel()).toHaveClass("right-0");
    expect(localStorage.getItem("om3.panelSide")).toBeNull();
  });
});
