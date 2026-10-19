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
            // Under the line of the drivers.
            'diskhb#23/4storage',
            'unicasthb#14/4network',
        ]);
        // A grey line at the head of each group, the heartbeats first.
        expect([...box.querySelectorAll('[data-separator]')].map((line) => line.textContent)).toEqual(['Heartbeats', 'Drivers']);
        expect(box.querySelector('ul').firstElementChild).toHaveAttribute('data-separator', 'heartbeats');
        // What a row does, under the card.
        expect(box.querySelector('[data-hint]')).toHaveTextContent('Select a heartbeat or a driver to filter the streams.');
        const row = box.querySelector('[data-row="hb#2"]');
        expect(row.querySelector('.tabular-nums')).toHaveClass('text-state-warn');
        // The cells of a row on one line, centered, on the columns of the card; the card on the ground of the tables.
        expect(row.querySelector('button')).toHaveClass('grid-cols-subgrid', 'items-center');
        expect(box.querySelector('ul').parentElement).toHaveClass('bg-surface-raised');
    });

    test('each driver: its heartbeats, their links beating out of all, its layer', () => {
        render(<HeartbeatSummary heartbeatStatus={{
            n1: {streams: [stream('hb#1.tx', 'unicast', {n2: true}), stream('hb#11.tx', 'unicast', {n2: false}), stream('hb#2.tx', 'disk', {n2: true})]},
        }}/>);
        const box = screen.getByRole('region', {name: 'Summary'});
        const separator = box.querySelector('[data-separator="drivers"]');
        const drivers = [];
        for (let row = separator.nextElementSibling; row; row = row.nextElementSibling) drivers.push(row.textContent);
        expect(drivers).toEqual([
            'diskhb#21/1storage',
            'unicasthb#1, hb#111/2network',
        ]);
    });

    test('no heartbeat, nothing', () => {
        const {container} = render(<HeartbeatSummary heartbeatStatus={{}}/>);
        expect(container).toBeEmptyDOMElement();
    });
});
