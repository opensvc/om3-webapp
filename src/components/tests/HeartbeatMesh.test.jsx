import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {HeartbeatMesh} from '../HeartbeatMesh';

const STATUS = {
    dev3n1: {streams: [
        {id: 'hb#1.tx', type: 'unicast', state: 'running', peers: {dev3n2: {is_beating: true, desc: '→ dev3n2:10011', last_beating_at: '2026-10-16T10:00:00Z'}}},
        {id: 'hb#1.rx', type: 'unicast', state: 'running', peers: {dev3n2: {is_beating: true, desc: ':10011 ← dev3n2'}}},
    ]},
    dev3n2: {streams: [
        {id: 'hb#1.rx', type: 'unicast', state: 'running', peers: {dev3n1: {is_beating: false, desc: ':10011 ← dev3n1'}}},
        {id: 'hb#1.tx', type: 'unicast', state: 'running', peers: {dev3n1: {is_beating: true}}},
    ]},
};

const lines = (container) => [...container.querySelectorAll('[data-group]')];

describe('HeartbeatMesh', () => {
    test('a line each way between two nodes, no fan-out, no text: the color of its links', () => {
        const {container} = render(<HeartbeatMesh heartbeatStatus={STATUS}/>);
        expect(screen.getByText('Mesh')).toBeInTheDocument();
        expect([...container.querySelectorAll('[data-node]')].map((n) => n.dataset.node)).toEqual(['dev3n1', 'dev3n2']);
        expect(lines(container).map((g) => [g.dataset.group, g.dataset.state, g.textContent])).toEqual([
            // One end beating, the other not: a mix, orange.
            ['dev3n1 dev3n2', 'warn', ''],
            // Both ends beating: green.
            ['dev3n2 dev3n1', 'up', ''],
        ]);
        expect(lines(container)[0].querySelector('path')).toHaveClass('stroke-state-warn');
        expect(lines(container)[1].querySelector('path')).toHaveClass('stroke-state-up');
        expect(lines(container)[0]).toHaveAccessibleName('dev3n1 to dev3n2: 1 of 2 links beating');
    });

    test('a line hovered or focused lists its links in a card, each with all of its data', () => {
        const {container} = render(<HeartbeatMesh heartbeatStatus={STATUS}/>);
        const [forward, backward] = lines(container);
        fireEvent.mouseEnter(forward);
        const card = screen.getByRole('tooltip');
        expect(card).toHaveTextContent('dev3n1 → dev3n2');
        expect(card).toHaveTextContent('1 of 2 beating');
        const rows = within(card).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
        expect(rows).toEqual([
            ['hb#1', 'tx · dev3n1', 'unicast', '→ dev3n2:10011', 'Beating', expect.stringMatching(/ago|in /)],
            ['hb#1', 'rx · dev3n2', 'unicast', ':10011 ← dev3n1', 'Stale', '–'],
        ]);
        fireEvent.mouseLeave(forward);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        fireEvent.focus(backward);
        expect(screen.getByRole('tooltip')).toHaveTextContent('dev3n2 → dev3n1');
    });

    test('the card is out of the scrolling box of the mesh, placed against the window: nothing cuts it', () => {
        const {container} = render(<HeartbeatMesh heartbeatStatus={STATUS}/>);
        fireEvent.mouseEnter(lines(container)[0]);
        const card = screen.getByRole('tooltip');
        expect(container).not.toContainElement(card);
        expect(card.parentElement).toBe(document.body);
        expect(card).toHaveClass('fixed');
    });

    test('a line none of whose links beat is red', () => {
        const status = {
            a: {streams: [{id: 'hb#1.tx', type: 'unicast', state: 'stopped', peers: {b: {is_beating: true}}}]},
            b: {streams: [{id: 'hb#1.rx', type: 'unicast', state: 'running', peers: {a: {is_beating: false}}}]},
        };
        const {container} = render(<HeartbeatMesh heartbeatStatus={status}/>);
        expect(lines(container).map((g) => g.dataset.state)).toEqual(['down']);
    });

    test('no heartbeat reported: no mesh', () => {
        const {container} = render(<HeartbeatMesh heartbeatStatus={{}}/>);
        expect(container).toBeEmptyDOMElement();
    });
});
