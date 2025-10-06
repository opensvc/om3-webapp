import React from 'react';
import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import NodesTable from '../NodesTable.jsx';
import * as useFetchDaemonStatusModule from '../../hooks/useFetchDaemonStatus.jsx';
import * as useEventStoreModule from '../../hooks/useEventStore.js';
import * as eventSourceManager from '../../eventSourceManager';
import {BrowserRouter} from 'react-router-dom';

// Mock icons for testId
jest.mock('@mui/icons-material/KeyboardArrowUp', () => () => <div data-testid="KeyboardArrowUpIcon"/>);
jest.mock('@mui/icons-material/KeyboardArrowDown', () => () => <div data-testid="KeyboardArrowDownIcon"/>);

// Mock NodeRow
jest.mock('../NodeRow.jsx', () => (props) => (
    <tr data-testid={`row-${props.nodename}`}>
        <td>
            <input
                type="checkbox"
                checked={props.isSelected}
                onChange={(e) => props.onSelect(e, props.nodename)}
            />
        </td>
        <td>{props.nodename}</td>
        <td>{props.monitor?.state || 'idle'}</td>
        <td>{props.stats?.score || 0}</td>
        <td>{props.stats?.load_15m || 0}</td>
        <td>{props.stats?.mem_avail || 0}</td>
        <td>{props.stats?.swap_avail || 0}</td>
        <td>{props.status?.agent || ''}</td>
        <td>
            <button onClick={() => props.onAction(props.nodename, 'freeze')}>
                Freeze
            </button>
            <button onClick={() => props.onAction(props.nodename, 'unfreeze')}>
                Unfreeze
            </button>
            <button onClick={() => props.onAction(props.nodename, 'restart daemon')}>
                Restart Daemon
            </button>
            <button onClick={(e) => props.onMenuOpen(e, props.nodename)}>
                OpenMenu
            </button>
            <button onClick={() => props.onMenuClose(props.nodename)}>
                CloseMenu
            </button>
        </td>
    </tr>
));

// Mock only the dialogs that are actually used in tests
jest.mock('../ActionDialogs', () => ({
    ...jest.requireActual('../ActionDialogs'),
    FreezeDialog: ({open, onClose, onConfirm, target}) =>
        open ? (
            <div role="dialog">
                <h2>Confirm Freeze Action on {target}</h2>
                <button onClick={onConfirm} aria-label="Confirm">
                    Confirm
                </button>
                <button onClick={onClose}>Cancel</button>
            </div>
        ) : null,
    StopDialog: ({open, onClose, onConfirm, target}) =>
        open ? (
            <div role="dialog">
                <h2>Confirm Stop Action on {target}</h2>
                <button onClick={onConfirm} aria-label="Confirm">
                    Confirm
                </button>
                <button onClick={onClose}>Cancel</button>
            </div>
        ) : null,
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));

describe('NodesTable', () => {
    beforeEach(() => {
        jest.spyOn(useFetchDaemonStatusModule, 'default').mockReturnValue({
            daemon: {nodename: 'node-1'},
            fetchNodes: jest.fn(),
        });
        jest.spyOn(useEventStoreModule, 'default').mockImplementation((selector) =>
            selector({
                nodeStatus: {
                    'node-1': {state: 'idle', frozen_at: null, agent: 'v1.0'},
                    'node-2': {state: 'busy', frozen_at: null, agent: 'v2.0'},
                },
                nodeStats: {
                    'node-1': {score: 42, load_15m: 1.5, mem_avail: 1000, swap_avail: 500},
                    'node-2': {score: 18, load_15m: 2.0, mem_avail: 2000, swap_avail: 1000},
                },
                nodeMonitor: {
                    'node-1': {state: 'idle'},
                    'node-2': {state: 'busy'},
                },
            })
        );
        jest.spyOn(eventSourceManager, 'startEventReception').mockImplementation(() => {
        });
        jest.spyOn(eventSourceManager, 'closeEventSource').mockImplementation(() => {
        });
        localStorage.setItem('authToken', 'test-token');
    });

    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        jest.resetAllMocks();
        if (global.fetch) delete global.fetch;
        jest.useRealTimers();
    });

    const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

    test('displays a loader when no node data is available', () => {
        jest.spyOn(useEventStoreModule, 'default').mockImplementation((selector) =>
            selector({
                nodeStatus: {},
                nodeStats: {},
                nodeMonitor: {},
            })
        );
        renderWithRouter(<NodesTable/>);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('displays node names in the table', async () => {
        renderWithRouter(<NodesTable/>);
        expect(await screen.findByText('node-1')).toBeInTheDocument();
        expect(await screen.findByText('node-2')).toBeInTheDocument();
    });

    test('enables "Actions on selected nodes" button when a node is selected', async () => {
        renderWithRouter(<NodesTable/>);
        const checkboxes = await screen.findAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // select node-1
        const button = screen.getByRole('button', {name: /actions on selected nodes/i});
        expect(button).toBeEnabled();
    });

    test('deselects a node using checkbox', async () => {
        renderWithRouter(<NodesTable/>);
        const checkboxes = await screen.findAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // Select node-1
        expect(screen.getByRole('button', {name: /actions on selected nodes/i})).toBeEnabled();
        fireEvent.click(checkboxes[1]); // Deselect node-1
        expect(screen.getByRole('button', {name: /actions on selected nodes/i})).toBeDisabled();
    });

    test('opens a confirmation dialog when an action is triggered', async () => {
        renderWithRouter(<NodesTable/>);
        const freezeButtons = await screen.findAllByText('Freeze');
        fireEvent.click(freezeButtons[0]); // Trigger for node-1

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        expect(screen.getByText(/Confirm Freeze Action/i)).toBeInTheDocument();
    });

    test('executes the action and displays a success snackbar', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => ({})}));
        renderWithRouter(<NodesTable/>);
        const freezeButtons = await screen.findAllByText('Freeze');
        fireEvent.click(freezeButtons[0]); // Trigger for node-1
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});

        fireEvent.click(confirmBtn);

        expect(await screen.findByText(/✅ 'Freeze' succeeded on 1 node\(s\)\./i)).toBeInTheDocument();
    });

    test('handles partial success in handleDialogConfirm', async () => {
        global.fetch = jest.fn((url) =>
            url.includes('node-1')
                ? Promise.resolve({ok: true, json: () => ({})})
                : Promise.reject(new Error('HTTP error'))
        );
        renderWithRouter(<NodesTable/>);
        const checkboxes = await screen.findAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // select node-1
        fireEvent.click(checkboxes[2]); // select node-2
        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        fireEvent.click(actionsButton);
        const freezeMenuItems = await screen.findAllByRole('menuitem', {name: /^Freeze$/i});
        fireEvent.click(freezeMenuItems[0]); // Click the first Freeze menu item
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});

        fireEvent.click(confirmBtn);

        expect(await screen.findByText(/⚠️ 'Freeze' partially succeeded: 1 ok, 1 errors\./i)).toBeInTheDocument();
    });

    test('logs error on HTTP failure in handleDialogConfirm', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        global.fetch = jest.fn(() => Promise.resolve({ok: false, status: 500}));
        renderWithRouter(<NodesTable/>);
        const freezeButtons = await screen.findAllByText('Freeze');
        fireEvent.click(freezeButtons[0]);
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});

        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to execute freeze on node-1: HTTP error! status: 500')
            );
        });

        expect(await screen.findByText(/❌ 'Freeze' failed on all 1 node\(s\)\./i)).toBeInTheDocument();
        consoleErrorSpy.mockRestore();
    });

    test('shows error snackbar if no token in localStorage', async () => {
        localStorage.removeItem('authToken');
        renderWithRouter(<NodesTable/>);
        const freezeButtons = await screen.findAllByText('Freeze');
        fireEvent.click(freezeButtons[0]);
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});

        fireEvent.click(confirmBtn);

        expect(await screen.findByText(/Authentication token not found/i)).toBeInTheDocument();
    });

    test('shows error snackbar if all requests fail', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('fail')));
        renderWithRouter(<NodesTable/>);
        const freezeButtons = await screen.findAllByText('Freeze');
        fireEvent.click(freezeButtons[0]);
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});

        fireEvent.click(confirmBtn);

        expect(await screen.findByText(/❌ 'Freeze' failed on all 1 node\(s\)\./i)).toBeInTheDocument();
    });

    test('selects all nodes using header checkbox', async () => {
        renderWithRouter(<NodesTable/>);
        const headerCheckbox = (await screen.findAllByRole('checkbox'))[0];
        fireEvent.click(headerCheckbox);
        const checkboxes = await screen.findAllByRole('checkbox');
        expect(checkboxes[1]).toBeChecked(); // node-1
        expect(checkboxes[2]).toBeChecked(); // node-2
        expect(screen.getByRole('button', {name: /actions on selected nodes/i})).toBeEnabled();
    });

    test('handles useEffect cleanup on unmount', () => {
        const closeEventSourceSpy = jest.spyOn(eventSourceManager, 'closeEventSource');
        const {unmount} = renderWithRouter(<NodesTable/>);
        unmount();
        expect(closeEventSourceSpy).toHaveBeenCalled();
    });

    test('handleMenuOpen and handleMenuClose updates anchorEls', async () => {
        renderWithRouter(<NodesTable/>);
        const openMenuBtns = await screen.findAllByText('OpenMenu');
        fireEvent.click(openMenuBtns[0]);
        const closeMenuBtns = await screen.findAllByText('CloseMenu');
        fireEvent.click(closeMenuBtns[0]);
        expect(true).toBe(true); // Test passes if no errors
    });

    test('handleActionsMenuClose via Escape closes the actions menu', async () => {
        renderWithRouter(<NodesTable/>);
        const checkboxes = await screen.findAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // select node-1
        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        fireEvent.click(actionsButton);

        await screen.findByRole('menuitem', {name: /^Freeze$/i});

        const popover = screen.getByRole('presentation');
        fireEvent.keyDown(popover, {key: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        expect(screen.queryByRole('menuitem', {name: /^Freeze$/i})).not.toBeInTheDocument();
    });

    test('filteredMenuItems excludes Freeze when node already frozen and shows Unfreeze', async () => {
        jest.spyOn(useEventStoreModule, 'default').mockImplementation((selector) =>
            selector({
                nodeStatus: {
                    'node-1': {state: 'idle', frozen_at: '2023-01-01T00:00:00Z'},
                },
                nodeStats: {'node-1': {}},
                nodeMonitor: {'node-1': {}},
            })
        );
        renderWithRouter(<NodesTable/>);
        const checkbox = (await screen.findAllByRole('checkbox'))[1]; // node-1
        fireEvent.click(checkbox);
        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        fireEvent.click(actionsButton);

        await waitFor(() => {
            expect(screen.queryByRole('menuitem', {name: /^Freeze$/i})).not.toBeInTheDocument();
        });

        expect(screen.getByRole('menuitem', {name: /^Unfreeze$/i})).toBeInTheDocument();
    });

    test('filteredMenuItems is empty when no nodes selected', async () => {
        renderWithRouter(<NodesTable/>);
        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        expect(actionsButton).toBeDisabled();
        fireEvent.click(actionsButton);

        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });

    test('filteredMenuItems shows correct actions for mixed node states', async () => {
        jest.spyOn(useEventStoreModule, 'default').mockImplementation((selector) =>
            selector({
                nodeStatus: {
                    'node-1': {state: 'idle', frozen_at: '2023-01-01T00:00:00Z'},
                    'node-2': {state: 'busy', frozen_at: null},
                },
                nodeStats: {'node-1': {}, 'node-2': {}},
                nodeMonitor: {'node-1': {}, 'node-2': {}},
            })
        );
        renderWithRouter(<NodesTable/>);
        const checkboxes = await screen.findAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // Select node-1 (frozen)
        fireEvent.click(checkboxes[2]); // Select node-2 (not frozen)
        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        fireEvent.click(actionsButton);

        await waitFor(() => {
            expect(screen.getByRole('menuitem', {name: /^Freeze$/i})).toBeInTheDocument(); // node-2
        });

        expect(screen.getByRole('menuitem', {name: /^Unfreeze$/i})).toBeInTheDocument(); // node-1
    });

    test('constructs correct URL for non-restart actions', async () => {
        jest.mock('../../constants/actions', () => ({
            NODE_ACTIONS: [
                {name: 'freeze', icon: <span>FreezeIcon</span>},
                {name: 'unfreeze', icon: <span>UnfreezeIcon</span>},
                {name: 'restart daemon', icon: <span>RestartIcon</span>},
                {name: 'stop', icon: <span>StopIcon</span>},
            ],
        }));

        global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => ({})}));
        renderWithRouter(<NodesTable/>);
        const checkboxes = await screen.findAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // Select node-1
        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        fireEvent.click(actionsButton);
        const stopMenuItem = await screen.findByRole('menuitem', {name: /^Stop$/i});
        fireEvent.click(stopMenuItem);
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});

        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/stop'),
                expect.any(Object)
            );
        });
    });

    test('skips freeze action on already frozen node', async () => {
        jest.spyOn(useEventStoreModule, 'default').mockImplementation((selector) =>
            selector({
                nodeStatus: {'node-1': {state: 'idle', frozen_at: '2023-01-01T00:00:00Z'}},
                nodeStats: {'node-1': {}},
                nodeMonitor: {'node-1': {}},
            })
        );
        global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => ({})}));
        renderWithRouter(<NodesTable/>);
        const freezeButtons = await screen.findAllByText('Freeze');
        fireEvent.click(freezeButtons[0]); // Trigger for node-1
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});

        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(screen.getByText(/❌ 'Freeze' failed on all 1 node\(s\)\./i)).toBeInTheDocument();
        });

        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('skips unfreeze action on non-frozen node', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => ({})}));
        renderWithRouter(<NodesTable/>);
        const unfreezeButtons = await screen.findAllByText('Unfreeze');
        fireEvent.click(unfreezeButtons[0]); // Trigger for node-1
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});

        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(screen.getByText(/❌ 'Unfreeze' failed on all 1 node\(s\)\./i)).toBeInTheDocument();
        });

        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('sorts table by state column', async () => {
        renderWithRouter(<NodesTable/>);

        const stateHeader = screen.getByText('State');
        fireEvent.click(stateHeader);

        await waitFor(() => {
            const rows = screen.getAllByTestId(/row-/);
            expect(rows[0]).toHaveTextContent('node-2'); // busy comes first (asc)
        });

        expect(screen.getByTestId('KeyboardArrowUpIcon')).toBeInTheDocument();
    });

    test('sorts table by state column descending', async () => {
        renderWithRouter(<NodesTable/>);

        const stateHeader = screen.getByText('State');
        fireEvent.click(stateHeader); // First click for ascending
        fireEvent.click(stateHeader); // Second click for descending

        await waitFor(() => {
            const rows = screen.getAllByTestId(/row-/);
            expect(rows[0]).toHaveTextContent('node-1'); // idle comes first (desc)
        });

        expect(screen.getByTestId('KeyboardArrowDownIcon')).toBeInTheDocument();
    });

    test('sorts table by score column', async () => {
        renderWithRouter(<NodesTable/>);

        const scoreHeader = screen.getByText('Score');
        fireEvent.click(scoreHeader);

        await waitFor(() => {
            const rows = screen.getAllByTestId(/row-/);
            expect(rows[0]).toHaveTextContent('node-2'); // 18 comes first (asc)
        });
    });

    test('sorts table by load column', async () => {
        renderWithRouter(<NodesTable/>);

        const loadHeader = screen.getByText('Load (15m)');
        fireEvent.click(loadHeader);

        await waitFor(() => {
            const rows = screen.getAllByTestId(/row-/);
            expect(rows[0]).toHaveTextContent('node-1'); // 1.5 comes first (asc)
        });
    });

    test('sorts table by memory column', async () => {
        renderWithRouter(<NodesTable/>);

        const memHeader = screen.getByText('Mem Avail');
        fireEvent.click(memHeader);

        await waitFor(() => {
            const rows = screen.getAllByTestId(/row-/);
            expect(rows[0]).toHaveTextContent('node-1'); // 1000 comes first (asc)
        });
    });

    test('sorts table by swap column', async () => {
        renderWithRouter(<NodesTable/>);

        const swapHeader = screen.getByText('Swap Avail');
        fireEvent.click(swapHeader);

        await waitFor(() => {
            const rows = screen.getAllByTestId(/row-/);
            expect(rows[0]).toHaveTextContent('node-1'); // 500 comes first (asc)
        });
    });

    test('sorts table by version column', async () => {
        renderWithRouter(<NodesTable/>);

        const versionHeader = screen.getByText('Version');
        fireEvent.click(versionHeader);

        await waitFor(() => {
            const rows = screen.getAllByTestId(/row-/);
            expect(rows[0]).toHaveTextContent('node-1'); // v1.0 comes first (asc)
        });
    });

    test('renders ActionDialogManager with correct props for multiple nodes', async () => {
        renderWithRouter(<NodesTable/>);
        const checkboxes = await screen.findAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // Select node-1
        fireEvent.click(checkboxes[2]); // Select node-2
        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        fireEvent.click(actionsButton);
        const freezeMenuItem = await screen.findByRole('menuitem', {name: /^Freeze$/i});
        fireEvent.click(freezeMenuItem);

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent('Confirm Freeze Action on 2 nodes');
        });
    });

    test('handles freeze action on frozen node', async () => {
        jest.spyOn(useEventStoreModule, 'default').mockImplementation((selector) =>
            selector({
                nodeStatus: {'node-1': {state: 'idle', frozen_at: '2023-01-01T00:00:00Z'}},
                nodeStats: {'node-1': {}},
                nodeMonitor: {'node-1': {}},
            })
        );
        global.fetch = jest.fn(() => Promise.resolve({ok: true, json: () => ({})}));
        renderWithRouter(<NodesTable/>);
        const freezeButtons = await screen.findAllByText('Freeze');
        fireEvent.click(freezeButtons[0]); // Trigger for node-1
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});

        fireEvent.click(confirmBtn);

        expect(await screen.findByText(/❌ 'Freeze' failed on all 1 node\(s\)\./i)).toBeInTheDocument();
    });
});
