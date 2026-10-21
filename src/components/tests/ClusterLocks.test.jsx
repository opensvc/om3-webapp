import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {vi} from 'vitest';
import {ClusterLocks, LOCKS_EVERY_MS, durationMs} from '../ClusterLocks';
import {useActionTracker} from '../../app/action-tracker';

/** What the actions tray holds, the latest first: label, subject, state, reason. */
const tray = () => useActionTracker.getState().tracked.map((e) => [e.label, e.subject, e.state, e.error ?? null]);

const lock = (name, id, extra = {}) => ({
    name, id, node: 'n1', holder: `om pool claim ${name}`,
    acquired_at: '2026-10-21T10:00:00Z', expires_at: '2026-10-21T10:00:30Z', expires_in: '29.5s', ...extra,
});

describe('durationMs', () => {
    test('a Go duration in milliseconds', () => {
        expect(durationMs('29.5s')).toBe(29500);
        expect(durationMs('1m30s')).toBe(90000);
        expect(durationMs('250ms')).toBe(250);
        expect(durationMs('1h2m3s')).toBe(3723000);
        expect(durationMs('-1s')).toBe(-1000);
    });

    test.each([undefined, '', '30', 'soon', '1x'])('%s is no duration', (text) => {
        expect(durationMs(text)).toBeNull();
    });
});

describe('ClusterLocks', () => {
    let requests;
    let locks;
    let released;

    beforeEach(() => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        useActionTracker.setState({tracked: [], revealed: 0});
        localStorage.setItem('authToken', 'tok');
        requests = [];
        locks = [lock('net-default', 'id-2', {node: 'n2', holder: '', expires_in: '1m5s'}), lock('alloc', 'id-1')];
        released = {status: 204};
        global.fetch = vi.fn(async (url, options = {}) => {
            const method = options.method ?? 'GET';
            requests.push(`${method} ${decodeURIComponent(url)}`);
            if (method === 'DELETE') {
                if (released.status === 204) locks = locks.filter((l) => !url.includes(`id=${l.id}`));
                return new Response(released.status === 204 ? null : JSON.stringify({detail: released.detail}), {status: released.status});
            }
            return new Response(JSON.stringify({kind: 'ClusterLockList', items: locks}), {status: 200});
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
    });

    const renderLocks = () => render(<MemoryRouter><ClusterLocks/></MemoryRouter>);
    const table = () => screen.getByRole('table', {name: 'Cluster locks'});
    const rows = () => within(table()).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => c.textContent));

    test('the locks held, by name: holder, node, lease left counted down, id', async () => {
        renderLocks();
        await waitFor(() => expect(rows()).toHaveLength(2));
        const [alloc, net] = rows();
        expect([alloc[0], alloc[1], alloc[2], alloc[4], alloc[5]]).toEqual(['alloc', 'om pool claim alloc', 'n1', '30 s', 'id-1']);
        expect([net[0], net[1], net[2], net[4], net[5]]).toEqual(['net-default', '–', 'n2', '1 min 5 s', 'id-2']);
        expect(requests).toEqual(['GET /api/cluster/lock']);
        // The lease counted down between two reads, on the clock of the page.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(rows()[0][4]).toBe('27 s');
    });

    test('read again every few seconds: a lock taken or released shows, no event telling it', async () => {
        renderLocks();
        await waitFor(() => expect(rows()).toHaveLength(2));
        locks = [lock('alloc', 'id-1')];
        await act(async () => {
            await vi.advanceTimersByTimeAsync(LOCKS_EVERY_MS);
        });
        await waitFor(() => expect(rows().map((r) => r[0])).toEqual(['alloc']));
        expect(requests).toEqual(['GET /api/cluster/lock', 'GET /api/cluster/lock']);
    });

    test('a lease run out is gone at once, before the next read', async () => {
        locks = [lock('alloc', 'id-1', {expires_in: '2s'})];
        renderLocks();
        await waitFor(() => expect(rows()).toHaveLength(1));
        // Past its end, at the next tick of the countdown.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3100);
        });
        expect(within(table()).getByText('No lock is held.')).toBeInTheDocument();
    });

    test('released, confirmed first, warned the holder is not told, by its name and its id; said in the tray, read again', async () => {
        renderLocks();
        await waitFor(() => expect(rows()).toHaveLength(2));
        fireEvent.click(screen.getByRole('button', {name: 'Release alloc'}));
        const dialog = screen.getByRole('dialog', {name: 'Release the lock alloc?'});
        expect(dialog).toHaveTextContent('taken back from om pool claim alloc');
        expect(within(dialog).getByRole('alert')).toHaveTextContent('Its holder is not told');
        expect(dialog).toHaveTextContent('Released only while still held under id-1');
        expect(requests.filter((r) => r.startsWith('DELETE'))).toEqual([]);
        fireEvent.click(within(dialog).getByRole('button', {name: 'Release'}));
        await waitFor(() => expect(requests).toContain('DELETE /api/cluster/lock?name=alloc&id=id-1'));
        await waitFor(() => expect(rows().map((r) => r[0])).toEqual(['net-default']));
        expect(tray()).toEqual([['Release', 'the lock alloc', 'succeeded', null]]);
    });

    test('released meanwhile, or its lease ended: the refusal said in the tray', async () => {
        released = {status: 404, detail: 'lock alloc is not held under id-1: it was released, or its lease ended'};
        renderLocks();
        await waitFor(() => expect(rows()).toHaveLength(2));
        fireEvent.click(screen.getByRole('button', {name: 'Release alloc'}));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Release'}));
        await waitFor(() => expect(tray()).toEqual([[
            'Release', 'the lock alloc', 'refused', 'HTTP 404 lock alloc is not held under id-1: it was released, or its lease ended',
        ]]));
    });

    test('none held: said', async () => {
        locks = [];
        renderLocks();
        expect(await screen.findByText('No lock is held.')).toBeInTheDocument();
    });

    test('refused to a user not root: said, no table', async () => {
        global.fetch = vi.fn(async () => new Response(JSON.stringify({detail: 'forbidden'}), {status: 403}));
        renderLocks();
        expect(await screen.findByText('Reading the cluster locks takes the root role.')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
});
