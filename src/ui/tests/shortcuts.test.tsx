import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import {
  setShortcutsHelp,
  SHORTCUTS,
  typing,
  useShortcut,
  useShortcutsHelp,
} from "../lib/shortcuts";

describe("typing", () => {
  test("is true in fields and editable content", () => {
    render(
      <>
        <input aria-label="input" />
        <textarea aria-label="area" />
        <select aria-label="select" />
        <div data-testid="editable" contentEditable suppressContentEditableWarning />
      </>,
    );
    expect(typing(screen.getByRole("textbox", { name: "input" }))).toBe(true);
    expect(typing(screen.getByRole("textbox", { name: "area" }))).toBe(true);
    expect(typing(screen.getByRole("combobox", { name: "select" }))).toBe(true);
    const editable = screen.getByTestId("editable");
    // jsdom does not implement isContentEditable.
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(typing(editable)).toBe(true);
  });

  test("is false elsewhere", () => {
    render(<button type="button">Go</button>);
    expect(typing(screen.getByRole("button"))).toBe(false);
    expect(typing(document.body)).toBe(false);
    expect(typing(null)).toBe(false);
    expect(typing(window)).toBe(false);
  });
});

describe("useShortcut", () => {
  function listen(handler: () => boolean | undefined, key = "p") {
    return renderHook(() => {
      useShortcut(key, handler);
    });
  }

  function press(target: EventTarget, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent("keydown", { key: "p", bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("runs the handler for its key outside a field, and takes the key", () => {
    const handler = vi.fn(() => true);
    listen(handler);
    const event = press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  test("a handler returning undefined takes the key too", () => {
    listen(() => undefined);
    expect(press(document.body).defaultPrevented).toBe(true);
  });

  test("a handler returning false leaves the key to the others", () => {
    listen(() => false);
    expect(press(document.body).defaultPrevented).toBe(false);
  });

  test("ignores other keys", () => {
    const handler = vi.fn(() => true);
    listen(handler);
    press(document.body, { key: "q" });
    expect(handler).not.toHaveBeenCalled();
  });

  test("ignores typing in a field", () => {
    const handler = vi.fn(() => true);
    listen(handler);
    render(<input aria-label="search" />);
    press(screen.getByRole("textbox"));
    expect(handler).not.toHaveBeenCalled();
  });

  test.each(["ctrlKey", "metaKey", "altKey"] as const)("ignores the key with %s", (modifier) => {
    const handler = vi.fn(() => true);
    listen(handler);
    press(document.body, { [modifier]: true });
    expect(handler).not.toHaveBeenCalled();
  });

  test("ignores the key while a modal dialog is open", () => {
    const handler = vi.fn(() => true);
    listen(handler);
    const { unmount } = render(<div role="dialog" aria-modal="true" />);
    press(document.body);
    expect(handler).not.toHaveBeenCalled();
    unmount();
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("a non-modal dialog does not stop it", () => {
    const handler = vi.fn(() => true);
    listen(handler);
    render(<div role="dialog" aria-modal="false" />);
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("ignores a key another handler already took", () => {
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    listen(first);
    listen(second);
    press(document.body);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  test("a handler with nothing to do lets the next one act", () => {
    const first = vi.fn(() => false);
    const second = vi.fn(() => true);
    listen(first);
    listen(second);
    press(document.body);
    expect(second).toHaveBeenCalledTimes(1);
  });

  test("uses the latest handler and stops listening once unmounted", () => {
    const before = vi.fn(() => true);
    const after = vi.fn(() => true);
    const hook = renderHook(({ handler }) => {
      useShortcut("p", handler);
    }, { initialProps: { handler: before } });
    hook.rerender({ handler: after });
    fireEvent.keyDown(document.body, { key: "p" });
    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);
    hook.unmount();
    fireEvent.keyDown(document.body, { key: "p" });
    expect(after).toHaveBeenCalledTimes(1);
  });
});

describe("shortcuts help", () => {
  test("useShortcutsHelp follows setShortcutsHelp", () => {
    const { result } = renderHook(() => useShortcutsHelp());
    expect(result.current).toBe(false);
    act(() => {
      setShortcutsHelp(true);
    });
    expect(result.current).toBe(true);
    act(() => {
      setShortcutsHelp(false);
    });
    expect(result.current).toBe(false);
  });

  test("every shortcut has keys and a label key", () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.keys.length).toBeGreaterThan(0);
      expect(shortcut.labelKey).toMatch(/^shortcuts\./);
    }
  });
});
