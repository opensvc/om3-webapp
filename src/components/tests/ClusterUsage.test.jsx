import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import {MemoryRouter} from 'react-router-dom';
import {vi, describe, test, expect, beforeEach} from 'vitest';
import {ClusterUsage} from '../ClusterUsage';

const readings = vi.hoisted(() => ({current: null}));
vi.mock('../../hooks/usePgUsage', () => ({
    useClusterNodes: () => ['n1', 'n2'],
    usePgReadings: () => readings.current,
}));

const GIB = 1024 ** 3;
const TOLD = {
    usage: {
        n1: {'dev/svc/a': {cpu: 0.1, memory: GIB}, web: {cpu: 0.05, memory: GIB / 4}},
        n2: {'dev/svc/a': {cpu: 0.2, memory: GIB}},
    },
    totals: {n1: {cpu: 1, memory: 4 * GIB}, n2: {cpu: 2, memory: 4 * GIB}},
    namespaces: {n1: {dev: {cpu: 0.1, memory: GIB}}, n2: {dev: {cpu: 0.2, memory: GIB}}},
    errors: {},
};

const view = () => render(<MemoryRouter><ClusterUsage/></MemoryRouter>);
const table = () => screen.getByRole('table', {name: 'The cgroups of opensvc'});
/** The lines of the tree: the group, its cpu, its memory. */
const lines = () => within(table()).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => c.textContent));

describe('ClusterUsage', () => {
    beforeEach(() => {
        readings.current = TOLD;
    });

    test('the opensvc slice, its namespaces and their objects, the root\'s objects, the rest; over all the nodes, the most cpu first', () => {
        view();
        expect(lines()).toEqual([
            ['opensvc.slice', '3 cpu', '8 GiB'],
            ['devopensvc-ns.dev.slice', '300 mcpu', '2 GiB'],
            ['dev/svc/a', '300 mcpu', '2 GiB'],
            ['web', '50 mcpu', '256 MiB'],
            ['opensvc-server.service and the rest', '2.65 cpu', '5.8 GiB'],
        ]);
        expect(within(table()).getByRole('button', {name: 'dev/svc/a'})).toBeInTheDocument();
    });

    test('a node alone; another order; a namespace folded', () => {
        view();
        fireEvent.change(screen.getByRole('combobox', {name: 'Node'}), {target: {value: 'n2'}});
        expect(lines()[0]).toEqual(['opensvc.slice', '2 cpu', '4 GiB']);
        expect(lines().map((l) => l[0])).not.toContain('web');
        fireEvent.change(screen.getByRole('combobox', {name: 'Node'}), {target: {value: ''}});
        fireEvent.click(screen.getByRole('button', {name: 'Name'}));
        expect(screen.getByRole('button', {name: 'Name'})).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', {name: 'Fold or unfold dev'}));
        expect(lines().map((l) => l[0])).toEqual(['opensvc.slice', 'devopensvc-ns.dev.slice', 'web', 'opensvc-server.service and the rest']);
    });

    test('no tasks nor io told: no column for them', () => {
        view();
        const headers = within(table()).getAllByRole('columnheader').map((h) => h.textContent);
        expect(headers).toEqual(['Control group', 'CPU', 'Memory']);
    });

    test('the tasks and the io told: their columns, the rates waiting for a second reading', () => {
        readings.current = {
            ...TOLD,
            totals: {n1: {cpu: 1, memory: 4 * GIB, tasks: 40, read: 2048, write: null}, n2: {cpu: 2, memory: 4 * GIB, tasks: 10, read: 1024, write: null}},
        };
        view();
        expect(within(table()).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Control group', 'CPU', 'Memory', 'Tasks', 'Read/s', 'Write/s']);
        expect(lines()[0]).toEqual(['opensvc.slice', '3 cpu', '8 GiB', '50', '3 KiB/s', '…']);
        // An object telling none: a dash.
        expect(lines()[2].slice(3)).toEqual(['-', '-', '-']);
    });

    test('the whole of the nodes not shown to the grants: said', () => {
        readings.current = {...TOLD, totals: {}};
        view();
        expect(screen.getByText('The usage of the whole nodes is not shown to your grants.')).toBeInTheDocument();
    });
});
