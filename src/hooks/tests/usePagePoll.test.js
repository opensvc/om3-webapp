import {act, renderHook} from '@testing-library/react';
import {vi} from 'vitest';
import {usePagePoll} from '../usePagePoll';

describe('usePagePoll', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const advance = (ms) => act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });

    test('reads at once, then the pace after each read ends, never two at a time', async () => {
        const ends = [];
        const read = vi.fn(() => new Promise((resolve) => ends.push(resolve)));
        renderHook(() => usePagePoll(read, 1000, []));
        expect(read).toHaveBeenCalledTimes(1);
        await advance(5000);
        expect(read).toHaveBeenCalledTimes(1);
        await act(async () => ends[0]());
        await advance(999);
        expect(read).toHaveBeenCalledTimes(1);
        await advance(1);
        expect(read).toHaveBeenCalledTimes(2);
    });

    test('a read is told when the poll no longer stands; unmounted, nothing more is read', async () => {
        let live = null;
        const read = vi.fn(async (isLive) => {
            live = isLive;
        });
        const {unmount} = renderHook(() => usePagePoll(read, 1000, []));
        await advance(0);
        expect(live()).toBe(true);
        unmount();
        expect(live()).toBe(false);
        await advance(5000);
        expect(read).toHaveBeenCalledTimes(1);
    });

    test('hidden, it stops; seen again, it reads at once', async () => {
        const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
        try {
            const read = vi.fn(async () => undefined);
            renderHook(() => usePagePoll(read, 1000, []));
            await advance(0);
            visibility.mockReturnValue('hidden');
            await advance(5000);
            expect(read).toHaveBeenCalledTimes(1);
            visibility.mockReturnValue('visible');
            act(() => document.dispatchEvent(new Event('visibilitychange')));
            await advance(0);
            expect(read).toHaveBeenCalledTimes(2);
        } finally {
            visibility.mockRestore();
        }
    });

    test('its deps changed, it starts over at once', async () => {
        const read = vi.fn(async () => undefined);
        const {rerender} = renderHook(({n}) => usePagePoll(read, 1000, [n]), {initialProps: {n: 0}});
        await advance(0);
        rerender({n: 1});
        await advance(0);
        expect(read).toHaveBeenCalledTimes(2);
    });
});
