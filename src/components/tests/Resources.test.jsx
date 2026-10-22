import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {vi} from 'vitest';
import Resources, {toLine} from '../Resources';
import useEventStore from '../../hooks/useEventStore.js';

const {mockRetain, mockRelease} = vi.hoisted(() => ({mockRetain: vi.fn(), mockRelease: vi.fn()}));
vi.mock('../../eventSourceManager', () => ({
    retainEventReception: (...args) => {
        mockRetain(...args);
        return mockRelease;
    },
}));

/** A resource of an instance, as GET /resource lists it. */
const item = (object, node, rid, status, extra = {}) => ({
    kind: 'ResourceItem',
    meta: {object, node, rid, encap_node: extra.encap ?? ''},
    data: {
        config: {is_disabled: !!extra.disabled, is_monitored: !!extra.monitored, is_standby: false},
        ...(extra.restarts === undefined ? {} : {monitor: {restart: {remaining: extra.restarts}}}),
        status: {status, type: extra.type ?? `${rid.split('#')[0]}.x`, label: extra.label ?? '', provisioned: {state: extra.provisioned ?? 'true'}},
    },
});

const ITEMS = [
    item('ns1/svc/web', 'n1', 'fs#1', 'up', {type: 'fs.flag', label: '/srv/web'}),
    item('ns1/svc/web', 'n2', 'fs#1', 'down', {type: 'fs.flag', label: '/srv/web'}),
    item('ns1/svc/web', 'n1', 'container#1', 'up', {type: 'container.docker', monitored: true, restarts: 2}),
    item('system/svc/dns', 'n2', 'ip#0', 'warn', {type: 'ip.host', disabled: true, provisioned: 'false'}),
];

function Search() {
    return <output data-testid="search">{decodeURIComponent(useLocation().search)}</output>;
}

describe('Resources', () => {
    let answers;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('authToken', 'tok');
        localStorage.removeItem('om3.paging.resources');
        answers = [{status: 200, body: {kind: 'ResourceList', items: ITEMS}}];
        global.fetch = vi.fn(async () => {
            const answer = answers.length > 1 ? answers.shift() : answers[0];
            return new Response(JSON.stringify(answer.body), {status: answer.status});
        });
        useEventStore.setState({objectInstanceStatus: {}});
    });

    afterEach(() => {
        localStorage.clear();
        vi.useRealTimers();
    });

    const renderView = () => render(<MemoryRouter><Resources/><Search/></MemoryRouter>);
    const table = () => screen.getByRole('table', {name: 'The resources of the cluster'});
    const rows = () => within(table()).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => c.textContent));

    test('a line per resource of each instance, every object read, sorted by object, node and resource', async () => {
        renderView();
        await waitFor(() => expect(rows()).toHaveLength(4));
        expect(global.fetch.mock.calls[0][0]).toBe('/api/resource?path=*');
        expect(global.fetch.mock.calls[0][1].headers).toEqual({Authorization: 'Bearer tok'});
        expect(rows()).toEqual([
            ['ns1/svc/web', 'n1', 'container#1', 'container.docker', 'upup', 'monitored, 2 restarts left', ''],
            ['ns1/svc/web', 'n1', 'fs#1', 'fs.flag', 'upup', '-', '/srv/web'],
            ['ns1/svc/web', 'n2', 'fs#1', 'fs.flag', 'downdown', '-', '/srv/web'],
            ['system/svc/dns', 'n2', 'ip#0', 'ip.host', 'warnwarnnot provisioned', 'disabled', ''],
        ]);
        expect(screen.getByText('4 / 4')).toBeInTheDocument();
        // The instances' reports carried while shown.
        expect(mockRetain).toHaveBeenCalledWith('tok', ['InstanceStatusUpdated']);
    });

    test('each object, instance and resource a badge opening its record, the resource on its instance alone', async () => {
        renderView();
        await waitFor(() => expect(rows()).toHaveLength(4));
        const line = within(table()).getAllByRole('row')[3];
        fireEvent.click(within(line).getByRole('button', {name: 'fs#1'}));
        expect(screen.getByTestId('search')).toHaveTextContent('peek=resource:ns1/svc/web:fs#1@n2');
        fireEvent.click(within(line).getByRole('button', {name: 'n2'}));
        expect(screen.getByTestId('search')).toHaveTextContent('peek=instance:ns1/svc/web@n2');
        fireEvent.click(within(line).getByRole('button', {name: 'ns1/svc/web'}));
        expect(screen.getByTestId('search')).toHaveTextContent('peek=object:ns1/svc/web');
    });

    test('filtered by status, node, driver and words, the count said', async () => {
        renderView();
        await waitFor(() => expect(rows()).toHaveLength(4));
        fireEvent.change(screen.getByRole('combobox', {name: 'Status'}), {target: {value: 'up'}});
        expect(rows().map((r) => r[2])).toEqual(['container#1', 'fs#1']);
        fireEvent.change(screen.getByRole('combobox', {name: 'Driver'}), {target: {value: 'fs'}});
        expect(rows().map((r) => `${r[1]} ${r[2]}`)).toEqual(['n1 fs#1']);
        expect(screen.getByText('1 / 4')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('combobox', {name: 'Status'}), {target: {value: ''}});
        fireEvent.change(screen.getByRole('combobox', {name: 'Node'}), {target: {value: 'n2'}});
        expect(rows().map((r) => `${r[1]} ${r[2]}`)).toEqual(['n2 fs#1']);
        fireEvent.change(screen.getByRole('combobox', {name: 'Driver'}), {target: {value: ''}});
        fireEvent.change(screen.getByRole('searchbox', {name: 'Filter the resources'}), {target: {value: 'dns'}});
        expect(rows().map((r) => r[2])).toEqual(['ip#0']);
        fireEvent.change(screen.getByRole('searchbox', {name: 'Filter the resources'}), {target: {value: 'nothing'}});
        expect(within(table()).getByText('No resource matches.')).toBeInTheDocument();
    });

    test('sorted by a column, then the other way', async () => {
        renderView();
        await waitFor(() => expect(rows()).toHaveLength(4));
        fireEvent.click(within(table()).getByRole('button', {name: /^Status/}));
        expect(rows().map((r) => r[4].replace(/not provisioned/, ''))).toEqual(['downdown', 'upup', 'upup', 'warnwarn']);
        fireEvent.click(within(table()).getByRole('button', {name: /^Status/}));
        expect(rows()[0][4]).toMatch(/^warn/);
    });

    test('read again once the instances report, a burst read once', async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        renderView();
        await waitFor(() => expect(rows()).toHaveLength(4));
        answers = [{status: 200, body: {kind: 'ResourceList', items: ITEMS.slice(0, 1)}}];
        act(() => useEventStore.setState({objectInstanceStatus: {'ns1/svc/web': {n1: {avail: 'up'}}}}));
        act(() => useEventStore.setState({objectInstanceStatus: {'ns1/svc/web': {n1: {avail: 'down'}}}}));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2500);
        });
        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('not read: said, read again on demand', async () => {
        answers = [{status: 500, body: {detail: 'boom'}}, {status: 200, body: {kind: 'ResourceList', items: ITEMS}}];
        renderView();
        expect(await screen.findByText('The resources could not be read: boom')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
        await waitFor(() => expect(rows()).toHaveLength(4));
        expect(screen.queryByText(/could not be read/)).not.toBeInTheDocument();
    });

    test('a resource of an encapsulated node: shown on that node, opened on its host', () => {
        const line = toLine(item('ns1/svc/web', 'n1', 'app#1', 'up', {encap: 'c1'}));
        expect([line.node, line.hostNode]).toEqual(['c1', 'n1']);
    });
});
