import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {vi} from 'vitest';
import {HeartbeatRelays, RELAY_POLL_MS} from '../HeartbeatRelays';
import {resetClusterStatus} from '../../hooks/clusterStatusOnce';

const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const ago = (s) => new Date(Date.now() - s * 1000).toISOString();

const CONFIG = {items: [
    {keyword: 'hb#1.type', evaluated: 'unicast'},
    {keyword: 'hb#relay.type', evaluated: 'relay'},
    {keyword: 'hb#relay.relay', evaluated: 'relay3.opensvc.com:3333'},
    {keyword: 'hb#relay.timeout', evaluated: 15e9},
]};

describe('HeartbeatRelays', () => {
    let answers;

    beforeEach(() => {
        resetClusterStatus();
        localStorage.setItem('authToken', 'tok');
        answers = {
            config: () => json(CONFIG),
            remote: () => json({kind: 'RelayStatusList', items: [
                {relay: 'relay3', cluster_id: 'c1', cluster_name: 'dev3', nodename: 'dev3n1', node_addr: '10.11.8.130:50160', msg_len: 1116, updated_at: ago(3), username: 'dev3', status: ''},
                {relay: 'relay3', cluster_id: 'c1', cluster_name: 'dev3', nodename: 'dev3n2', node_addr: '10.11.8.130:51556', msg_len: 1116, updated_at: ago(60), username: 'dev3', status: ''},
            ]}),
            served: () => json({kind: 'RelayStatusList', items: []}),
        };
        global.fetch = vi.fn(async (url) => {
            const u = String(url);
            if (u === '/api/cluster/status') return json({cluster: {config: {id: 'c1', name: 'dev3', nodes: ['dev3n1', 'dev3n2', 'dev3n3']}}});
            if (u.startsWith('/api/cluster/config?')) return answers.config();
            if (u.startsWith('/api/relay/status?')) return answers.remote(u);
            if (u === '/api/relay/status') return answers.served();
            return json({detail: 'not found'}, 404);
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    const slots = () => within(screen.getByRole('table', {name: 'The nodes writing to relay3.opensvc.com:3333'}))
        .getAllByRole('row').slice(1).map((row) => [row.cells[0].textContent, row.getAttribute('data-state'), row.cells[2].textContent]);

    test('each relay heartbeat, its relay asked with the timeout of the heartbeat; each node writing, stale or never', async () => {
        render(<HeartbeatRelays/>);
        await waitFor(() => expect(slots()).toEqual([
            ['dev3n1', 'up', '10.11.8.130:50160'],
            ['dev3n2', 'stale', '10.11.8.130:51556'],
            ['dev3n3', 'missing', ''],
        ]));
        const box = screen.getByRole('region', {name: 'Relays'});
        expect(box.querySelector('[data-relay="hb#relay"]')).toHaveTextContent('relay3.opensvc.com:3333a node does not writehb#relay · timeout 15s');
        // The heartbeats of type relay read by pattern, evaluated; the relay asked by its address, through the api node.
        const urls = global.fetch.mock.calls.map(([u]) => decodeURIComponent(String(u)));
        expect(urls).toContain('/api/cluster/config?evaluate=true&kw=hb#*.type&kw=hb#*.relay&kw=hb#*.timeout');
        expect(urls).toContain('/api/relay/status?remote=true&relay=relay3.opensvc.com:3333');
        expect(within(box).queryByText('This node relays for')).not.toBeInTheDocument();
    });

    test('a relay not reached said with why, no table', async () => {
        answers.remote = () => json({kind: 'RelayStatusList', items: [
            {relay: 'relay3.opensvc.com:3333', cluster_id: 'c1', cluster_name: 'dev3', username: 'dev3', status: '401 Unauthorized'},
        ]});
        render(<HeartbeatRelays/>);
        expect(await screen.findByText('The relay could not be asked: 401 Unauthorized')).toBeInTheDocument();
        expect(screen.getByRole('region', {name: 'Relays'})).toHaveTextContent('not relaying');
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    test('the node answering a relay itself: the slots it holds, of every cluster', async () => {
        answers.config = () => json({items: [{keyword: 'hb#1.type', evaluated: 'unicast'}]});
        answers.served = () => json({kind: 'RelayStatusList', items: [
            {relay: 'dev3n1', cluster_id: 'c9', cluster_name: 'prod', nodename: 'p1', node_addr: '10.0.0.9:4000', msg_len: 900, updated_at: ago(2), username: 'prod', status: ''},
        ]});
        render(<HeartbeatRelays/>);
        const served = await screen.findByRole('table', {name: 'This node relays for'});
        expect(within(served).getAllByRole('row')[1]).toHaveTextContent('prodp110.0.0.9:4000');
    });

    test('no relay heartbeat and relaying for none: nothing', async () => {
        answers.config = () => json({items: [{keyword: 'hb#1.type', evaluated: 'unicast'}]});
        const {container} = render(<HeartbeatRelays/>);
        await waitFor(() => expect(global.fetch.mock.calls.some(([u]) => u === '/api/relay/status')).toBe(true));
        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });

    test.each([
        ['the configuration, root or join', 'config'],
        ['the relays, heartbeat or root', 'remote'],
    ])('a user the daemon refuses %s: nothing said, never asked again', async (_, which) => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        try {
            answers[which] = () => json({title: 'Forbidden', detail: 'need one of [root join] grant', status: 403}, 403);
            const {container} = render(<HeartbeatRelays/>);
            const reads = () => global.fetch.mock.calls.filter(([u]) => String(u).startsWith('/api/relay/status') || String(u).startsWith('/api/cluster/config')).length;
            await waitFor(() => expect(reads()).toBeGreaterThan(0));
            const asked = reads();
            await act(async () => {
                await vi.advanceTimersByTimeAsync(3 * RELAY_POLL_MS);
            });
            expect(container).toBeEmptyDOMElement();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            expect(reads()).toBe(asked);
        } finally {
            vi.useRealTimers();
        }
    });

    test('a relay refusing the cluster its credentials still said: the relay answered, not the user refused', async () => {
        answers.remote = () => json({kind: 'RelayStatusList', items: [
            {relay: 'relay3.opensvc.com:3333', cluster_id: 'c1', username: 'dev3', status: '403 Forbidden'},
        ]});
        render(<HeartbeatRelays/>);
        expect(await screen.findByText('The relay could not be asked: 403 Forbidden')).toBeInTheDocument();
    });

    test('the configuration not read said; refreshed on demand', async () => {
        answers.config = () => json({detail: 'boom'}, 500);
        render(<HeartbeatRelays/>);
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not read the relays');
        answers.config = () => json(CONFIG);
        fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
        await waitFor(() => expect(slots()).toHaveLength(3));
    });
});
