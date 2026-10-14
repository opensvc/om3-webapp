import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {vi} from 'vitest';
import {PeekPanel} from '../PeekPanel';
import useEventStore from '../../hooks/useEventStore.js';
import {reloadRecordHistory} from '../../app/record-history';
import node from './fixtures/node-dev3n1.json';

const {mockRetain, mockRelease} = vi.hoisted(() => ({mockRetain: vi.fn(), mockRelease: vi.fn()}));

vi.mock('../../eventSourceManager', () => ({
    retainEventReception: (...args) => {
        mockRetain(...args);
        return mockRelease;
    },
}));
// The logs stream is tested on its own: here, which node and which kind it reads.
vi.mock('../LogsViewer', () => ({
    default: ({nodename, type, filters = []}) => (
        <div data-testid="logs">{`${type} logs of ${nodename}${filters.length ? ` where ${filters.join(', ')}` : ''}`}</div>
    ),
}));
// The confirmation dialogs are tested on their own: here, the action confirmed.
vi.mock('../ActionDialogManager', () => ({
    default: ({pendingAction, handleConfirm, target}) => (pendingAction === null ? null : (
        <div role="alertdialog" aria-label={`${pendingAction.action} ${target}`}>
            <button type="button" onClick={() => handleConfirm(pendingAction.action)}>Confirm</button>
        </div>
    )),
}));

const CONFIG = '[DEFAULT]\nid = 802efbd1\n\n[node]\nenv = TST\n';

function Location() {
    const location = useLocation();
    return <output data-testid="location">{decodeURIComponent(location.search)}</output>;
}

const renderPanel = (search = '?peek=node:dev3n1') => render(
    <MemoryRouter initialEntries={[`/objects${search}`]}>
        <PeekPanel/>
        <Location/>
    </MemoryRouter>
);

describe('NodeDetailPanel', () => {
    /** The requests made, their method, address and body. */
    let requests;
    let config;
    /** What the daemon answers, a copy a test may change. */
    let api;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('authToken', 'tok');
        sessionStorage.clear();
        reloadRecordHistory();
        requests = [];
        config = CONFIG;
        api = structuredClone(node);
        global.fetch = vi.fn(async (url, options = {}) => {
            const method = options.method ?? 'GET';
            requests.push({method, url, body: options.body});
            const path = url.replace('/api/node/name/dev3n1/', '');
            if (path === 'config/file') {
                if (method === 'PUT') config = options.body;
                return new Response(method === 'PUT' ? null : config, {status: method === 'PUT' ? 204 : 200});
            }
            if (method === 'POST') return new Response(null, {status: 200});
            const body = api[path];
            return body === undefined
                ? new Response(JSON.stringify({detail: 'not found'}), {status: 404})
                : new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
        });
        useEventStore.setState({
            nodeStatus: {dev3n1: {agent: 'v3.0.0-rc46', frozen_at: '0001-01-01T00:00:00Z', booted_at: '2026-10-10T14:08:50+02:00', is_leader: true}},
            nodeMonitor: {dev3n1: {state: 'idle'}},
            nodeStats: {dev3n1: {score: 63, load_15m: 0.39, mem_avail: 42, mem_total: 5920, swap_avail: 0, swap_total: 0}},
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    const panel = () => screen.getByRole('dialog', {name: 'dev3n1'});
    const openTab = (name) => fireEvent.click(within(panel()).getByRole('tab', {name}));

    test('opens on its state, kept current by the node events, and its properties', async () => {
        renderPanel();
        expect(within(panel()).getAllByRole('tab').map((tab) => tab.textContent))
            .toEqual(['Status', 'Inventory', 'Configuration', 'Schedules', 'Drivers', 'Logs']);
        const facts = within(panel()).getByLabelText('Node state');
        expect(facts).toHaveTextContent('Stateidle');
        expect(facts).toHaveTextContent('Agentv3.0.0-rc46');
        expect(facts).toHaveTextContent('LeaderYes');
        expect(facts).toHaveTextContent('Memory available42% of 5.8 GiB');
        expect(mockRetain).toHaveBeenCalledWith('tok', ['NodeStatusUpdated', 'NodeMonitorUpdated', 'NodeStatsUpdated']);

        const properties = await within(panel()).findByRole('table', {name: 'Properties'});
        expect(within(properties).getByRole('row', {name: /os arch x86_64 probe/})).toBeInTheDocument();
        // A property the agent could not probe says why, muted.
        expect(within(properties).getByRole('row', {name: /enclosure not implemented/})).toBeInTheDocument();
    });

    test('its actions stand in the title bar, an oc3 pill, each confirmed then posted', async () => {
        renderPanel();
        const actions = within(panel()).getByRole('button', {name: 'Node actions'});
        expect(actions).toHaveClass('rounded-(--radius-pill)');
        fireEvent.click(actions);
        const menu = screen.getByRole('menu', {name: 'Node actions'});
        // Not frozen: freeze on offer, unfreeze not.
        expect(within(menu).getByRole('menuitem', {name: 'Freeze'})).toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', {name: 'Unfreeze'})).not.toBeInTheDocument();
        fireEvent.click(within(menu).getByRole('menuitem', {name: 'Freeze'}));
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', {name: 'Confirm'}));
        await waitFor(() => expect(requests).toContainEqual(expect.objectContaining({
            method: 'POST', url: '/api/node/name/dev3n1/action/freeze',
        })));
        expect(await within(panel()).findByText(/'Freeze' succeeded on 1 node/)).toBeInTheDocument();
    });

    test('no abort in its menu: the orchestration in progress offers it, and its logs', async () => {
        useEventStore.setState({nodeMonitor: {dev3n1: {state: 'draining', global_expect: 'drained', orchestration_id: 'o-7'}}});
        renderPanel();
        fireEvent.click(within(panel()).getByRole('button', {name: 'Node actions'}));
        expect(within(screen.getByRole('menu')).queryByRole('menuitem', {name: 'Abort'})).not.toBeInTheDocument();
        fireEvent.click(within(panel()).getByRole('button', {name: 'Node actions'}));

        const badge = within(panel()).getByRole('button', {name: 'Orchestration in progress: drained'});
        fireEvent.click(badge);
        fireEvent.click(screen.getByRole('menuitem', {name: 'Abort'}));
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', {name: 'Confirm'}));
        await waitFor(() => expect(requests).toContainEqual(expect.objectContaining({
            method: 'POST', url: '/api/node/name/dev3n1/action/abort',
        })));

        // Its logs: the logs tab, of this orchestration only, until asked for all.
        fireEvent.click(badge);
        fireEvent.click(screen.getByRole('menuitem', {name: 'Logs'}));
        expect(within(panel()).getByRole('tab', {name: 'Logs'})).toHaveAttribute('aria-selected', 'true');
        expect(within(panel()).getByTestId('logs')).toHaveTextContent('node logs of dev3n1 where ORCHESTRATION_ID=o-7');
        fireEvent.click(within(panel()).getByRole('button', {name: 'Show all the logs'}));
        expect(within(panel()).getByTestId('logs')).toHaveTextContent(/^node logs of dev3n1$/);
    });

    test('its inventory, a section each, sizes in bytes made readable', async () => {
        renderPanel('?peek=node:dev3n1&peektab=inventory');
        const disks = await within(panel()).findByRole('table', {name: 'Disks'});
        expect(within(disks).getByRole('row', {name: /\/dev\/vda disk 0x1af4 30 GiB/})).toBeInTheDocument();
        expect(within(disks).getByRole('row', {name: /\/dev\/sr0 rom QEMU QEMU DVD-ROM 374 KiB/})).toBeInTheDocument();
        expect(within(panel()).getByRole('table', {name: 'IP addresses'})).toHaveTextContent('10.44.0.11/24');
        expect(within(panel()).getByRole('table', {name: 'SAN paths'})).toHaveTextContent('dev3n1.storage.target.2');
        expect(within(panel()).getByRole('heading', {name: 'Hardware 3'})).toBeInTheDocument();
        expect(within(panel()).getByRole('table', {name: 'Users'})).toHaveTextContent('root');
    });

    test('packages are filtered, and the first ones only shown of a long list', async () => {
        api['system/package'] = {
            kind: 'PackageList',
            items: Array.from({length: 250}, (_, i) => ({kind: 'PackageItem', meta: {node: 'dev3n1'}, data: {name: `pkg${String(i).padStart(3, '0')}`, version: '1', arch: 'all', type: 'deb'}})),
        };
        renderPanel('?peek=node:dev3n1&peektab=inventory');
        const packages = await within(panel()).findByRole('table', {name: 'Packages'});
        expect(within(packages).getAllByRole('row')).toHaveLength(1 + 200);
        expect(within(panel()).getByText('50 more packages: refine the filter.')).toBeInTheDocument();
        fireEvent.change(within(panel()).getByRole('searchbox', {name: 'Filter the packages'}), {target: {value: 'pkg24'}});
        expect(within(packages).getAllByRole('row').slice(1).map((row) => row.cells[0].textContent))
            .toEqual(['pkg240', 'pkg241', 'pkg242', 'pkg243', 'pkg244', 'pkg245', 'pkg246', 'pkg247', 'pkg248', 'pkg249']);
    });

    test('its configuration file, edited in place and written whole', async () => {
        renderPanel('?peek=node:dev3n1&peektab=config');
        expect(await within(panel()).findByLabelText('Node configuration file')).toHaveTextContent('env = TST');
        fireEvent.click(within(panel()).getByRole('button', {name: 'Edit the configuration file'}));
        const editor = await within(panel()).findByRole('textbox', {name: 'Node configuration file'});
        fireEvent.change(editor, {target: {value: `${CONFIG}max_parallel = 4\n`}});
        fireEvent.click(within(panel()).getByRole('button', {name: 'Save'}));
        await waitFor(() => expect(requests).toContainEqual({
            method: 'PUT', url: '/api/node/name/dev3n1/config/file', body: `${CONFIG}max_parallel = 4\n`,
        }));
        expect(await within(panel()).findByText('Configuration updated successfully')).toBeInTheDocument();
        expect(within(panel()).getByLabelText('Node configuration file')).toHaveTextContent('max_parallel = 4');
    });

    test('a file changed since the edit started is not overwritten', async () => {
        renderPanel('?peek=node:dev3n1&peektab=config');
        await within(panel()).findByLabelText('Node configuration file');
        fireEvent.click(within(panel()).getByRole('button', {name: 'Edit the configuration file'}));
        const editor = await within(panel()).findByRole('textbox', {name: 'Node configuration file'});
        config = `${CONFIG}changed = elsewhere\n`;
        fireEvent.change(editor, {target: {value: `${CONFIG}mine = 1\n`}});
        fireEvent.click(within(panel()).getByRole('button', {name: 'Save'}));
        expect(await within(panel()).findByRole('alert')).toHaveTextContent('changed by someone else');
        expect(requests.filter((r) => r.method === 'PUT')).toEqual([]);
    });

    test('its schedules, its drivers and capabilities filtered, its logs', async () => {
        renderPanel('?peek=node:dev3n1&peektab=schedules');
        const schedules = await within(panel()).findByRole('table', {name: 'Schedules'});
        expect(within(schedules).getByRole('row', {name: /checks ~00:00-06:00/})).toHaveTextContent('collector');

        openTab('Drivers');
        expect(screen.getByTestId('location')).toHaveTextContent('peektab=drivers');
        const drivers = await within(panel()).findByRole('list', {name: 'Drivers'});
        expect(within(drivers).getAllByRole('listitem').map((li) => li.textContent)).toContain('app.forking');
        // The capabilities name the drivers by their full name: the filter tells them apart.
        fireEvent.change(within(panel()).getByRole('searchbox', {name: 'Filter the drivers and capabilities'}), {target: {value: 'drivers.array'}});
        expect(within(drivers).getByText('None')).toBeInTheDocument();
        expect(within(panel()).getByRole('list', {name: 'Capabilities'})).toHaveTextContent('drivers.array.hds');

        openTab('Logs');
        expect(within(panel()).getByTestId('logs')).toHaveTextContent('node logs of dev3n1');
    });

    test('a read refused is said in its section', async () => {
        global.fetch.mockImplementation(async () => new Response(JSON.stringify({detail: 'forbidden'}), {status: 403}));
        renderPanel('?peek=node:dev3n1&peektab=schedules');
        expect(await within(panel()).findByRole('alert')).toHaveTextContent('Could not read it');
    });

    test('closed, it leaves the URL; the history keeps it, as a node', async () => {
        renderPanel();
        fireEvent.click(within(panel()).getAllByRole('button', {name: 'Close'})[0]);
        expect(screen.getByTestId('location')).toHaveTextContent(/^$/);
        await act(async () => {});
        expect(JSON.stringify(sessionStorage)).toContain('node');
    });

    test('a filter field is as wide as its label, which is never cut', async () => {
        renderPanel('?peek=node:dev3n1&peektab=drivers');
        const label = 'Filter the drivers and capabilities';
        const field = await within(panel()).findByRole('searchbox', {name: label});
        expect(field).toHaveAttribute('placeholder', label);
        expect(field.style.width).toBe(`calc(${label.length}ch + 3.5rem)`);
        expect(field).toHaveClass('min-w-56', 'max-w-full');
    });
});
