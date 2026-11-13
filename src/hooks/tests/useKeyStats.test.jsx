import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {act, renderHook, waitFor} from "@testing-library/react";
import {clearKeyStats, useKeyStats} from "../useKeyStats.js";
import useEventStore from "../useEventStore.js";

const keys = (items) => ({ok: true, json: async () => ({items})});

describe("useKeyStats", () => {
    beforeEach(() => clearKeyStats());
    afterEach(() => vi.restoreAllMocks());

    test("one read for the object, kept for the next rows showing it", async () => {
        const fetch = vi.spyOn(global, "fetch").mockResolvedValue(keys([{size: 3}, {size: 4}]));
        const first = renderHook(() => useKeyStats("root/cfg/a"));
        await waitFor(() => expect(first.result.current).toEqual({count: 2, size: 7}));
        const second = renderHook(() => useKeyStats("root/cfg/a"));
        expect(second.result.current).toEqual({count: 2, size: 7});
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test("one entry an object: its configuration changed, the read of before replaced, not kept beside it", async () => {
        const fetch = vi.spyOn(global, "fetch").mockResolvedValue(keys([{size: 3}]));
        const at = (csum) => act(() => useEventStore.setState({instanceConfig: {"root/cfg/a": {n1: {csum, updated_at: "t"}}}}));
        at("one");
        const view = renderHook(() => useKeyStats("root/cfg/a"));
        await waitFor(() => expect(view.result.current).toEqual({count: 1, size: 3}));
        fetch.mockResolvedValue(keys([{size: 3}, {size: 5}]));
        at("two");
        await waitFor(() => expect(view.result.current).toEqual({count: 2, size: 8}));
        expect(fetch).toHaveBeenCalledTimes(2);
        // Back to the first configuration: read again, its entry gone with the change.
        at("one");
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
        act(() => useEventStore.setState({instanceConfig: {}}));
    });

    test("a read ending after the session ended is kept for no one", async () => {
        let answer;
        const fetch = vi.spyOn(global, "fetch").mockImplementation(() => new Promise((resolve) => {
            answer = resolve;
        }));
        const first = renderHook(() => useKeyStats("root/cfg/a"));
        clearKeyStats();
        await act(async () => answer(keys([{size: 3}])));
        first.unmount();
        fetch.mockResolvedValue(keys([]));
        const next = renderHook(() => useKeyStats("root/cfg/a"));
        await waitFor(() => expect(next.result.current).toEqual({count: 0, size: 0}));
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
