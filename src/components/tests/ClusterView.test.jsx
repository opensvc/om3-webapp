import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import ClusterView from '../ClusterView';
import {useMenuState} from '../../hooks/useSidebarAlerts';
import {resetPgUsage} from '../../hooks/usePgUsage';

const clusterNodes = vi.hoisted(() => ({current: ['n1', 'n2', 'n3']}));
vi.mock('../../hooks/useClusterNodeOrder', () => ({useClusterNodeOrder: () => clusterNodes.current}));

const beating =(peers) => ({streams: [{id: 'hb#1.rx', type: 'unicast', state: 'running', peers}]});

/** A reading of the cgroups of a node, its opensvc slice told or not. */
const pgPage = (memory, usec, told = true) => [
    `opensvc_pg_cgroup_memory_current_bytes{namespace="ns1",path="ns1/svc/web",scope="object"} 100`,
    ...(told ? [
        `opensvc_pg_cgroup_exists{namespace="",path="",scope="opensvc"} 1`,
        `opensvc_pg_cgroup_cpu_usage_usec{namespace="",path="",scope="opensvc"} ${usec}`,
        `opensvc_pg_cgroup_memory_current_bytes{namespace="",path="",scope="opensvc"} ${memory}`,
    ] : []),
].join('\n');

describe('ClusterView', () => {
    let resourcesFail;
    let pgTold;

    beforeEach(() => {
        resourcesFail = false;
        pgTold = true;
        resetPgUsage();
        clusterNodes.current = ['n1', 'n2', 'n3'];
        useMenuState.setState({
            ready: true,
            objects: {
                'ns1/svc/web': {avail: 'up', overall: 'up'},
                'ns1/svc/db': {avail: 'down', overall: 'down'},
                'ns1/vol/data': {avail: 'warn'},
                'ns2/svc/api': {avail: 'n/a'},
                'svc1': {avail: 'up'},
                'cfg/shared': {},
                'cluster': {},
            },
            nodeStatus: {
                n1: {frozen_at: '2026-10-24T08:00:00Z'},
                n2: {frozen_at: '0001-01-01T00:00:00Z', is_overloaded: true},
            },
            heartbeatStatus: {
                n1: beating({n2: {is_beating: true}}),
                n2: beating({n1: {is_beating: false}}),
            },
            pools: [{name: 'default', size: 100, used: 30}, {name: 'tank', size: 100, used: 100}],
            networks: [{name: 'lo', size: 1, used: 0}, {name: 'backend', size: 256, used: 200}],
        });
        vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
            const u = String(url);
            const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
            if (u.startsWith('/api/store')) {
                return json({items: [
                    {ref: 'tar1', type: 'tar', url: '/srv', share: ['*'], stats: {runs: 6, last_created_at: '2026-10-20T10:00:00Z'}},
                    {ref: 'from test/sec/stores store#tar2', type: 'tar', url: 'sftp://x', share: ['test'], stats: {runs: 11, check_error: 'refused'}},
                ]});
            }
            if (u.startsWith('/api/resource')) {
                if (resourcesFail) return json({detail: 'boom'}, 500);
                return json({items: [{data: {status: {status: 'up'}}}, {data: {status: {status: 'up'}}}, {data: {status: {status: 'down'}}}, {data: {status: {status: 'warn'}}}, {data: {}}]});
            }
            const pg = u.match(/^\/api\/node\/name\/([^/]+)\/metrics\/pg$/);
            if (pg) {
                // n1 1 GiB, n2 2 GiB.
                const gib = pg[1] === 'n1' ? 1 : 2;
                return new Response(pgPage(gib * 1024 ** 3, 1000000, pgTold), {status: 200});
            }
            return json({}, 404);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const card = (id) => document.querySelector(`[data-card=${id}]`);

    test('a card a menu entry, each its name a link to its page, its count', async () => {
        render(<ClusterView/>, {wrapper: MemoryRouter});
        const cards = screen.getByRole('group', {name: 'Summary of the cluster'});
        expect([...cards.querySelectorAll('[data-card]')].map((c) => c.getAttribute('data-card')))
            .toEqual(['links', 'nodes', 'opensvc', 'arbitrators', 'objects', 'namespaces', 'networks', 'pools', 'stores', 'resources']);
        expect(within(card('pools')).getByRole('link', {name: 'Open Pools'})).toHaveAttribute('href', '/pools');
        expect(within(card('links')).getByRole('link', {name: 'Open Links'})).toHaveAttribute('href', '/heartbeats');
        expect(card('objects')).toHaveTextContent(/Objects\s*7/);
        // The whole card its link, what it holds clickable on its own above it.
        expect(within(card('nodes')).getByRole('link', {name: 'Open Nodes'})).toHaveClass('after:absolute', 'after:inset-0');
        expect(card('nodes')).toHaveClass('relative');
        expect(card('nodes').querySelector('[data-card-body]')).toHaveClass('[&_a]:relative', '[&_button]:relative');
    });

    test('what opensvc uses over the nodes reporting, then node by node; the cpu from a second reading', async () => {
        render(<ClusterView/>, {wrapper: MemoryRouter});
        await waitFor(() => expect(card('opensvc').querySelector('[data-opensvc-total]')).toBeInTheDocument());
        // n1 and n2 report, n3 not: the two of them read.
        expect(global.fetch).toHaveBeenCalledWith('/api/node/name/n1/metrics/pg', expect.anything());
        expect(global.fetch).not.toHaveBeenCalledWith('/api/node/name/n3/metrics/pg', expect.anything());
        await waitFor(() => expect(card('opensvc').querySelector('[data-opensvc-total]')).toHaveTextContent(/^CPU…Memory3(\.0)? GiB$/));
        expect(card('opensvc')).toHaveTextContent('over 2 of 2 nodes');
        const byNode = within(card('opensvc')).getByRole('list', {name: 'By node'});
        expect(byNode.querySelector('[data-node=n1]')).toHaveTextContent(/^n1…1(\.0)? GiB$/);
        // Its tree: the usage tab of the panel of the cluster.
        expect(within(card('opensvc')).getByRole('link', {name: 'Open OpenSVC usage'})).toHaveAttribute('href', '/?peek=object:cluster&peektab=usage');
    });

    test('the tasks and the io where told: in the card, the rates waiting for a second reading', async () => {
        const io = [
            'opensvc_pg_cgroup_exists{namespace="",path="",scope="opensvc"} 1',
            'opensvc_pg_cgroup_memory_current_bytes{namespace="",path="",scope="opensvc"} 1024',
            'opensvc_pg_cgroup_tasks{namespace="",path="",scope="opensvc"} 21',
            'opensvc_pg_cgroup_io_read_bytes{namespace="",path="",scope="opensvc"} 100',
        ].join('\n');
        const answer = global.fetch.getMockImplementation();
        global.fetch.mockImplementation(async (url) => (/\/metrics\/pg$/.test(String(url)) ? new Response(io, {status: 200}) : answer(url)));
        render(<ClusterView/>, {wrapper: MemoryRouter});
        await waitFor(() => expect(card('opensvc').querySelector('[data-figure=tasks]')).toHaveTextContent('Tasks42'));
        expect(card('opensvc').querySelector('[data-figure=read]')).toHaveTextContent('Read/s…');
        expect(card('opensvc').querySelector('[data-figure=write]')).toBeNull();
    });

    test('the hosts told: what opensvc uses of what they use, and of what they have', async () => {
        const host = [
            'opensvc_pg_cgroup_memory_current_bytes{namespace="",path="",scope="opensvc"} 1073741824',
            'opensvc_pg_cgroup_cpu_cpus{namespace="",path="",scope="host"} 4',
            'opensvc_pg_cgroup_memory_current_bytes{namespace="",path="",scope="host"} 4294967296',
            'opensvc_pg_cgroup_memory_max_bytes{namespace="",path="",scope="host"} 8589934592',
        ].join('\n');
        const answer = global.fetch.getMockImplementation();
        global.fetch.mockImplementation(async (url) => (/\/metrics\/pg$/.test(String(url)) ? new Response(host, {status: 200}) : answer(url)));
        render(<ClusterView/>, {wrapper: MemoryRouter});
        // Two nodes: 2 GiB of the 8 GiB they use, of 16 GiB.
        await waitFor(() => expect(card('opensvc').querySelector('[data-share=memory]')).toHaveTextContent('25 % of the 8 GiB the hosts use, of 16 GiB'));
        // The cpu from a second reading on.
        expect(card('opensvc').querySelector('[data-share=cpu]')).toBeNull();
    });

    test('the whole of the nodes not shown to the grants: said', async () => {
        pgTold = false;
        render(<ClusterView/>, {wrapper: MemoryRouter});
        await waitFor(() => expect(card('opensvc')).toHaveTextContent('The usage of the whole nodes is not shown to your grants.'));
    });

    test('the links, the ring of the heartbeats page; the nodes, a ring of the dropped, overloaded and optimal, the frozen said', async () => {
        render(<ClusterView/>, {wrapper: MemoryRouter});
        expect(card('links').querySelector('[data-overall]')).toHaveAttribute('data-overall', 'warn');
        expect(card('links')).toHaveTextContent('1/2');
        // n3 of the cluster configuration, not reporting: dropped.
        await waitFor(() => expect(card('nodes')).toHaveTextContent(/^Nodes3/));
        const ring = card('nodes').querySelector('[data-ring=nodes]');
        expect(ring).toHaveAttribute('data-state', 'warn');
        expect(ring).toHaveTextContent('1/3nodes optimaldegraded');
        expect([...ring.querySelectorAll('[data-arc]')].map((a) => a.getAttribute('data-arc'))).toEqual(['dropped', 'overloaded', 'optimal']);
        expect(ring.querySelector('[data-ring-legend]')).toHaveTextContent('dropped1overloaded1optimal1');
        expect(card('nodes')).toHaveTextContent('1 frozen');
        expect(card('nodes').querySelector('[data-node=n2]')).toHaveClass('text-state-warn');
        expect(card('nodes').querySelector('[data-node=n3]')).toHaveAttribute('data-state', 'dropped');
        expect(card('nodes').querySelector('[data-node=n3]')).toHaveClass('text-state-down');
        expect(within(card('nodes').querySelector('[data-node=n1]')).getByTitle(/frozen/i)).toBeInTheDocument();
    });

    test('the links, each heartbeat listed: red when none of its links beats, orange when some do not, plain when all do', () => {
        const streams = (beats) => Object.entries(beats).map(([hb, peers]) => ({id: `${hb}.rx`, type: 'unicast', state: 'running', peers}));
        useMenuState.setState({
            heartbeatStatus: {
                n1: {streams: streams({'hb#1': {n2: {is_beating: true}}, 'hb#2': {n2: {is_beating: false}}, 'hb#10': {n2: {is_beating: true}}})},
                n2: {streams: streams({'hb#1': {n1: {is_beating: false}}, 'hb#2': {n1: {is_beating: false}}, 'hb#10': {n1: {is_beating: true}}})},
            },
        });
        render(<ClusterView/>, {wrapper: MemoryRouter});
        const list = within(card('links')).getByRole('list', {name: 'Heartbeats'});
        const items = within(list).getAllByRole('listitem');
        expect(items.map((li) => [li.getAttribute('data-hb'), li.getAttribute('data-state')]))
            .toEqual([['hb#1', 'warn'], ['hb#2', 'down'], ['hb#10', 'up']]);
        expect(items[0]).toHaveClass('text-state-warn');
        expect(items[0]).toHaveTextContent(/^hb#1degraded$/);
        expect(items[0]).toHaveAttribute('title', '1 of 2 links beating');
        expect(items[1]).toHaveClass('text-state-down');
        expect(items[1]).toHaveTextContent(/^hb#2critical$/);
        expect(items[2]).not.toHaveClass('text-state-warn', 'text-state-down');
        expect(items[2]).toHaveTextContent(/^hb#10$/);
    });

    test('the arbitrators, a ring of the nodes reaching them, each named in the tint of how many do; a card of no page', () => {
        const arb = (status) => ({arb1: {url: 'https://arb1:1215', status, weight: 1}});
        useMenuState.setState((state) => ({
            nodeStatus: {
                n1: {...state.nodeStatus.n1, arbitrators: arb('up')},
                n2: {...state.nodeStatus.n2, arbitrators: arb('down')},
            },
        }));
        render(<ClusterView/>, {wrapper: MemoryRouter});
        expect(card('arbitrators')).toHaveTextContent(/^Arbitrators1/);
        expect(within(card('arbitrators')).queryByRole('link', {name: /Arbitrators/})).toBeNull();
        // n3 dropped: it reaches none.
        const ring = card('arbitrators').querySelector('[data-ring=arbitrators]');
        expect(ring).toHaveAttribute('data-state', 'warn');
        expect(ring).toHaveTextContent('1/3nodes reach itdegraded');
        expect(ring.querySelector('[data-ring-legend]')).toHaveTextContent(/^not reached2up1$/);
        const item = card('arbitrators').querySelector('[data-arbitrator=arb1]');
        expect(item).toHaveClass('text-state-warn');
        expect(item).toHaveAttribute('title', 'https://arb1:1215\n1 of 3 nodes reach it');
        expect(within(card('arbitrators')).queryByRole('alert')).toBeNull();
    });

    test.each([
        [['n1', 'n2'], true],
        [['n1', 'n2', 'n3'], false],
    ])('no arbitrator, the nodes %j: the risk of a tied quorum vote said when they are even', (names, risk) => {
        clusterNodes.current = names;
        render(<ClusterView/>, {wrapper: MemoryRouter});
        expect(card('arbitrators').querySelector('[data-ring]')).toBeNull();
        if (risk) {
            expect(within(card('arbitrators')).getByRole('alert')).toHaveTextContent('No arbitrator, and an even number of nodes (2)');
        } else {
            expect(within(card('arbitrators')).queryByRole('alert')).toBeNull();
            expect(card('arbitrators')).toHaveTextContent('No arbitrator.');
        }
    });

    test('the objects: a ring of the services and volumes by availability, no object named; the kinds counted', () => {
        render(<ClusterView/>, {wrapper: MemoryRouter});
        const ring = card('objects').querySelector('[data-ring=objects]');
        expect(ring).toHaveAttribute('data-state', 'warn');
        expect(ring).toHaveTextContent('2/5services and volumes updegraded');
        expect([...ring.querySelectorAll('[data-arc]')].map((a) => a.getAttribute('data-arc'))).toEqual(['down', 'warn', 'up', 'na']);
        expect(ring.querySelector('[data-ring-legend]')).toHaveTextContent('down1warn1up2n/a1');
        expect(within(card('objects')).queryByRole('link', {name: 'ns1/svc/db'})).toBeNull();
        expect(within(card('objects')).queryByRole('button', {name: 'ns1/svc/db'})).toBeNull();
        expect(card('objects')).toHaveTextContent(/cfg1/);
    });

    test('the namespaces, the busiest; the pools and networks, the fullest, the full ones counted', () => {
        render(<ClusterView/>, {wrapper: MemoryRouter});
        // ns1 its three, root its bare service and its configuration; the cluster object of none.
        const busiest = within(card('namespaces')).getByRole('list', {name: 'The busiest'});
        expect(busiest).toHaveTextContent(/^ns13 objectsroot2 objectsns21 object$/);
        expect(card('pools')).toHaveTextContent('1 full');
        const fullest = within(card('pools')).getByRole('list', {name: 'The fullest'});
        expect(within(fullest).getAllByRole('listitem').map((li) => li.textContent.slice(0, 7))).toEqual(['tank100', 'default']);
        expect(within(card('networks')).getByRole('list', {name: 'The fullest'})).toHaveTextContent(/^backend/);
    });

    test('the stores, their snapshots, the unreached said; the resources, a ring of those in warn and the others; a list unread said so', async () => {
        const {unmount} = render(<ClusterView/>, {wrapper: MemoryRouter});
        await waitFor(() => expect(card('stores')).toHaveTextContent('17 snapshots · 1 not reached'));
        expect(within(card('stores')).getByRole('button', {name: 'tar2'})).toBeInTheDocument();
        await waitFor(() => expect(card('resources').querySelector('[data-ring=resources]')).toHaveTextContent('1/5resources in warndegraded'));
        const ring = card('resources').querySelector('[data-ring=resources]');
        expect([...ring.querySelectorAll('[data-arc]')].map((a) => a.getAttribute('data-arc'))).toEqual(['warn', 'other']);
        expect(ring.querySelector('[data-ring-legend]')).toHaveTextContent(/^warn1other4$/);
        unmount();

        resourcesFail = true;
        render(<ClusterView/>, {wrapper: MemoryRouter});
        await waitFor(() => expect(card('resources')).toHaveTextContent('Could not read the resources'));
    });
});
