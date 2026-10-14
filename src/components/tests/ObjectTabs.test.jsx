import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {vi} from 'vitest';
import {ObjectResources, ObjectSchedules} from '../ObjectTabs';

const NEVER = '0001-01-01T00:00:00Z';

const schedule = (node, action, extra = {}) => ({
    kind: 'ScheduleItem',
    meta: {node, object: 'ns1/svc/web'},
    data: {
        action,
        key: `${action}_schedule`,
        schedule: '@60',
        max_parallel: 1,
        last_run_at: NEVER,
        next_run_at: NEVER,
        require: '',
        require_collector: false,
        require_provisioned: false,
        ...extra,
    },
});

const info = (node, rid, key, value) => ({node, object: 'ns1/svc/web', rid, key, value});

/** The daemon answers `body` to any read, and the address read is kept. */
let read;
const answer = (body, {ok = true, status = 200} = {}) => {
    read = [];
    global.fetch = vi.fn((url, options) => {
        read.push({url, options});
        return Promise.resolve({
            ok,
            status,
            json: () => Promise.resolve(body),
            text: () => Promise.resolve(JSON.stringify(body)),
            headers: {get: () => 'application/json'},
        });
    });
};

describe('ObjectTabs', () => {
    beforeEach(() => {
        localStorage.setItem('authToken', 'tok');
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('schedules', () => {
        test('reads the schedules of all the instances, by task then by node', async () => {
            answer({
                kind: 'ScheduleList',
                items: [
                    schedule('n2', 'status'),
                    schedule('n1', 'sync_all', {schedule: '', require_provisioned: true}),
                    schedule('n1', 'status'),
                ],
            });
            render(<ObjectSchedules path="ns1/svc/web"/>);
            const table = await screen.findByRole('table', {name: 'Schedules'});
            expect(read[0].url).toBe('/api/object/path/ns1/svc/web/schedule');
            expect(read[0].options.headers).toEqual({Authorization: 'Bearer tok'});
            const rows = within(table).getAllByRole('row').slice(1);
            expect(rows.map((r) => within(r).getAllByRole('cell').slice(0, 2).map((c) => c.textContent)))
                .toEqual([['status', 'n1'], ['status', 'n2'], ['sync_all', 'n1']]);
            expect(rows[2]).toHaveTextContent('not scheduled');
            expect(rows[2]).toHaveTextContent('provisioned');
        });

        test('a root service is read by its full path', async () => {
            answer({kind: 'ScheduleList', items: []});
            render(<ObjectSchedules path="web"/>);
            expect(await screen.findByText('No task scheduled')).toBeInTheDocument();
            expect(read[0].url).toBe('/api/object/path/root/svc/web/schedule');
        });

        test('a long list is filtered', async () => {
            answer({
                kind: 'ScheduleList',
                items: Array.from({length: 10}, (_, i) => schedule('n1', `task${i}`)),
            });
            render(<ObjectSchedules path="ns1/svc/web"/>);
            const table = await screen.findByRole('table', {name: 'Schedules'});
            fireEvent.change(screen.getByRole('searchbox', {name: 'Filter the schedules'}), {target: {value: 'task7'}});
            expect(within(table).getAllByRole('row')).toHaveLength(2);
        });

        test('says why the schedules could not be read', async () => {
            answer({detail: 'forbidden'}, {ok: false, status: 403});
            render(<ObjectSchedules path="ns1/svc/web"/>);
            expect(await screen.findByText(/Could not read it/)).toBeInTheDocument();
        });
    });

    describe('resources', () => {
        const items = [
            info('n2', 'ip#0', 'ipaddr', '10.0.0.12'),
            info('n1', 'ip#0', 'ipaddr', '10.0.0.11'),
            info('n1', 'container#0', 'id', 'abc123'),
            info('n1', 'ip#0', 'netmask', '24'),
        ];

        test('a table per resource, a line per key, a column per node', async () => {
            answer({kind: 'ResourceInfoList', items});
            render(<ObjectResources path="ns1/svc/web"/>);
            const ip = await screen.findByRole('table', {name: 'ip#0'});
            expect(read[0].url).toBe('/api/object/path/ns1/svc/web/resource/info');
            expect(within(ip).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Key', 'n1', 'n2']);
            expect(within(ip).getByRole('row', {name: /ipaddr/})).toHaveTextContent('ipaddr10.0.0.1110.0.0.12');
            // A key a node does not report is marked missing there.
            expect(within(ip).getByRole('row', {name: /netmask/})).toHaveTextContent('netmask24–');
            // The resources in order.
            expect(screen.getAllByRole('table').map((t) => t.getAttribute('aria-label'))).toEqual(['container#0', 'ip#0']);
        });

        test('the filter keeps a resource by its name, or the keys and values that match', async () => {
            answer({kind: 'ResourceInfoList', items});
            render(<ObjectResources path="ns1/svc/web"/>);
            await screen.findByRole('table', {name: 'ip#0'});
            const filter = screen.getByRole('searchbox', {name: 'Filter the resources'});
            fireEvent.change(filter, {target: {value: 'container'}});
            expect(screen.getAllByRole('table').map((t) => t.getAttribute('aria-label'))).toEqual(['container#0']);
            fireEvent.change(filter, {target: {value: '10.0.0.12'}});
            const ip = screen.getByRole('table', {name: 'ip#0'});
            expect(within(ip).getAllByRole('row')).toHaveLength(2);
            fireEvent.change(filter, {target: {value: 'nothing'}});
            expect(screen.getByText('No resource matches the filter')).toBeInTheDocument();
        });

        test('no resource reports anything', async () => {
            answer({kind: 'ResourceInfoList', items: []});
            render(<ObjectResources path="ns1/svc/web"/>);
            expect(await screen.findByText('No resource reports information')).toBeInTheDocument();
        });
    });
});
