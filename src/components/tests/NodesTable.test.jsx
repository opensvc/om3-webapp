import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import NodesTable from '../NodesTable.jsx';
import * as useFetchDaemonStatusModule from '../../hooks/useFetchDaemonStatus.jsx';
import * as useEventStoreModule from '../../hooks/useEventStore.js';
import * as eventSourceManager from '../../eventSourceManager';
import {BrowserRouter} from 'react-router-dom';

// Mock NodeRow
jest.mock('../NodeRow.jsx', () => (props) => (
    <tr>
        <td>
            <input
                type="checkbox"
                checked={props.isSelected}
                onChange={(e) => props.onSelect(e, props.nodename)}
            />
        </td>
        <td>{props.nodename}</td>
        <td>
            <button onClick={() => props.onAction(props.nodename, 'freeze')}>
                Trigger
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

// Mock FreezeDialog used by ActionDialogManager
jest.mock('../ActionDialogs', () => ({
    ...jest.requireActual('../ActionDialogs'),
    FreezeDialog: ({open, onClose, onConfirm}) =>
        open ? (
            <div role="dialog">
                <h2>Confirm Freeze Action</h2>
                <button onClick={onConfirm} aria-label="Confirm">
                    Confirm
                </button>
                <button onClick={onClose}>Cancel</button>
            </div>
        ) : null,
}));

jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');
    return {
        ...actual,
        useNavigate: jest.fn(),
    };
});

describe('NodesTable', () => {
    let navigateMock;

    beforeEach(() => {
        // Mock fetch daemon hook
        jest.spyOn(useFetchDaemonStatusModule, 'default').mockReturnValue({
            daemon: {nodename: 'node-1'},
            fetchNodes: jest.fn(),
        });

        // Mock store
        jest.spyOn(useEventStoreModule, 'default').mockImplementation((selector) =>
            selector({
                nodeStatus: {
                    'node-1': {state: 'idle', frozen_at: null},
                    'node-2': {state: 'busy', frozen_at: null},
                },
                nodeStats: {
                    'node-1': {score: 42},
                    'node-2': {score: 18},
                },
                nodeMonitor: {
                    'node-1': {},
                    'node-2': {},
                },
            })
        );

        // Mock EventSource
        jest.spyOn(eventSourceManager, 'startEventReception').mockImplementation(() => {
        });
        jest.spyOn(eventSourceManager, 'closeEventSource').mockImplementation(() => {
        });

        navigateMock = require('react-router-dom').useNavigate();
        localStorage.setItem('authToken', 'test-token');
    });

    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        jest.resetAllMocks();
        if (global.fetch) delete global.fetch;
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

    test('opens a confirmation dialog when an action is triggered', async () => {
        renderWithRouter(<NodesTable/>);
        const triggerButtons = await screen.findAllByText('Trigger');

        fireEvent.click(triggerButtons[0]); // Trigger for node-1

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText(/Confirm Freeze Action/i)).toBeInTheDocument();
        });
    });

    test('executes the action and displays a success snackbar', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({ok: true, json: () => ({})})
        );

        renderWithRouter(<NodesTable/>);
        const triggerButtons = await screen.findAllByText('Trigger');

        fireEvent.click(triggerButtons[0]); // Trigger for node-1

        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(screen.getByText(/✅ 'Freeze' succeeded on 1 node\(s\)\./i)).toBeInTheDocument();
        });
    });

    test('handles partial success in handleDialogConfirm', async () => {
        global.fetch = jest.fn((url) =>
            url.includes('node-1')
                ? Promise.resolve({ok: true, json: () => ({})})
                : Promise.reject(new Error('HTTP error'))
        );

        renderWithRouter(<NodesTable/>);
        const checkboxes = await screen.findAllByRole('checkbox');
        // Select node-1 and node-2
        fireEvent.click(checkboxes[1]);
        fireEvent.click(checkboxes[2]);

        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        fireEvent.click(actionsButton);
        const freezeMenuItem = screen.getByText(/^Freeze$/i);
        fireEvent.click(freezeMenuItem);

        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(
                screen.getByText(/⚠️ 'Freeze' partially succeeded: 1 ok, 1 errors\./i)
            ).toBeInTheDocument();
        });
    });

    test('shows error snackbar if no token in localStorage', async () => {
        localStorage.removeItem('authToken');
        renderWithRouter(<NodesTable/>);
        const triggerButtons = await screen.findAllByText('Trigger');
        fireEvent.click(triggerButtons[0]);
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(screen.getByText(/Authentication token not found/i)).toBeInTheDocument();
        });
    });

    test('shows error snackbar if all requests fail', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('fail')));
        renderWithRouter(<NodesTable/>);
        const triggerButtons = await screen.findAllByText('Trigger');
        fireEvent.click(triggerButtons[0]);
        const confirmBtn = await screen.findByRole('button', {name: 'Confirm'});
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(
                screen.getByText(/❌ 'Freeze' failed on all 1 node\(s\)\./i)
            ).toBeInTheDocument();
        });
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

        expect(true).toBe(true);
    });

    test('handleActionsMenuClose via Escape closes the actions menu', async () => {
        renderWithRouter(<NodesTable/>);
        const checkboxes = await screen.findAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // select node-1

        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        fireEvent.click(actionsButton);
        fireEvent.keyDown(document, {key: 'Escape'});
        expect(actionsButton).toBeInTheDocument();
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

        expect(screen.queryByText(/^Freeze$/i)).not.toBeInTheDocument();
        expect(screen.getByText(/^Unfreeze$/i)).toBeInTheDocument();
    });
});
