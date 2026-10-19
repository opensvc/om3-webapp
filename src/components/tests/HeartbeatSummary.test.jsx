import React from 'react';
import {render, screen} from '@testing-library/react';
import '../../i18n';
import {HeartbeatSummary} from '../HeartbeatSummary';

/** A stream of a node toward its peers, each beating or not. */
const stream = (id, type, peers) => ({
    id, type, state: 'running',
    peers: Object.fromEntries(Object.entries(peers).map(([peer, up]) => [peer, {is_beating: up}])),
});

describe('HeartbeatSummary', () => {
    test('each heartbeat: its driver, its links beating out of all, its layer', () => {
        render(<HeartbeatSummary heartbeatStatus={{
            n1: {streams: [stream('hb#1.tx', 'unicast', {n2: true}), stream('hb#1.rx', 'unicast', {n2: true}), stream('hb#2.tx', 'disk', {n2: true}), stream('hb#2.rx', 'disk', {n2: false})]},
            n2: {streams: [stream('hb#1.tx', 'unicast', {n1: true}), stream('hb#1.rx', 'unicast', {n1: true}), stream('hb#2.tx', 'disk', {n1: true}), stream('hb#2.rx', 'disk', {n1: true})]},
        }}/>);
        const box = screen.getByRole('region', {name: 'Summary'});
        expect([...box.querySelectorAll('[data-row]')].map((row) => row.textContent)).toEqual([
            'hb#1unicast4/4network',
            'hb#2disk3/4storage',
            // Under the line of the nodes, each sending, then receiving.
            'n1↑ tx2/2hb#1, hb#2',
            'n1↓ rx1/2hb#1, hb#2',
            'n2↑ tx2/2hb#1, hb#2',
            'n2↓ rx2/2hb#1, hb#2',
        ]);
        // A grey line at the head of each group, the heartbeats first, held while the rows scroll.
        expect([...box.querySelectorAll('[data-separator]')].map((line) => line.textContent)).toEqual(['Heartbeats', 'Nodes']);
        expect(box.querySelector('ul').firstElementChild).toHaveAttribute('data-separator', 'heartbeats');
        expect(box.querySelector('[data-separator]')).toHaveClass('sticky', 'top-0');
        // What a row does, under the card.
        expect(box.querySelector('[data-hint]')).toHaveTextContent(/^Select a heartbeat, a side of a node, or both/);
        const row = box.querySelector('[data-row="hb#2"]');
        expect(row.querySelector('.tabular-nums')).toHaveClass('text-state-warn');
        // The cells of a row on one line, centered, on the columns of the card; the card on the ground of the tables.
        expect(row.querySelector('button')).toHaveClass('grid-cols-subgrid', 'items-center');
        expect(box.querySelector('ul').parentElement).toHaveClass('bg-surface-raised');
    });

    test('a bar a row, as wide for all: a segment a link, beating, failing, stopped in that order', () => {
        const stopped = {...stream('hb#2.tx', 'disk', {n2: false, n3: false}), state: 'stopped'};
        render(<HeartbeatSummary heartbeatStatus={{
            n1: {streams: [stream('hb#1.tx', 'unicast', {n2: false, n3: true}), stopped]},
        }}/>);
        const box = screen.getByRole('region', {name: 'Summary'});
        const bar = box.querySelector('[data-row="tx:n1"] [data-bar]');
        expect([...bar.children].map((part) => part.dataset.part)).toEqual(['up', 'down', 'stopped', 'stopped']);
        const bars = [...box.querySelectorAll('[data-bar]')];
        expect(bars.length).toBe(3);
        bars.forEach((one) => expect(one).toHaveClass('w-28'));
    });

    test('more links than segments: the parts of the bar in proportion', () => {
        const peers = Object.fromEntries(Array.from({length: 30}, (_, i) => [`p${i}`, i < 20]));
        render(<HeartbeatSummary heartbeatStatus={{n1: {streams: [stream('hb#1.rx', 'unicast', peers)]}}}/>);
        const bar = screen.getByRole('region', {name: 'Summary'}).querySelector('[data-row="hb#1"] [data-bar]');
        expect([...bar.children].map((part) => [part.dataset.part, part.style.flexGrow])).toEqual([['up', '20'], ['down', '10']]);
    });

    test('no heartbeat, nothing', () => {
        const {container} = render(<HeartbeatSummary heartbeatStatus={{}}/>);
        expect(container).toBeEmptyDOMElement();
    });
});
