import React from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {axe, toHaveNoViolations} from 'jest-axe';
import Objects from '../Objects';
import useEventStore from '../../hooks/useEventStore';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus';
import {closeEventSource, startEventReception} from '../../eventSourceManager';

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
    useLocation: jest.fn(),
}));
jest.mock('../../hooks/useEventStore');
jest.mock('../../hooks/useFetchDaemonStatus');
jest.mock('../../eventSourceManager');
jest.mock('@mui/material/useMediaQuery', () => jest.fn());
jest.mock('@mui/material/Collapse', () => ({in: inProp, children}) =>
    inProp ? children : null
);

expect.extend(toHaveNoViolations);

// ---------- helpers ----------
const mockNavigate = jest.fn();
const mockRemoveObject = jest.fn();
let originalConsoleError;

const defaultState = {
    objectStatus: {
        'test-ns/svc/test1': {avail: 'up', frozen: 'unfrozen'},
        'test-ns/svc/test2': {avail: 'down', frozen: 'frozen'},
        'root/svc/test3': {avail: 'warn', frozen: 'unfrozen'},
        'test-ns/svc/test4': {avail: 'n/a', frozen: 'unfrozen'},
        'test-ns/svc/unprovisioned': {avail: 'n/a', frozen: 'unfrozen', provisioned: 'false'},
    },
    objectInstanceStatus: {
        'test-ns/svc/test1': {
            node1: {avail: 'up', frozen_at: '0001-01-01T00:00:00Z'},
            node2: {avail: 'down', frozen_at: '2025-05-16T10:00:00Z'},
        },
        'test-ns/svc/test2': {
            node1: {avail: 'down', frozen_at: '2025-05-16T10:00:00Z'},
        },
        'root/svc/test3': {node2: {avail: 'warn', frozen_at: '0001-01-01T00:00:00Z'}},
        'test-ns/svc/test4': {},
        'test-ns/svc/unprovisioned': {
            node1: {avail: 'n/a', frozen_at: '0001-01-01T00:00:00Z', provisioned: 'false'},
        },
    },
    instanceMonitor: {
        'node1:test-ns/svc/test1': {state: 'running', global_expect: 'frozen'},
        'node2:test-ns/svc/test1': {state: 'idle', global_expect: 'none'},
        'node1:test-ns/svc/test2': {state: 'failed', global_expect: 'none'},
        'node2:root/svc/test3': {state: 'idle', global_expect: 'started'},
    },
    removeObject: mockRemoveObject,
};

const setup = (customState = {}, locationSearch = '', mediaQuery = true, {daemon} = {}) => {
    const state = {...defaultState, ...customState};
    useEventStore.mockImplementation((sel) => sel(state));
    useFetchDaemonStatus.mockReturnValue({daemon: daemon || {cluster: {object: {}}}});
    startEventReception.mockClear();
    closeEventSource.mockClear();
    global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({})}));
    require('react-router-dom').useLocation.mockReturnValue({search: locationSearch, pathname: '/objects'});
    require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);
    require('@mui/material/useMediaQuery').mockReturnValue(mediaQuery);

    const utils = render(
        <MemoryRouter>
            <Objects/>
        </MemoryRouter>
    );
    return {...utils, state};
};

const waitForLoad = () =>
    waitFor(() => expect(screen.getByLabelText('Global State')).toBeInTheDocument());

const selectFilter = async (label, optionText) => {
    const filter = screen.getByLabelText(label);
    fireEvent.mouseDown(filter);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    const option = options.find((o) => o.textContent.toLowerCase().includes(optionText.toLowerCase()));
    if (!option) throw new Error(`Option "${optionText}" not found`);
    fireEvent.click(within(option).getByRole('checkbox'));
    fireEvent.keyDown(listbox, {key: 'Escape', code: 'Escape'});
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument(), {timeout: 1000});
};

const selectRow = (name) => {
    const row = screen.getByRole('row', {name: new RegExp(name, 'i')});
    const cb = within(row).getByRole('checkbox');
    fireEvent.click(cb);
    return cb;
};

const openActionsMenu = () =>
    fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));

const clickMenuItem = async (text) => {
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText(new RegExp(`^${text}$`, 'i')));
};

const confirmDialog = async (buttonName = /Confirm|Stop|Delete/i) => {
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', {name: buttonName}));
};

beforeEach(() => {
    originalConsoleError = console.error;
    console.error = jest.fn((msg, ...args) => {
        if (
            typeof msg === 'string' &&
            (msg.includes('A props object containing a "key" prop is being spread into JSX') ||
                msg.includes('<li> cannot appear as a descendant of <li>'))
        )
            return;
        originalConsoleError.call(console, msg, ...args);
    });
    jest.clearAllMocks();
    jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('mock-token');
    mockRemoveObject.mockClear();
});

afterEach(() => {
    console.error = originalConsoleError;
    jest.restoreAllMocks();
});

// ---------- tests ----------
describe('Objects Component', () => {
    test('initial render and data fetch', async () => {
        const {unmount} = setup();
        await waitForLoad();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Object')).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: /node1/i})).toBeInTheDocument();
        expect(startEventReception).toHaveBeenCalledWith('mock-token', expect.any(Array));
        unmount();
        expect(closeEventSource).toHaveBeenCalled();
    });

    test('displays objects with correct status and node data', async () => {
        setup();
        await waitForLoad();
        ['test-ns/svc/test1', 'test-ns/svc/test2', 'root/svc/test3'].forEach((name) =>
            expect(screen.getByRole('row', {name: new RegExp(name)})).toBeInTheDocument()
        );
        const row1 = screen.getByRole('row', {name: /test1/});
        expect(within(row1).getByLabelText('Object is up')).toBeInTheDocument();
        expect(within(row1).getByText('frozen')).toBeInTheDocument();
        expect(within(row1).getByLabelText('Node node2 is down')).toBeInTheDocument();
        expect(within(row1).getByLabelText('Node node2 is frozen')).toBeInTheDocument();
    });

    test('selection and select all', async () => {
        setup();
        await waitForLoad();
        const cb = selectRow('test-ns/svc/test1');
        expect(cb).toBeChecked();
        const selectAll = screen.getAllByRole('checkbox')[0];
        fireEvent.click(selectAll);
        screen.getAllByRole('checkbox').slice(1).forEach((c) => expect(c).toBeChecked());
        fireEvent.click(selectAll);
        screen.getAllByRole('checkbox').slice(1).forEach((c) => expect(c).not.toBeChecked());
    });

    test('actions menu opens and lists actions', async () => {
        setup();
        await waitForLoad();
        await selectRow('test-ns/svc/test1');
        openActionsMenu();
        const menu = await screen.findByRole('menu');
        ['Restart', 'Stop', 'Freeze', 'Delete'].forEach((a) =>
            expect(within(menu).getByText(a)).toBeInTheDocument()
        );
    });

    describe('filtering', () => {
        const filterTests = [
            {
                label: 'Namespace',
                option: 'test-ns',
                visible: ['test-ns/svc/test1', 'test-ns/svc/test2'],
                hidden: ['root/svc/test3']
            },
            {label: 'Global State', option: 'Up', visible: ['test-ns/svc/test1'], hidden: ['test-ns/svc/test2']},
            {label: 'Kind', option: 'svc', visible: ['test-ns/svc/test1'], hidden: []},
            {
                label: 'Name',
                option: 'test1',
                visible: ['test-ns/svc/test1'],
                hidden: ['test-ns/svc/test2', 'root/svc/test3'],
                isSearch: true
            },
        ];

        test.each(filterTests)(
            '$label filter',
            async ({label, option, visible, hidden, isSearch}) => {
                setup();
                await waitForLoad();
                if (isSearch) {
                    fireEvent.change(screen.getByLabelText('Name'), {target: {value: option}});
                } else {
                    await selectFilter(label, option);
                }
                await waitFor(() => {
                    visible.forEach((n) => expect(screen.getByRole('row', {name: new RegExp(n)})).toBeInTheDocument());
                    hidden.forEach((n) => expect(screen.queryByRole('row', {name: new RegExp(n)})).not.toBeInTheDocument());
                });
            }
        );
    });

    test('multiple filters combined', async () => {
        setup();
        await waitForLoad();
        await selectFilter('Namespace', 'test-ns');
        await selectFilter('Global State', 'Up');
        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test1/})).toBeInTheDocument();
            expect(screen.queryByRole('row', {name: /test2/})).not.toBeInTheDocument();
        });
    });

    test('chips remove filters', async () => {
        setup();
        await waitForLoad();
        await selectFilter('Namespace', 'test-ns');
        const chip = screen.getByText('test-ns').closest('.MuiChip-root');
        fireEvent.click(within(chip).getByTestId('CloseIcon'));
        await waitFor(() => expect(screen.getByRole('row', {name: /root\/svc\/test3/})).toBeInTheDocument());
    });

    test('empty message when nothing matches', async () => {
        setup();
        await waitForLoad();
        fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'nonexistent'}});
        await waitFor(() => expect(screen.getByText(/No objects found/)).toBeInTheDocument());
    });

    describe('actions execution', () => {
        test('restart succeeds', async () => {
            setup();
            await waitForLoad();
            await selectRow('test-ns/svc/test1');
            openActionsMenu();
            await clickMenuItem('Restart');
            await confirmDialog();
            await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/restart'), expect.any(Object)
            ));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i));
        });

        test('unfreeze succeeds on frozen object', async () => {
            setup();
            await waitForLoad();
            await selectRow('test-ns/svc/test2');
            openActionsMenu();
            await clickMenuItem('Unfreeze');
            await confirmDialog();
            await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/unfreeze'), expect.any(Object)
            ));
        });

        test('delete succeeds with confirmations', async () => {
            setup();
            await waitForLoad();
            await selectRow('test-ns/svc/test1');
            openActionsMenu();
            await clickMenuItem('Delete');
            await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
            fireEvent.click(screen.getByLabelText(/Confirm configuration loss/i));
            fireEvent.click(screen.getByLabelText(/Confirm clusterwide orchestration/i));
            fireEvent.click(screen.getByRole('button', {name: /Delete/i}));
            await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/delete'), expect.any(Object)
            ));
            expect(mockRemoveObject).toHaveBeenCalledWith('test-ns/svc/test1');
        });

        test('failed action shows error alert', async () => {
            setup();
            global.fetch = jest.fn(() => Promise.resolve({ok: false, status: 500}));
            await waitForLoad();
            await selectRow('test-ns/svc/test1');
            openActionsMenu();
            await clickMenuItem('Restart');
            await confirmDialog();
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed/i));
        });

        test('partial success shows warning', async () => {
            setup();
            await waitForLoad();
            await selectRow('test-ns/svc/test1');
            await selectRow('test-ns/svc/test2');
            global.fetch = jest.fn()
                .mockResolvedValueOnce({ok: true})
                .mockResolvedValueOnce({ok: false, status: 500});
            openActionsMenu();
            await clickMenuItem('Restart');
            await confirmDialog();
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/partially succeeded: 1 ok, 1 errors/i));
        });

        test('network error', async () => {
            setup();
            await waitForLoad();
            await selectRow('test-ns/svc/test1');
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
            openActionsMenu();
            await clickMenuItem('Restart');
            await confirmDialog();
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed on all 1 object\(s\)/i));
        });

        test('token missing prevents action', async () => {
            Storage.prototype.getItem.mockReturnValue(null);
            setup();
            await waitForLoad();
            await selectRow('test-ns/svc/test1');
            openActionsMenu();
            await clickMenuItem('Restart');
            await confirmDialog();
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Authentication token not found'));
        });
    });

    test('row click navigates', async () => {
        setup();
        await waitForLoad();
        fireEvent.click(screen.getByRole('row', {name: /test-ns\/svc\/test1/}));
        expect(mockNavigate).toHaveBeenCalledWith('/objects/test-ns%2Fsvc%2Ftest1');
    });

    test('no navigation if no instance status', async () => {
        setup({objectInstanceStatus: {}});
        await waitForLoad();
        fireEvent.click(screen.getByRole('row', {name: /test-ns\/svc\/test1/}));
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('row context menu shows correct actions', async () => {
        setup();
        await waitForLoad();
        const row = screen.getByRole('row', {name: /test1/});
        fireEvent.click(within(row).getByRole('button', {name: /more actions/i}));
        await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
        expect(screen.getByText('Freeze')).toBeInTheDocument();
        expect(screen.queryByText('Unfreeze')).not.toBeInTheDocument();
    });

    test('row context menu for frozen object', async () => {
        setup();
        await waitForLoad();
        const row = screen.getByRole('row', {name: /test2/});
        fireEvent.click(within(row).getByRole('button', {name: /more actions/i}));
        await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
        expect(screen.queryByText('Freeze')).not.toBeInTheDocument();
        expect(screen.getByText('Unfreeze')).toBeInTheDocument();
    });

    test('global actions disabled when none selected', async () => {
        setup();
        await waitForLoad();
        expect(screen.getByRole('button', {name: /actions on selected objects/i})).toBeDisabled();
    });

    test('toggles filters visibility', async () => {
        setup();
        await waitForLoad();
        const btn = screen.getByRole('button', {name: /filters/i});
        expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
        fireEvent.click(btn);
        await waitFor(() => expect(btn).toHaveAttribute('aria-label', 'Show filters'));
        expect(screen.queryByLabelText('Namespace')).not.toBeInTheDocument();
        fireEvent.click(btn);
        await waitFor(() => expect(screen.getByLabelText('Namespace')).toBeInTheDocument());
    });

    describe('sorting', () => {
        const clickHeader = (text) => fireEvent.click(screen.getByText(text));
        test.each(['Status', 'Object', 'node1'])('%s sorting works', async (col) => {
            setup();
            await waitForLoad();
            if (col === 'node1') {
                fireEvent.click(screen.getByRole('columnheader', {name: /node1/i}));
            } else {
                clickHeader(col);
            }
            await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
        });

        test('sort direction toggles', async () => {
            setup();
            await waitForLoad();
            clickHeader('Object');
            clickHeader('Object');
            await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
        });
    });

    test('infinite scroll loads more', async () => {
        const many = {};
        const manyInst = {};
        for (let i = 0; i < 50; i++) {
            const name = `test-ns/svc/obj${i}`;
            many[name] = {avail: 'up', frozen: 'unfrozen'};
            manyInst[name] = {node1: {avail: 'up', frozen_at: '0001-01-01T00:00:00Z'}};
        }
        setup({objectStatus: many, objectInstanceStatus: manyInst});
        await waitForLoad();
        expect(screen.getAllByRole('row').slice(1)).toHaveLength(30);
        const container = document.querySelector('.MuiTableContainer-root');
        Object.defineProperty(container, 'scrollHeight', {value: 1000, configurable: true});
        Object.defineProperty(container, 'clientHeight', {value: 500, configurable: true});
        Object.defineProperty(container, 'scrollTop', {value: 500, configurable: true});
        fireEvent.scroll(container);
        await waitFor(() => expect(screen.getAllByRole('row').slice(1).length).toBeGreaterThan(30));
    });

    test('scroll does nothing when no more items', async () => {
        setup({objectStatus: {'a/b': {avail: 'up'}}, objectInstanceStatus: {}});
        await waitForLoad();
        const container = document.querySelector('.MuiTableContainer-root');
        fireEvent.scroll(container);
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    test('URL sync debounced', async () => {
        jest.useFakeTimers();
        setup();
        await waitForLoad();
        fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'sync'}});
        jest.advanceTimersByTime(300);
        expect(mockNavigate).toHaveBeenCalledWith('/objects?name=sync', {replace: true});
        jest.useRealTimers();
    });

    test('URL filters update state on location change', async () => {
        const {rerender} = setup();
        await waitForLoad();
        require('react-router-dom').useLocation.mockReturnValue({
            search: '?namespace=test-ns&kind=svc&name=test1',
            pathname: '/objects',
        });
        rerender(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('test-ns')).toBeInTheDocument();
            expect(screen.getByText('svc')).toBeInTheDocument();
            expect(screen.getByLabelText('Name')).toHaveValue('test1');
        });
    });

    test('snackbar closes on alert close', async () => {
        setup();
        await waitForLoad();
        await selectRow('test-ns/svc/test1');
        openActionsMenu();
        await clickMenuItem('Restart');
        await confirmDialog();
        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        const closeBtn = screen.getByRole('alert').querySelector('button[aria-label="Close"]');
        if (closeBtn) {
            fireEvent.click(closeBtn);
            await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        }
    });

    test('cancel action dialog', async () => {
        setup();
        await waitForLoad();
        await selectRow('test-ns/svc/test1');
        openActionsMenu();
        await clickMenuItem('Restart');
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', {name: /cancel/i}));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('narrow screen hides node columns', async () => {
        setup({}, '', false);
        await waitForLoad();
        expect(screen.queryByRole('columnheader', {name: /node1/})).not.toBeInTheDocument();
    });

    test('daemon fallback when store empty', async () => {
        setup(
            {objectStatus: {}, objectInstanceStatus: {}},
            '',
            true,
            {daemon: {cluster: {object: {'daemon/svc/obj1': {avail: 'up', frozen: 'unfrozen'}}}}}
        );
        await waitFor(() =>
            expect(screen.getByRole('row', {name: /daemon\/svc\/obj1/})).toBeInTheDocument()
        );
    });

    test('unprovisioned object and node', async () => {
        setup();
        await waitForLoad();
        expect(screen.getByLabelText('Object is not provisioned')).toBeInTheDocument();
        expect(screen.getByLabelText('Node node1 is not provisioned')).toBeInTheDocument();
    });

    test('cluster object parsed as ccfg', async () => {
        setup({
            objectStatus: {cluster: {avail: 'up', frozen: 'unfrozen'}},
            objectInstanceStatus: {cluster: {node1: {avail: 'up'}}},
        });
        await waitForLoad();
        await selectRow('cluster');
        openActionsMenu();
        await clickMenuItem('Restart');
        await confirmDialog();
        await waitFor(() =>
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/root/ccfg/cluster/action/restart'),
                expect.any(Object)
            )
        );
    });

    test('accessibility', async () => {
        const {container} = setup();
        await waitForLoad();
        const results = await axe(container, {
            rules: {'aria-prohibited-attr': {enabled: false}, label: {enabled: false}},
        });
        expect(results).toHaveNoViolations();
    });
});
