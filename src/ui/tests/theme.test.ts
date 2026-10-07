import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  applyPalette,
  applyTheme,
  cachedPalette,
  cachedTheme,
  isDarkTheme,
  watchSystemTheme,
} from "../theme";

function mockSystemDark(matches: boolean) {
  const listeners: Array<() => void> = [];
  const query = {
    matches,
    addEventListener: vi.fn((_: string, listener: () => void) => listeners.push(listener)),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(query);
  return {
    query,
    change(next: boolean) {
      query.matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

describe("theme", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark", "contrast");
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  test("cachedTheme defaults to system, and reads a stored theme", () => {
    expect(cachedTheme()).toBe("system");
    localStorage.setItem("om3.theme", "light");
    expect(cachedTheme()).toBe("light");
  });

  test("cachedTheme ignores an unknown stored value", () => {
    localStorage.setItem("om3.theme", "sepia");
    expect(cachedTheme()).toBe("system");
  });

  test("cachedTheme carries over the former darkMode boolean", () => {
    localStorage.setItem("darkMode", "true");
    expect(cachedTheme()).toBe("dark");
    localStorage.setItem("darkMode", "false");
    expect(cachedTheme()).toBe("light");
  });

  test("cachedTheme falls back to system when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    try {
      expect(cachedTheme()).toBe("system");
      expect(cachedPalette()).toBe("standard");
    } finally {
      vi.restoreAllMocks();
    }
  });

  test("isDarkTheme resolves the system theme with matchMedia, light without it", () => {
    // @ts-expect-error jsdom has no matchMedia: simulate it explicitly
    window.matchMedia = undefined;
    expect(isDarkTheme("system")).toBe(false);
    mockSystemDark(true);
    expect(isDarkTheme("system")).toBe(true);
    expect(isDarkTheme("light")).toBe(false);
    expect(isDarkTheme("dark")).toBe(true);
  });

  test("applyTheme sets the dark class and stores the choice", () => {
    localStorage.setItem("darkMode", "false");
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("om3.theme")).toBe("dark");
    expect(localStorage.getItem("darkMode")).toBeNull();
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  test("watchSystemTheme follows the system only while the theme is system", () => {
    const system = mockSystemDark(false);
    let current: "system" | "light" = "system";
    const onApplied = vi.fn();
    const stop = watchSystemTheme(() => current, onApplied);

    system.change(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(onApplied).toHaveBeenCalledTimes(1);

    current = "light";
    system.change(false);
    expect(onApplied).toHaveBeenCalledTimes(1);

    stop();
    expect(system.query.removeEventListener).toHaveBeenCalled();
  });

  test("applyPalette toggles the contrast class and stores the choice", () => {
    applyPalette("contrast");
    expect(document.documentElement.classList.contains("contrast")).toBe(true);
    expect(cachedPalette()).toBe("contrast");
    applyPalette("standard");
    expect(document.documentElement.classList.contains("contrast")).toBe(false);
  });
});
