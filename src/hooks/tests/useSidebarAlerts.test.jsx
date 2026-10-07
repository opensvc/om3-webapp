import {renderHook, act} from '@testing-library/react';
import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import axios from 'axios';
import useSidebarAlerts, {
    objectsPill,
    alertPills,
    fullCount,
    frozenCount,
    applySidebarEvent,
    countPills,
    objectCounts,
    groupCounts,
    heartbeatCounts,
    nodesDetails,
    usageDetails,
    SIDEBAR_EVENTS_URL,
    SIDEBAR_FLUSH_MS,
    SIDEBAR_RECONNECT_MS,
    SIDEBAR_USAGE_REFRESH_MS,
} from '../useSidebarAlerts';
import {URL_NETWORK, URL_POOL} from '../../config/apiPath.js';

const {sources} = vi.hoisted(() => ({sources: []}));

vi.mock('axios');
vi.mock('event-source-polyfill', () => ({
    EventSourcePolyfill: vi.fn().mockImplementation(function (url, options) {
        this.url = url;
        this.options = options;
        this.listeners = {};
        this.closed = false;
        this.addEventListener = (type, listener) => {
            this.listeners[type] = listener;
        };
        this.close = () => {
            this.closed = true;
        };
        this.emit = (type, data) => this.listeners[type]?.({data: JSON.stringify(data)});
        sources.push(this);
    }),
}));
vi.mock('../../utils/logger.js', () => ({default: {warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn()}}));

describe('objectsPill', () => {
    test('is grey with no objects', () => {
        expect(objectsPill({})).toBe('unknown');
        expect(objectsPill(undefined)).toBe('unknown');
    });

    test('is grey when every object is n/a or has no availability', () => {
        expect(objectsPill({a: {avail: 'n/a'}, b: {}, c: undefined})).toBe('unknown');
    });

    test('is green when everything with a status is up', () => {
        expect(objectsPill({a: {avail: 'up'}, b: {avail: 'n/a'}, c: {}})).toBe('up');
    });

    test('is orange with a warn object', () => {
        expect(objectsPill({a: {avail: 'up'}, b: {avail: 'warn'}})).toBe('warn');
    });

    test('is red with a down object, whatever the others', () => {
        expect(objectsPill({a: {avail: 'warn'}, b: {avail: 'down'}, c: {avail: 'up'}})).toBe('down');
    });
});

describe('alert counts', () => {
    test('count the pools or networks used to their full size', () => {
        expect(fullCount([{size: 10, used: 3}, {size: 10, used: 10}, {size: 4, used: 5}])).toBe(2);
        expect(fullCount([{size: 10, used: 9}, {size: 0, used: 0}, {used: 4}])).toBe(0);
        expect(fullCount(undefined)).toBe(0);
    });

    test('count the frozen nodes', () => {
        expect(frozenCount({
            n1: {frozen_at: '0001-01-01T00:00:00Z'},
            n2: {frozen_at: '2026-10-05T10:00:00Z'},
            n3: {frozen_at: '2026-10-05T11:00:00Z'},
            n4: {},
        })).toBe(2);
        expect(frozenCount(undefined)).toBe(0);
    });

    test('make a single pill of a non-zero count, none of zero', () => {
        expect(alertPills('frozen', 2)).toEqual([{state: 'frozen', count: 2}]);
        expect(alertPills('down', 0)).toEqual([]);
    });
});

describe('applySidebarEvent', () => {
    test('applies object, node and heartbeat events, and object deletions', () => {
        const state = {objects: {}, nodeStatus: {}, heartbeatStatus: {}};
        applySidebarEvent(state, 'ObjectStatusUpdated', {path: 'a', object_status: {avail: 'up'}});
        applySidebarEvent(state, 'ObjectStatusUpdated', {labels: {path: 'b'}, object_status: {avail: 'down'}});
        applySidebarEvent(state, 'NodeStatusUpdated', {node: 'n1', node_status: {frozen_at: 'x'}});
        applySidebarEvent(state, 'DaemonHeartbeatUpdated', {labels: {node: 'n1'}, heartbeat: {streams: []}});
        applySidebarEvent(state, 'ObjectDeleted', {path: 'b'});
        applySidebarEvent(state, 'Unknown', {path: 'c'});
        expect(state).toEqual({
            objects: {a: {avail: 'up'}},
            nodeStatus: {n1: {frozen_at: 'x'}},
            heartbeatStatus: {n1: {streams: []}},
        });
    });
});

describe('count pills', () => {
    test('number the states with a non-zero count, in up, warn, down, n/a order', () => {
        expect(countPills({down: 2, up: 5, unknown: 1})).toEqual([
            {state: 'up', count: 5},
            {state: 'down', count: 2},
            {state: 'unknown', count: 1},
        ]);
    });

    test('show a single grey 0 when there is nothing to count', () => {
        expect(countPills({})).toEqual([{state: 'unknown', count: 0}]);
    });

    test('number the objects by availability, n/a and none as unknown', () => {
        expect(objectCounts({
            'ns1/svc/a': {avail: 'up'},
            'ns1/vol/b': {avail: 'warn'},
            'ns2/svc/c': {avail: 'down'},
            'cfg/d': {},
            e: {avail: 'n/a'},
        })).toEqual([
            {state: 'up', count: 1},
            {state: 'warn', count: 1},
            {state: 'down', count: 1},
            {state: 'unknown', count: 2},
        ]);
    });

    test('number the namespaces and the kinds by their worst object', () => {
        const objects = {
            'ns1/svc/a': {avail: 'up'},
            'ns1/svc/b': {avail: 'down'},
            'ns2/svc/c': {avail: 'warn'},
            'ns2/vol/d': {avail: 'up'},
            'ns3/cfg/e': {},
            f: {avail: 'up'},
        };
        expect(groupCounts(objects, ({namespace}) => namespace)).toEqual([
            {state: 'up', count: 1},
            {state: 'warn', count: 1},
            {state: 'down', count: 1},
            {state: 'unknown', count: 1},
        ]);
        expect(groupCounts(objects, ({kind}) => kind)).toEqual([
            {state: 'up', count: 1},
            {state: 'down', count: 1},
            {state: 'unknown', count: 1},
        ]);
    });

    test('number the heartbeat streams, down when stopped or with a stale peer', () => {
        expect(heartbeatCounts({
            n1: {streams: [
                {state: 'running', peers: {n2: {is_beating: true}}},
                {state: 'running', peers: {n2: {is_beating: true}, n3: {is_beating: false}}},
                {state: 'stopped', peers: {}},
            ]},
            n2: {},
        })).toEqual([{state: 'up', count: 1}, {state: 'down', count: 2}]);
    });
});

describe('mouseover details', () => {
    test('count the nodes and the frozen ones', () => {
        expect(nodesDetails({
            n1: {frozen_at: '0001-01-01T00:00:00Z'},
            n2: {frozen_at: '2026-10-05T10:00:00Z'},
        })).toEqual(['2 nodes', 'frozen: 1']);
        expect(nodesDetails({n1: {}})).toEqual(['1 node', 'frozen: 0']);
    });

    test('count the pools or networks, the full ones, and show the highest usage', () => {
        expect(usageDetails([
            {name: 'a', size: 10, used: 5},
            {name: 'b', size: 4, used: 4},
            {name: 'c'},
        ], 'pool')).toEqual(['3 pools', 'full: 1', 'highest usage: b 100%']);
        expect(usageDetails([], 'network')).toEqual(['0 networks', 'full: 0']);
    });
});

describe('useSidebarAlerts', () => {
    const flush = async () => {
        await act(async () => {
            vi.advanceTimersByTime(SIDEBAR_FLUSH_MS);
        });
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        sources.length = 0;
        localStorage.clear();
        localStorage.setItem('authToken', 'tok');
        axios.get.mockImplementation((url) => Promise.resolve({
            data: {items: url === URL_POOL ? [{size: 10, used: 10}] : [{size: 10, used: 1}]},
        }));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('opens its own event stream, with the cache, and the token', () => {
        renderHook(() => useSidebarAlerts());
        expect(sources).toHaveLength(1);
        expect(sources[0].url).toBe(SIDEBAR_EVENTS_URL);
        expect(sources[0].url).toContain('cache=true');
        for (const filter of ['ObjectStatusUpdated', 'ObjectDeleted', 'NodeStatusUpdated', 'DaemonHeartbeatUpdated']) {
            expect(sources[0].url).toContain(`filter=${filter}`);
        }
        expect(sources[0].options.headers.Authorization).toBe('Bearer tok');
    });

    test('updates the pills from the events, without any user action', async () => {
        const {result} = renderHook(() => useSidebarAlerts());
        expect(result.current['/objects'].counts).toEqual([{state: 'unknown', count: 0}]);

        act(() => {
            sources[0].emit('ObjectStatusUpdated', {path: 'a', object_status: {avail: 'up'}});
            sources[0].emit('NodeStatusUpdated', {node: 'n1', node_status: {frozen_at: '2026-10-05T10:00:00Z'}});
            sources[0].emit('DaemonHeartbeatUpdated', {
                node: 'n1', heartbeat: {streams: [{state: 'running', peers: {n2: {is_beating: false}}}]},
            });
        });
        await flush();
        expect(result.current['/objects'].counts).toEqual([{state: 'up', count: 1}]);
        expect(result.current['/namespaces'].counts).toEqual([{state: 'up', count: 1}]);
        expect(result.current['/kinds'].counts).toEqual([{state: 'up', count: 1}]);
        expect(result.current['/nodes'].details).toEqual(['1 node', 'frozen: 1']);
        expect(result.current['/nodes'].counts).toEqual([{state: 'frozen', count: 1}]);
        expect(result.current['/heartbeats'].counts).toEqual([{state: 'down', count: 1}]);

        act(() => {
            sources[0].emit('ObjectStatusUpdated', {path: 'b', object_status: {avail: 'down'}});
        });
        await flush();
        expect(result.current['/objects'].counts).toEqual([{state: 'up', count: 1}, {state: 'down', count: 1}]);

        act(() => {
            sources[0].emit('ObjectDeleted', {path: 'b'});
        });
        await flush();
        expect(result.current['/objects'].counts).toEqual([{state: 'up', count: 1}]);
    });

    test('ignores an event whose data is not JSON', async () => {
        const {result} = renderHook(() => useSidebarAlerts());
        act(() => {
            sources[0].listeners.ObjectStatusUpdated({data: 'not json'});
        });
        await flush();
        expect(result.current['/objects'].counts).toEqual([{state: 'unknown', count: 0}]);
    });

    test('reconnects after an error with the current token, and replaces the state', async () => {
        const {result} = renderHook(() => useSidebarAlerts());
        act(() => {
            sources[0].emit('ObjectStatusUpdated', {path: 'a', object_status: {avail: 'down'}});
        });
        await flush();
        expect(result.current['/objects'].counts).toEqual([{state: 'down', count: 1}]);

        localStorage.setItem('authToken', 'tok2');
        act(() => {
            sources[0].onerror({status: 401});
        });
        expect(sources[0].closed).toBe(true);
        // The last known pills stay until the new stream replays the state.
        expect(result.current['/objects'].counts).toEqual([{state: 'down', count: 1}]);

        await act(async () => {
            vi.advanceTimersByTime(SIDEBAR_RECONNECT_MS);
        });
        expect(sources).toHaveLength(2);
        expect(sources[1].options.headers.Authorization).toBe('Bearer tok2');

        act(() => {
            sources[1].emit('ObjectStatusUpdated', {path: 'c', object_status: {avail: 'up'}});
        });
        await flush();
        expect(result.current['/objects'].counts).toEqual([{state: 'up', count: 1}]);
    });

    test('waits for a token before opening the stream', async () => {
        localStorage.clear();
        renderHook(() => useSidebarAlerts());
        expect(sources).toHaveLength(0);
        localStorage.setItem('authToken', 'tok');
        await act(async () => {
            vi.advanceTimersByTime(SIDEBAR_RECONNECT_MS);
        });
        expect(sources).toHaveLength(1);
    });

    test('closes the stream on unmount', () => {
        const {unmount} = renderHook(() => useSidebarAlerts());
        unmount();
        expect(sources[0].closed).toBe(true);
    });

    test('polls pools and networks', async () => {
        const {result} = renderHook(() => useSidebarAlerts());
        await act(async () => {
            await Promise.resolve();
        });
        expect(result.current['/pools'].counts).toEqual([{state: 'down', count: 1}]);
        expect(result.current['/network'].counts).toEqual([]);
        expect(axios.get).toHaveBeenCalledWith(URL_POOL, {headers: {Authorization: 'Bearer tok'}});
        expect(axios.get).toHaveBeenCalledWith(URL_NETWORK, {headers: {Authorization: 'Bearer tok'}});
        expect(axios.get).toHaveBeenCalledTimes(2);

        axios.get.mockImplementation(() => Promise.resolve({data: {items: []}}));
        await act(async () => {
            vi.advanceTimersByTime(SIDEBAR_USAGE_REFRESH_MS);
        });
        expect(axios.get).toHaveBeenCalledTimes(4);
        expect(result.current['/pools'].counts).toEqual([]);
    });

    test('keeps the last lists when a poll fails', async () => {
        const {result} = renderHook(() => useSidebarAlerts());
        await act(async () => {
            await Promise.resolve();
        });
        expect(result.current['/pools'].counts).toEqual([{state: 'down', count: 1}]);
        axios.get.mockRejectedValue(new Error('down'));
        await act(async () => {
            vi.advanceTimersByTime(SIDEBAR_USAGE_REFRESH_MS);
        });
        expect(result.current['/pools'].counts).toEqual([{state: 'down', count: 1}]);
    });
});
