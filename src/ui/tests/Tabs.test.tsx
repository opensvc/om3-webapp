import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabList, type TabItem } from "../components/Tabs";
import { tabPanelProps, useTabsId } from "../components/tabs-ids";
import { CategoryCount, CategoryTabs, type CategoryTab } from "../components/CategoryTabs";

const TABS: TabItem[] = [
  { key: "props", label: "Properties" },
  { key: "logs", label: "Logs", badge: <span>12</span> },
  { key: "config", label: "Config", icon: <svg data-testid="config-icon" /> },
];

function Tabs({ onChange }: { onChange?: (key: string) => void }) {
  const [active, setActive] = useState("props");
  return (
    <>
      <TabList
        tabs={TABS}
        active={active}
        label="Sections"
        idPrefix="node"
        onChange={(key) => {
          onChange?.(key);
          setActive(key);
        }}
      />
      <div {...tabPanelProps("node", active)}>Panel {active}</div>
    </>
  );
}

describe("TabList", () => {
  test("renders a named tablist of tabs, the active one selected", () => {
    render(<Tabs />);
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Properties" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Logs 12" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("config-icon")).toBeInTheDocument();
  });

  test("only the active tab is in the Tab order", () => {
    render(<Tabs />);
    const [first, second, third] = screen.getAllByRole("tab");
    expect(first).toHaveAttribute("tabindex", "0");
    expect(second).toHaveAttribute("tabindex", "-1");
    expect(third).toHaveAttribute("tabindex", "-1");
  });

  test("the panel is labelled by the active tab, which controls it", () => {
    render(<Tabs />);
    const panel = screen.getByRole("tabpanel", { name: "Properties" });
    const tab = screen.getByRole("tab", { name: "Properties" });
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("tabindex", "0");
  });

  test("a click activates a tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs onChange={onChange} />);
    await user.click(screen.getByRole("tab", { name: "Config" }));
    expect(onChange).toHaveBeenCalledWith("config");
    expect(screen.getByRole("tabpanel", { name: "Config" })).toHaveTextContent("Panel config");
  });

  test("the arrows, Home and End activate and focus the next tab, wrapping around", async () => {
    const user = userEvent.setup();
    render(<Tabs />);
    const props = screen.getByRole("tab", { name: "Properties" });
    const logs = screen.getByRole("tab", { name: "Logs 12" });
    const config = screen.getByRole("tab", { name: "Config" });
    await user.click(props);

    await user.keyboard("{ArrowRight}");
    expect(logs).toHaveFocus();
    expect(logs).toHaveAttribute("aria-selected", "true");
    expect(logs).toHaveAttribute("tabindex", "0");
    expect(props).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{End}");
    expect(config).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(props).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(config).toHaveFocus();
    await user.keyboard("{Home}");
    expect(props).toHaveFocus();
    expect(props).toHaveAttribute("aria-selected", "true");
  });

  test("other keys do nothing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs onChange={onChange} />);
    screen.getByRole("tab", { name: "Properties" }).focus();
    await user.keyboard("{ArrowDown}a");
    expect(onChange).not.toHaveBeenCalled();
  });

  test("focuses tabs whose key needs escaping in a selector", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TabList
        tabs={[
          { key: "a.b", label: "A" },
          { key: "1 c", label: "C" },
        ]}
        active="a.b"
        label="Odd"
        idPrefix="odd"
        onChange={onChange}
      />,
    );
    screen.getByRole("tab", { name: "A" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("1 c");
    expect(screen.getByRole("tab", { name: "C" })).toHaveFocus();
  });
});

describe("tabs-ids", () => {
  test("tabPanelProps gives the ids the tab bar refers to", () => {
    expect(tabPanelProps("p", "logs")).toEqual({
      id: "p-panel-logs",
      role: "tabpanel",
      "aria-labelledby": "p-tab-logs",
      tabIndex: 0,
    });
  });

  test("useTabsId is stable and free of colons", () => {
    const { result, rerender } = renderHook(() => useTabsId());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first).not.toContain(":");
    expect(first).not.toBe("");
  });
});

type Category = "services" | "nodes" | "errors";

const CATEGORIES: CategoryTab<Category>[] = [
  { key: "services", label: "Services", mark: <CategoryCount count={4} />, tone: "strong" },
  { key: "nodes", label: "Nodes", description: "none", tone: "muted" },
  { key: "errors", label: "Errors", description: "could not load", tone: "error" },
];

function Categories({ onSelect }: { onSelect?: (key: Category) => void }) {
  const [active, setActive] = useState<Category>("services");
  return (
    <CategoryTabs
      label="Categories"
      idPrefix="cat"
      tabs={CATEGORIES}
      active={active}
      onSelect={(key) => {
        onSelect?.(key);
        setActive(key);
      }}
    />
  );
}

describe("CategoryTabs", () => {
  test("renders a named tablist, the active chip selected and in the Tab order", () => {
    render(<Categories />);
    expect(screen.getByRole("tablist", { name: "Categories" })).toBeInTheDocument();
    const services = screen.getByRole("tab", { name: "Services" });
    expect(services).toHaveAttribute("aria-selected", "true");
    expect(services).toHaveAttribute("tabindex", "0");
    expect(services).toHaveAttribute("id", "cat-tab-services");
    expect(services).toHaveAttribute("aria-controls", "cat-panel-services");
    expect(services).toHaveClass("border-accent");
  });

  test("the count is shown but hidden from assistive technologies", () => {
    render(<Categories />);
    const count = screen.getByText("4");
    expect(count).toHaveAttribute("aria-hidden", "true");
  });

  test("a description is said after the name", () => {
    render(<Categories />);
    expect(screen.getByRole("tab", { name: "Nodes, none" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "Errors, could not load" })).toHaveClass(
      "text-state-down",
    );
  });

  test("a click selects a chip", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Categories onSelect={onSelect} />);
    await user.click(screen.getByRole("tab", { name: "Nodes, none" }));
    expect(onSelect).toHaveBeenCalledWith("nodes");
    expect(screen.getByRole("tab", { name: "Nodes, none" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("the four arrows, Home and End move the choice and the focus", async () => {
    const user = userEvent.setup();
    render(<Categories />);
    const services = screen.getByRole("tab", { name: "Services" });
    const nodes = screen.getByRole("tab", { name: "Nodes, none" });
    const errors = screen.getByRole("tab", { name: "Errors, could not load" });
    services.focus();

    await user.keyboard("{ArrowDown}");
    expect(nodes).toHaveFocus();
    expect(nodes).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(errors).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(services).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(errors).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(nodes).toHaveFocus();
    await user.keyboard("{Home}");
    expect(services).toHaveFocus();
    await user.keyboard("{End}");
    expect(errors).toHaveFocus();
  });

  // CategoryTabs.tsx builds its selector without CSS.escape, unlike Tabs.tsx: a key
  // or an idPrefix that is not a plain CSS identifier throws instead of focusing.
  test("focuses chips whose key needs escaping in a selector", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CategoryTabs
        label="Odd"
        idPrefix="odd"
        tabs={[
          { key: "a.b", label: "A" },
          { key: "c.d", label: "C" },
        ]}
        active="a.b"
        onSelect={onSelect}
      />,
    );
    screen.getByRole("tab", { name: "A" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "C" })).toHaveFocus();
  });
});
