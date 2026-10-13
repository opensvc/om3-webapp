import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { GlobalSearch } from "../GlobalSearch";
import { LIMIT_ALL, hitIcon, search, type SearchIndex } from "../search";

const index: SearchIndex = {
  entries: [
    { kind: "object", id: "system/svc/dns", label: "system/svc/dns", context: ["svc"], status: "down" },
    { kind: "object", id: "foo001", label: "foo001", context: ["svc"], status: "n/a" },
    { kind: "object", id: "ns1/sec/dns-key", label: "ns1/sec/dns-key", context: ["sec"] },
    { kind: "namespace", id: "system", label: "system", context: [] },
    { kind: "node", id: "dev3n1", label: "dev3n1", context: ["v3.0.0"] },
    { kind: "network", id: "default", label: "default", context: ["bridge", "10.22.0.0/24"] },
  ],
  failed: [],
};

describe("search", () => {
  test("finds the text in the labels and the contexts, the ones starting with it first, by kind", () => {
    const groups = search(index, "dns", "all");
    expect(groups.map((g) => g.kind)).toEqual(["object"]);
    expect(groups[0]?.hits.map((h) => h.id)).toEqual(["ns1/sec/dns-key", "system/svc/dns"]);
    expect(search(index, "10.22", "all")[0]?.hits[0]?.id).toBe("default");
    expect(search(index, "SYSTEM", "all").map((g) => g.kind)).toEqual(["object", "namespace"]);
  });

  test("an empty query finds nothing, a scope narrows to one kind and shows more of it", () => {
    expect(search(index, "  ", "all")).toEqual([]);
    const many: SearchIndex = {
      entries: Array.from({ length: 12 }, (_, i) => ({ kind: "node" as const, id: `n${i}`, label: `n${i}`, context: [] })),
      failed: [],
    };
    expect(search(many, "n", "all")[0]).toMatchObject({ more: true });
    expect(search(many, "n", "all")[0]?.hits).toHaveLength(LIMIT_ALL);
    expect(search(many, "n", "node")[0]).toMatchObject({ more: false });
    expect(search(many, "n", "network")).toEqual([]);
  });

  test("a kind that could not be read says so", () => {
    expect(search({ entries: [], failed: ["network"] }, "x", "all")).toEqual([
      { kind: "network", hits: [], more: false, error: true },
    ]);
  });

  test("an object shows the icon of its kind", () => {
    expect(hitIcon(index.entries[2]!)).toBe("secret");
    expect(hitIcon(index.entries[1]!)).toBe("service");
  });
});

function Search() {
  return <output data-testid="location">{decodeURIComponent(useLocation().pathname + useLocation().search)}</output>;
}

function renderSearch(load = vi.fn(() => Promise.resolve(index))) {
  render(
    <MemoryRouter initialEntries={["/objects?kind=svc"]}>
      <GlobalSearch loadIndex={load} />
      <Search />
    </MemoryRouter>,
  );
  return load;
}

describe("GlobalSearch", () => {
  test("/ and Ctrl K open the palette, which reads the lists then", async () => {
    const load = renderSearch();
    expect(load).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("dialog", { name: "Search the cluster" })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox", { name: "Search the cluster" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Search the cluster" })).toBeInTheDocument();
  });

  test("a result opens its record over the view, the arrows choosing it", async () => {
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: /Search the cluster/ }));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "dns" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/objects?kind=svc&peek=object:system/svc/dns");
  });

  test("a node opens the list of the nodes; n/a is written /", async () => {
    renderSearch();
    fireEvent.keyDown(document.body, { key: "/" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "foo" } });
    const option = await screen.findByRole("option");
    expect(within(option).getByText("/")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "dev3" } });
    await waitFor(() => expect(screen.getByRole("option")).toHaveTextContent("opens the list"));
    fireEvent.click(screen.getByRole("option"));
    expect(screen.getByTestId("location")).toHaveTextContent("/nodes");
  });

  test("a scope narrows the search to one kind", async () => {
    renderSearch();
    fireEvent.keyDown(document.body, { key: "/" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "system" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Namespaces" }));
    expect(screen.getByRole("button", { name: "Namespaces" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  test("says when the lists could not be read", async () => {
    renderSearch(vi.fn(() => Promise.reject(new Error("HTTP 500"))));
    fireEvent.keyDown(document.body, { key: "/" });
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 500");
  });

  test("/ typed in a field stays a character", () => {
    renderSearch();
    const field = document.createElement("input");
    document.body.appendChild(field);
    act(() => field.focus());
    fireEvent.keyDown(field, { key: "/" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    field.remove();
  });
});
