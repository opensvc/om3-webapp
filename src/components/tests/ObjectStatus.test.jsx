import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {vi} from 'vitest';
import ObjectStatus from '../ObjectStatus';
import useEventStore from '../../hooks/useEventStore.js';
import dns from '../../app/tests/fixtures/system-svc-dns.json';

const {mockApiFetch, mockRetain, mockRelease} = vi.hoisted(() => ({
    mockApiFetch: vi.fn(),
    mockRetain: vi.fn(),
    mockRelease: vi.fn(),
}));

vi.mock('../../services/api.jsx', () => ({
    apiFetch: mockApiFetch,
    getResponseErrorMessage: async (response) => response.detail ?? '',
}));
// The console, an xterm, is tested on its own: here, what it is opened on.
vi.mock('../ConsoleTerminal.jsx', () => ({
    default: ({open, target}) => (open ? <div data-testid="console">{`${target.rid} on ${target.node}`}</div> : null),
}));
vi.mock('../../eventSourceManager.jsx', () => ({
    retainEventReception: (...args) => {
        mockRetain(...args);
        return mockRelease;
    },
}));

const cluster = (frozen) => ({
    cluster: {
        status: {is_compat: true},
        node: {
            dev3n1: {status: {frozen_at: frozen ? '2026-10-12T10:00:00Z' : '0001-01-01T00:00:00Z'}},
            dev3n2: {status: {frozen_at: '0001-01-01T00:00:00Z'}},
        },
    },
});

/** Answers the object with `object`, the cluster status with `clusterStatus`. */
const answer = (object, clusterStatus = cluster(false)) => mockApiFetch.mockImplementation((url) =>
    Promise.resolve(url.includes('/cluster/status') ? clusterStatus : {data: object}));

describe('ObjectStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('authToken', 'tok');
    });

    afterEach(() => {
        localStorage.clear();
    });

    test('reads the object and shows its status board, its stream claimed while shown', async () => {
        answer(dns);
        const {unmount} = render(<ObjectStatus path="system/svc/dns"/>);
        const board = await screen.findByRole('table', {name: 'Status of system/svc/dns by node'});
        expect(mockApiFetch).toHaveBeenCalledWith('/api/object/path/system/svc/dns', expect.objectContaining({
            headers: {Authorization: 'Bearer tok'},
        }));
        expect(mockRetain).toHaveBeenCalledWith('tok', expect.arrayContaining(['InstanceStatusUpdated']), 'system/svc/dns');
        for (const fact of ['flex', 'ha', 'nodes order']) expect(screen.getByText(fact)).toBeInTheDocument();
        expect(screen.getByText('Instances up').nextSibling).toHaveTextContent('0/2');
        expect(within(board).getByRole('columnheader', {name: /dev3n1/})).toBeInTheDocument();
        expect(within(board).getByRole('rowheader', {name: /container#janitor$/})).toBeInTheDocument();
        expect(within(board).getAllByText('start failed')).toHaveLength(2);
        // The statuses drawn as in the other views, the flags named.
        expect(within(board).getAllByText('down').length).toBeGreaterThan(0);
        expect(within(board).getAllByText('disabled')).toHaveLength(2);
        // n/a written as om writes it, and no tooltip of its own on a piece of a
        // cell: the card of the cell says what they mean, without two over each other.
        const config = within(board).getByRole('rowheader', {name: /container#config$/}).closest('tr');
        expect(within(config).getAllByText('/')).toHaveLength(2);
        expect(board.querySelectorAll('td [title]')).toHaveLength(0);
        expect(screen.getByRole('heading', {name: 'Notes (2)'})).toBeInTheDocument();
        expect(screen.getByText('system/vol/dns avail down')).toBeInTheDocument();
        unmount();
        expect(mockRelease).toHaveBeenCalled();
    });

    test('the summary: the statuses on a line, the issues on the next, the policies and the actions apart', async () => {
        const broken = structuredClone(dns);
        broken.provisioned = 'false';
        answer(broken);
        render(<ObjectStatus path="system/svc/dns"/>);
        await screen.findByRole('table');
        expect(screen.getByText('Avail').nextSibling).toHaveTextContent('down');
        expect(screen.getByRole('list', {name: 'Issues'})).toHaveTextContent('not provisioned');
        // Out of a panel, the policies and the actions stand over the summary.
        expect(screen.getByLabelText('Policies')).toHaveTextContent('flexhanodes order');
        expect(screen.getByRole('button', {name: 'Actions'})).toBeInTheDocument();
    });

    test('no issue, no issue line', async () => {
        answer(dns);
        render(<ObjectStatus path="system/svc/dns"/>);
        await screen.findByRole('table');
        expect(screen.queryByRole('list', {name: 'Issues'})).not.toBeInTheDocument();
    });

    test('the instances have a heading of their own, counted, their state under it', async () => {
        answer(dns);
        render(<ObjectStatus path="system/svc/dns"/>);
        const board = await screen.findByRole('table');
        expect(within(board).getByRole('rowheader', {name: 'Instances (2)'})).toBeInTheDocument();
        const state = within(board).getByRole('rowheader', {name: 'State'}).closest('tr');
        expect(within(state).getAllByText('down')).toHaveLength(2);
        expect(within(board).getByRole('rowheader', {name: 'Resources (6)'})).toBeInTheDocument();
        // Headings in bold, not on a grey band; no border round the table nor between its rows.
        expect(within(board).getByRole('rowheader', {name: 'Instances (2)'}).closest('tr')).not.toHaveClass('bg-surface-sunken');
        expect(board.parentElement).toHaveClass('border-0');
        expect(state).toHaveClass('border-b-0');
    });

    test('marks the frozen nodes the cluster status names', async () => {
        answer(dns, cluster(true));
        render(<ObjectStatus path="system/svc/dns"/>);
        expect(await screen.findByRole('columnheader', {name: /dev3n1.*frozen/})).toBeInTheDocument();
        expect(screen.getByText('the daemon takes no initiative on the instances of the node')).toBeInTheDocument();
    });

    test('reads the object again when an event about it arrives', async () => {
        answer(dns);
        render(<ObjectStatus path="system/svc/dns"/>);
        await screen.findByRole('table');
        const up = structuredClone(dns);
        up.avail = 'up';
        answer(up);
        act(() => {
            useEventStore.setState((s) => ({objectStatus: {...s.objectStatus, 'system/svc/dns': {avail: 'up'}}}));
        });
        await waitFor(() => expect(screen.getByText('Avail').nextSibling).toHaveTextContent('up'));
    });

    test('says why the status could not be read', async () => {
        mockApiFetch.mockRejectedValue(new Error('403 forbidden'));
        render(<ObjectStatus path="system/svc/dns"/>);
        expect(await screen.findByText(/403 forbidden/)).toBeInTheDocument();
    });

    describe('actions', () => {
        /** The actions posted, their address and method. */
        let posted;
        beforeEach(() => {
            posted = [];
            global.fetch = vi.fn((url, options) => {
                posted.push(`${options.method} ${url}`);
                return Promise.resolve({ok: true, status: 200});
            });
        });

        const ready = async (object = dns) => {
            answer(object);
            render(<ObjectStatus path="system/svc/dns"/>);
            await screen.findByRole('table');
        };

        /** The name of a resource, a click on which selects it on all its nodes. */
        const name = (rid) => screen.getByRole('rowheader', {name: new RegExp(`${rid}$`)});
        /** The cell of a resource on a node, a click on which selects it there. */
        const cell = (rid, node) => within(name(rid).closest('tr')).getAllByRole('cell')[node === 'dev3n1' ? 0 : 1];
        /** The column header of a node, a click on which selects its instance. */
        const header = (node) => screen.getByRole('columnheader', {name: new RegExp(node)});
        const selectionButton = () => screen.getByRole('button', {name: /^Actions on/});

        const pick = (...labels) => labels.forEach((label) => fireEvent.click(screen.getByRole('menuitem', {name: label})));
        const confirm = (action) => fireEvent.click(within(screen.getByRole('dialog', {name: new RegExp(action, 'i')})).getByRole('button', {name: 'Confirm'}));

        test('the object starts, confirmed first, where the orchestration decides', async () => {
            await ready();
            fireEvent.click(screen.getByRole('button', {name: 'Actions'}));
            pick('Start');
            expect(posted).toEqual([]);
            confirm('start');
            await waitFor(() => expect(posted).toEqual(['POST /api/object/path/system/svc/dns/action/start']));
            expect(await screen.findByText('start on system/svc/dns: accepted')).toBeInTheDocument();
        });

        test('nothing selected, no action button: the help says how to select', async () => {
            await ready();
            const help = /Click on resources or on instances to select them/;
            expect(screen.queryByRole('button', {name: /^Actions on/})).not.toBeInTheDocument();
            expect(screen.getByText(help)).toBeInTheDocument();
            // The help and the buttons share a row as high as the buttons: the table does not move.
            const bar = screen.getByText(help).parentElement;
            expect(bar).toHaveClass('min-h-7');
            // No checkbox in sight.
            for (const box of screen.getAllByRole('checkbox')) expect(box).toHaveClass('sr-only');

            fireEvent.click(cell('volume#1', 'dev3n1'));
            expect(selectionButton()).toBeInTheDocument();
            expect(screen.queryByText(help)).not.toBeInTheDocument();
            expect(selectionButton().closest('.min-h-7')).toBe(bar);
            // Unselected, the button goes, and the help comes back.
            fireEvent.click(cell('volume#1', 'dev3n1'));
            expect(screen.queryByRole('button', {name: /^Actions on/})).not.toBeInTheDocument();
            expect(screen.getByText(help)).toBeInTheDocument();
        });

        test('what selects looks it: the hand, a tint on hover; the names stay plain', async () => {
            await ready();
            expect(cell('container#janitor', 'dev3n1')).toHaveClass('cursor-pointer', 'hover:bg-accent-soft/60');
            expect(name('container#janitor')).toHaveClass('cursor-pointer');
            expect(within(name('container#janitor')).getByText('container#janitor')).not.toHaveClass('underline');
            expect(within(header('dev3n1')).getByText('dev3n1')).not.toHaveClass('underline');
            // The type and the description select nothing.
            expect(within(name('container#janitor').closest('tr')).getByText('docker')).not.toHaveClass('cursor-pointer');
        });

        test('a cell selects its resource on its node only, tinted and edged', async () => {
            await ready();
            fireEvent.click(cell('container#janitor', 'dev3n2'));
            expect(cell('container#janitor', 'dev3n2')).toHaveClass('bg-accent-soft');
            expect(cell('container#janitor', 'dev3n1')).not.toHaveClass('bg-accent-soft');
            // The tint and the edge tell it: no check mark.
            expect(cell('container#janitor', 'dev3n2').style.boxShadow).toMatch(/inset/);
            expect(cell('container#janitor', 'dev3n2').querySelector('svg.text-accent')).toBeNull();
            expect(screen.getByRole('checkbox', {name: 'Select container#janitor on dev3n2'})).toBeChecked();
            expect(screen.getByRole('checkbox', {name: 'Select container#janitor on dev3n1'})).not.toBeChecked();
            // The name says the resource is partly selected, to the screen readers only: no mark by it.
            expect(screen.getByRole('checkbox', {name: 'Select container#janitor on all its nodes'})).toHaveProperty('indeterminate', true);
            expect(name('container#janitor').querySelector('svg')).toBeNull();
            expect(selectionButton()).toHaveAccessibleName('Actions on 1 resource');
            fireEvent.click(selectionButton());
            pick('Restart');
            expect(screen.getByRole('dialog', {name: /restart/i})).toHaveTextContent('container#janitor of system/svc/dns on dev3n2');
            confirm('restart');
            await waitFor(() => expect(posted).toEqual([
                'POST /api/node/name/dev3n2/instance/path/system/svc/dns/action/restart?rid=container%23janitor',
            ]));
        });

        test('a name selects its resource on all its nodes, a second click unselects it', async () => {
            await ready();
            fireEvent.click(name('container#janitor'));
            expect(cell('container#janitor', 'dev3n1')).toHaveClass('bg-accent-soft');
            expect(cell('container#janitor', 'dev3n2')).toHaveClass('bg-accent-soft');
            expect(screen.getByRole('checkbox', {name: 'Select container#janitor on all its nodes'})).toBeChecked();
            expect(selectionButton()).toHaveAccessibleName('Actions on 1 resource');
            // The name and its cells, side by side, make one block: edged outside only.
            const edges = (el) => el.style.boxShadow;
            expect(edges(cell('container#janitor', 'dev3n1'))).not.toMatch(/inset (-)?1px 0 0/);
            expect(edges(cell('container#janitor', 'dev3n1'))).toMatch(/inset 0 1px 0/);
            expect(edges(cell('container#janitor', 'dev3n2'))).toMatch(/inset -1px 0 0/);
            expect(edges(name('container#janitor'))).toMatch(/inset 1px 0 0/);
            fireEvent.click(name('container#janitor'));
            expect(screen.queryByRole('button', {name: /^Actions on/})).not.toBeInTheDocument();
            // Partly selected, a click selects the rest.
            fireEvent.click(cell('container#janitor', 'dev3n1'));
            fireEvent.click(name('container#janitor'));
            expect(screen.getByRole('checkbox', {name: 'Select container#janitor on all its nodes'})).toBeChecked();
        });

        test('the hidden checkboxes select from the keyboard', async () => {
            await ready();
            fireEvent.click(screen.getByRole('checkbox', {name: 'Select volume#1 on dev3n1'}));
            expect(cell('volume#1', 'dev3n1')).toHaveClass('bg-accent-soft');
            expect(selectionButton()).toHaveAccessibleName('Actions on 1 resource');
            fireEvent.click(screen.getByRole('checkbox', {name: 'Select the instance on dev3n2'}));
            expect(selectionButton()).toHaveAccessibleName('Actions on 1 instance');
        });

        test('instances or resources: picking one kind drops the other', async () => {
            await ready();
            fireEvent.click(cell('volume#1', 'dev3n2'));
            fireEvent.click(header('dev3n1'));
            expect(cell('volume#1', 'dev3n2')).not.toHaveClass('bg-accent-soft');
            expect(header('dev3n1')).toHaveClass('bg-accent-soft');
            expect(selectionButton()).toHaveAccessibleName('Actions on 1 instance');
            // Unselecting an instance drops the resources too: none are left to drop.
            fireEvent.click(name('volume#1'));
            expect(header('dev3n1')).not.toHaveClass('bg-accent-soft');
            expect(selectionButton()).toHaveAccessibleName('Actions on 1 resource');
            fireEvent.click(header('dev3n1'));
            fireEvent.click(header('dev3n1'));
            expect(screen.getByRole('checkbox', {name: 'Select volume#1 on all its nodes'})).not.toBeChecked();
            expect(screen.queryByRole('button', {name: /^Actions on/})).not.toBeInTheDocument();
        });

        test('the selection is cleared by a button', async () => {
            await ready();
            fireEvent.click(cell('volume#1', 'dev3n2'));
            const clear = screen.getByRole('button', {name: 'Clear the selection'});
            expect(clear).toHaveClass('border');
            expect(clear.querySelector('svg')).not.toBeNull();
            fireEvent.click(clear);
            expect(screen.queryByRole('button', {name: /^Actions on/})).not.toBeInTheDocument();
        });

        test('the resources picked run together, each node given the ones picked on it', async () => {
            await ready();
            fireEvent.click(name('container#janitor'));
            fireEvent.click(cell('container#server', 'dev3n1'));
            fireEvent.click(selectionButton());
            // A console is for one resource: not among the actions of several.
            expect(screen.queryByRole('menuitem', {name: 'Console'})).not.toBeInTheDocument();
            pick('Restart');
            expect(screen.getByRole('dialog', {name: /restart/i})).toHaveTextContent(
                'container#janitor on all nodes, container#server on dev3n1 of system/svc/dns',
            );
            confirm('restart');
            await waitFor(() => expect(posted).toEqual([
                'POST /api/node/name/dev3n1/instance/path/system/svc/dns/action/restart?rid=container%23janitor%2Ccontainer%23server',
                'POST /api/node/name/dev3n2/instance/path/system/svc/dns/action/restart?rid=container%23janitor',
            ]));
            // Done, the selection is cleared, and the button with it.
            await waitFor(() => expect(screen.queryByRole('button', {name: /^Actions on/})).not.toBeInTheDocument());
        });

        test('instances alone: the instance actions, a failed one cleared first', async () => {
            await ready();
            fireEvent.click(header('dev3n1'));
            // The instance cell selects its node too.
            fireEvent.click(within(screen.getByRole('rowheader', {name: 'State'}).closest('tr')).getAllByRole('cell')[1]);
            expect(selectionButton()).toHaveAccessibleName('Actions on 2 instances');
            fireEvent.click(selectionButton());
            expect(screen.getAllByRole('menuitem')[0]).toHaveTextContent('Clear');
            pick('Start');
            expect(screen.getByRole('dialog', {name: /start/i})).toHaveTextContent('system/svc/dns on all nodes');
            confirm('start');
            await waitFor(() => expect(posted).toEqual([
                'POST /api/node/name/dev3n1/instance/path/system/svc/dns/action/start',
                'POST /api/node/name/dev3n2/instance/path/system/svc/dns/action/start',
            ]));
        });

        test('any cell of the instances selects its instance, an empty one too, as one column block', async () => {
            await ready();
            const row = (label) => screen.getByRole('rowheader', {name: label}).closest('tr');
            const monitor = within(row('Monitor')).getAllByRole('cell')[1];
            fireEvent.click(monitor);
            expect(selectionButton()).toHaveAccessibleName('Actions on 1 instance');
            expect(header('dev3n2')).toHaveClass('bg-accent-soft');
            // The heading row has a cell under each node: empty, it selects too.
            const heading = within(row('Instances (2)')).getAllByRole('cell')[1];
            expect(heading).toHaveClass('bg-accent-soft', 'cursor-pointer');
            fireEvent.click(heading);
            expect(screen.queryByRole('button', {name: /^Actions on/})).not.toBeInTheDocument();
            fireEvent.click(heading);
            // One block from the header to the last row of the instances: edged on its outside only.
            expect(header('dev3n2').style.boxShadow).not.toMatch(/inset 0 -1px 0/);
            expect(heading.style.boxShadow).not.toMatch(/inset 0 (-)?1px 0/);
            expect(monitor.style.boxShadow).toMatch(/inset 0 -1px 0/);
            expect(monitor.style.boxShadow).not.toMatch(/inset 0 1px 0/);
            // The first resource, under the block, is not part of it.
            expect(cell('volume#1', 'dev3n2')).not.toHaveClass('bg-accent-soft');
        });

        test('a node of the scope with no instance reported selects its instance too', async () => {
            const wider = structuredClone(dns);
            wider.scope = [...wider.scope, 'dev3n3'];
            await ready(wider);
            const row = (label) => screen.getByRole('rowheader', {name: label}).closest('tr');
            const state = within(row('State')).getAllByRole('cell')[2];
            expect(state).toHaveClass('cursor-pointer');
            fireEvent.click(state);
            expect(selectionButton()).toHaveAccessibleName('Actions on 1 instance');
            expect(header('dev3n3')).toHaveClass('bg-accent-soft');
            // The heading cell and the header select it as well.
            fireEvent.click(within(row('Instances (2)')).getAllByRole('cell')[2]);
            expect(screen.queryByRole('button', {name: /^Actions on/})).not.toBeInTheDocument();
            fireEvent.click(header('dev3n3'));
            fireEvent.click(selectionButton());
            pick('Start');
            confirm('start');
            await waitFor(() => expect(posted).toEqual(['POST /api/node/name/dev3n3/instance/path/system/svc/dns/action/start']));
        });

        test('a failed instance is cleared, for the orchestration to try again', async () => {
            await ready();
            fireEvent.click(header('dev3n1'));
            fireEvent.click(selectionButton());
            pick('Clear');
            confirm('clear');
            await waitFor(() => expect(posted).toEqual(['POST /api/node/name/dev3n1/instance/path/system/svc/dns/clear']));
        });

        test('an instance not failed has nothing to clear, and freezes', async () => {
            const idle = structuredClone(dns);
            idle.instances.dev3n2.monitor.state = 'idle';
            await ready(idle);
            fireEvent.click(header('dev3n2'));
            fireEvent.click(selectionButton());
            expect(screen.queryByRole('menuitem', {name: 'Clear'})).not.toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Freeze'})).toBeInTheDocument();
            expect(screen.queryByRole('menuitem', {name: 'Unfreeze'})).not.toBeInTheDocument();
        });

        test('a container on one node opens a console; a volume has none', async () => {
            await ready();
            fireEvent.click(cell('container#server', 'dev3n1'));
            fireEvent.click(selectionButton());
            pick('Console');
            expect(screen.getByTestId('console')).toHaveTextContent('container#server on dev3n1');
            expect(posted).toEqual([]);
            fireEvent.click(screen.getByRole('button', {name: 'Clear the selection'}));
            fireEvent.click(cell('volume#1', 'dev3n1'));
            fireEvent.click(selectionButton());
            expect(screen.queryByRole('menuitem', {name: 'Console'})).not.toBeInTheDocument();
        });

        test('says which node refused the action, and why', async () => {
            await ready();
            global.fetch = vi.fn((url) => Promise.resolve(url.includes('dev3n2')
                ? {ok: false, status: 403, detail: 'forbidden'}
                : {ok: true, status: 200}));
            fireEvent.click(name('container#janitor'));
            fireEvent.click(selectionButton());
            pick('Start');
            confirm('start');
            expect(await screen.findByText(
                'start on container#janitor of system/svc/dns on all nodes failed: dev3n2: HTTP 403 forbidden',
            )).toBeInTheDocument();
        });
    });

    describe('notes on hover', () => {
        test('a cell says what it shows, then the notes of its resource on its node', async () => {
            answer(dns);
            render(<ObjectStatus path="system/svc/dns"/>);
            await screen.findByRole('table');
            const cell = within(screen.getByRole('rowheader', {name: /volume#1$/}).closest('tr')).getAllByRole('cell')[0];
            const target = cell.querySelector(':scope > span');
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
            fireEvent.mouseOver(target);
            expect(screen.getByRole('tooltip')).toHaveTextContent('Status: down');
            expect(screen.getByRole('tooltip')).toHaveTextContent('system/vol/dns avail down');
            fireEvent.mouseOut(target);
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
            // A cell with nothing to explain, and no note: a monitor state.
            fireEvent.mouseOver(within(screen.getByRole('rowheader', {name: 'Monitor'}).closest('tr')).getAllByText('start failed')[0]);
            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        test('an instance cell shows the notes about the instance of its node', async () => {
            answer(dns);
            render(<ObjectStatus path="system/svc/dns"/>);
            await screen.findByRole('table');
            const cell = within(screen.getByRole('rowheader', {name: 'State'}).closest('tr')).getAllByRole('cell')[1];
            fireEvent.mouseOver(cell.firstElementChild);
            expect(screen.getByRole('tooltip')).toHaveTextContent('Status: down');
            expect(screen.getByRole('tooltip')).toHaveTextContent('start failed: the orchestration gave up, clear the instance to retry');
        });

        test('a resource name shows its notes on every node', async () => {
            answer(dns);
            render(<ObjectStatus path="system/svc/dns"/>);
            await screen.findByRole('table');
            fireEvent.mouseOver(within(screen.getByRole('rowheader', {name: /volume#1$/})).getByText('volume#1'));
            expect(screen.getByRole('tooltip')).toHaveTextContent('all nodes');
            expect(screen.getByRole('tooltip')).toHaveTextContent('system/vol/dns avail down');
        });
    });
});
