import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SECRET_REVEAL_MS, formatSeconds, useAutoHide } from "../lib/reveal";

describe("useAutoHide", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("masks a revealed secret after 10 seconds", () => {
    const hide = vi.fn();
    renderHook(() => useAutoHide(true, hide));
    vi.advanceTimersByTime(SECRET_REVEAL_MS - 1);
    expect(hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(hide).toHaveBeenCalledTimes(1);
    expect(SECRET_REVEAL_MS).toBe(10_000);
  });

  test("does nothing while hidden", () => {
    const hide = vi.fn();
    renderHook(() => useAutoHide(false, hide));
    vi.advanceTimersByTime(SECRET_REVEAL_MS * 2);
    expect(hide).not.toHaveBeenCalled();
  });

  test("hiding by hand or leaving cancels the timer", () => {
    const hide = vi.fn();
    const { rerender, unmount } = renderHook(({ shown }) => useAutoHide(shown, hide), {
      initialProps: { shown: true },
    });
    vi.advanceTimersByTime(5_000);
    rerender({ shown: false });
    vi.advanceTimersByTime(SECRET_REVEAL_MS);
    expect(hide).not.toHaveBeenCalled();

    rerender({ shown: true });
    unmount();
    vi.advanceTimersByTime(SECRET_REVEAL_MS);
    expect(hide).not.toHaveBeenCalled();
  });

  test("revealing again starts a new delay", () => {
    const hide = vi.fn();
    const { rerender } = renderHook(({ shown }) => useAutoHide(shown, hide), { initialProps: { shown: true } });
    vi.advanceTimersByTime(8_000);
    rerender({ shown: false });
    rerender({ shown: true });
    vi.advanceTimersByTime(8_000);
    expect(hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  test("counts the seconds left down while shown", () => {
    const { result, rerender } = renderHook(({ shown }) => useAutoHide(shown, () => {}), {
      initialProps: { shown: false },
    });
    expect(result.current).toBeNull();
    rerender({ shown: true });
    expect(result.current).toBe(10);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(9);
    act(() => vi.advanceTimersByTime(7_500));
    expect(result.current).toBe(2);
    rerender({ shown: false });
    expect(result.current).toBeNull();
    rerender({ shown: true });
    expect(result.current).toBe(10);
  });

  test("formats the seconds", () => {
    expect(formatSeconds(1)).toBe("1 second");
    expect(formatSeconds(7)).toBe("7 seconds");
  });
});
