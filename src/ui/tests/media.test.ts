import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useMediaQuery } from "../lib/media";

describe("useMediaQuery", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  test("is false without matchMedia", () => {
    // @ts-expect-error jsdom has no matchMedia: simulate it explicitly
    window.matchMedia = undefined;
    const { result } = renderHook(() => useMediaQuery("(min-width: 48rem)"));
    expect(result.current).toBe(false);
  });

  test("follows the query as it changes", () => {
    let matches = true;
    const listeners = new Set<() => void>();
    window.matchMedia = vi.fn().mockImplementation(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }));
    const { result, unmount } = renderHook(() => useMediaQuery("(min-width: 48rem)"));
    expect(result.current).toBe(true);
    act(() => {
      matches = false;
      listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(false);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
