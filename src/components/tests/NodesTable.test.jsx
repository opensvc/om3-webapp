import React from 'react';
import {render, screen, fireEvent, waitFor, within, act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {blue} from '@mui/material/colors';
import NodesTable from '../NodesTable';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus.jsx';
import useEventStore from '../../hooks/useEventStore.js';
import {closeEventSource} from '../../eventSourceManager';
import NodeRow from '../../components/NodeRow.jsx';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));
jest.mock('../../hooks/useFetchDaemonStatus.jsx');
jest.mock('../../hooks/useEventStore.js');
jest.mock('../../eventSourceManager', () => ({
    closeEventSource: jest.fn(),
    startEventReception: jest.fn(),
}));
jest.mock('../../components/NodeRow.jsx', () => {
    return jest.fn(({nodename, isSelected, onSelect, onMenuOpen, onMenuClose, onAction, anchorEl}) => (
        <tr data-testid={`node-row-${nodename}`}>
            <td>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelect(e, nodename)}
                    data-testid={`checkbox-${nodename}`}
                />
            </td>
            <td>{nodename}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>
                <button
                    data-testid={`menu-button-${nodename}`}
                    onClick={(e) => onMenuOpen(e, nodename)}
                >
                    Menu
                </button>
                {anchorEl && (
                    <div data-testid={`menu-${nodename}`}>
                        <div
                            data-testid={`menu-item-freeze-${nodename}`}
                            onClick={() => onAction(nodename, 'action/freeze')}
                        >
                            Freeze
                        </div>
                        <div
                            data-testid={`menu-item-unfreeze-${nodename}`}
                            onClick={() => onAction(nodename, 'action/unfreeze')}
                        >
                            Unfreeze
                        </div>
                        <div
                            data-testid={`menu-item-restart-${nodename}`}
                            onClick={() => onAction(nodename, 'daemon/action/restart')}
                        >
                            Restart Daemon
                        </div>
                    </div>
                )}
            </td>
        </tr>
    ));
});

// Mock Material-UI components to add data-testid
jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    TableHead: ({children, ...props}) => <thead data-testid="table-head" {...props}>{children}</thead>,
    TableCell: ({children, ...props}) => <td {...props}>{children}</td>,
    TableRow: ({children, ...props}) => <tr {...props}>{children}</tr>,
    Checkbox: ({checked, onChange, ...props}) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            data-testid="header-checkbox"
            {...props}
        />
    ),
    Snackbar: ({children, ...props}) => <div data-testid="snackbar" {...props}>{children}</div>,
    Alert: ({children, ...props}) => <div role="alert" data-testid="alert" {...props}>{children}</div>,
}));

describe('NodesTable Component', () => {
    const mockNavigate = jest.fn();
    const mockFetchNodes = jest.fn();
    const mockStartEventReception = jest.fn();
    const mockCloseEventSource = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock useNavigate
        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);

        // Mock useFetchDaemonStatus
        useFetchDaemonStatus.mockReturnValue({
            daemon: {nodename: 'node1'},
            fetchNodes: mockFetchNodes,
            startEventReception: mockStartEventReception,
        });

        // Mock useEventStore
        const mockState = {
            nodeStatus: {
                node1: {frozen_at: null, agent: 'v1.2.3'},
                node2: {frozen_at: '2023-01-01T12:00:00Z', agent: 'v1.2.4'},
            },
            nodeStats: {
                node1: {score: 85, load_15m: 1.5, mem_avail: 60, swap_avail: 75},
                node2: {score: 90, load_15m: 2.0, mem_avail: 50, swap_avail: 80},
            },
            nodeMonitor: {
                node1: {state: 'running'},
                node2: {state: 'idle'},
            },
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        // Mock localStorage
        Storage.prototype.getItem = jest.fn(() => 'mock-token');

        // Mock fetch
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            })
        );

        // Link mockCloseEventSource to the module mock
        require('../../eventSourceManager').closeEventSource.mockImplementation(mockCloseEventSource);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders Node Status title', () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        expect(screen.getByText('Node Status')).toBeInTheDocument();
    });

    test('shows CircularProgress when nodeStatus is empty', () => {
        useEventStore.mockImplementation((selector) =>
            selector({nodeStatus: {}, nodeStats: {}, nodeMonitor: {}})
        );
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    test('renders table with headers and NodeRow components', async () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        await waitFor(() => {
            const tableHead = screen.getByTestId('table-head');
            expect(within(tableHead).getByText('Name')).toBeInTheDocument();
            expect(within(tableHead).getByText('State')).toBeInTheDocument();
            expect(within(tableHead).getByText('Score')).toBeInTheDocument();
            expect(within(tableHead).getByText('Load (15m)')).toBeInTheDocument();
            expect(within(tableHead).getByText('Mem Avail')).toBeInTheDocument();
            expect(within(tableHead).getByText('Swap Avail')).toBeInTheDocument();
            expect(within(tableHead).getByText('Version')).toBeInTheDocument();
            expect(within(tableHead).getByText('Action')).toBeInTheDocument();

            expect(screen.getByTestId('node-row-node1')).toBeInTheDocument();
            expect(screen.getByTestId('node-row-node2')).toBeInTheDocument();
        }, {timeout: 3000});
    });

    test('calls fetchNodes and startEventReception on mount', () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        expect(mockFetchNodes).toHaveBeenCalledWith('mock-token');
        expect(mockStartEventReception).toHaveBeenCalledWith('mock-token');
    });

    test('calls closeEventSource on unmount', async () => {
        const {unmount} = render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        await act(async () => {
            unmount();
        });
        // Debug log
        await waitFor(() => {
            expect(mockCloseEventSource).toHaveBeenCalled();
        }, {timeout: 3000});
    });

    test('does not call fetchNodes or startEventReception without auth token', () => {
        Storage.prototype.getItem = jest.fn(() => null);
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        expect(mockFetchNodes).not.toBeCalled();
        expect(mockStartEventReception).not.toBeCalled();
    });

    test('disables Actions button when no nodes are selected', () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        const actionsButton = screen.getByText('Actions on selected nodes');
        expect(actionsButton).toBeDisabled();
    });

    test('enables Actions button when nodes are selected', async () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        const checkbox = screen.getByTestId('checkbox-node1');
        fireEvent.click(checkbox);
        await waitFor(() => {
            const actionsButton = screen.getByText('Actions on selected nodes');
            expect(actionsButton).not.toBeDisabled();
        }, {timeout: 3000});
    });

    test('opens actions menu when Actions button is clicked', async () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        const checkbox = screen.getByTestId('checkbox-node1');
        fireEvent.click(checkbox);
        const actionsButton = screen.getByText('Actions on selected nodes');
        fireEvent.click(actionsButton);
        await waitFor(() => {
            expect(screen.getByText('Freeze')).toBeInTheDocument();
            expect(screen.getByText('Unfreeze')).toBeInTheDocument();
            expect(screen.getByText('Restart Daemon')).toBeInTheDocument();
        }, {timeout: 3000});
    });

    test('opens confirmation dialog when menu item is clicked', async () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        const checkbox = screen.getByTestId('checkbox-node1');
        fireEvent.click(checkbox);
        const actionsButton = screen.getByText('Actions on selected nodes');
        fireEvent.click(actionsButton);
        const freezeItem = screen.getByText('Freeze');
        fireEvent.click(freezeItem);
        await waitFor(() => {
            expect(screen.getByText('Confirm action/freeze Action')).toBeInTheDocument();
            const dialog = screen.getByRole('dialog');
            const dialogText = within(dialog).getByText(/Are you sure you want to execute/i);
            expect(dialogText.textContent).toContain('action/freeze');
            expect(dialogText.textContent).toContain('node1');
        }, {timeout: 3000});
    });

    test('executes action and shows success snackbar', async () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        const checkbox = screen.getByTestId('checkbox-node1');
        fireEvent.click(checkbox);
        const actionsButton = screen.getByText('Actions on selected nodes');
        fireEvent.click(actionsButton);
        const freezeItem = screen.getByText('Freeze');
        fireEvent.click(freezeItem);
        const confirmButton = screen.getByText('OK');
        fireEvent.click(confirmButton);
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node1/action/freeze'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
            const alert = screen.getByRole('alert');
            expect(alert.textContent).toMatch(/action\/freeze on node1 succeeded/i);
        }, {timeout: 3000});
    });

    test('shows error snackbar when action fails', async () => {
        global.fetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({}),
            })
        );
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        const checkbox = screen.getByTestId('checkbox-node1');
        fireEvent.click(checkbox);
        const actionsButton = screen.getByText('Actions on selected nodes');
        fireEvent.click(actionsButton);
        const freezeItem = screen.getByText('Freeze');
        fireEvent.click(freezeItem);
        const confirmButton = screen.getByText('OK');
        fireEvent.click(confirmButton);
        await waitFor(() => {
            const alert = screen.getByRole('alert');
            expect(alert.textContent).toMatch(/action\/freeze on node1 failed/i);
        }, {timeout: 3000});
    });

    test('selects all nodes with header checkbox', async () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        const tableHead = screen.getByTestId('table-head');
        const headerCheckbox = within(tableHead).getByTestId('header-checkbox');
        fireEvent.click(headerCheckbox);
        await waitFor(() => {
            expect(screen.getByTestId('checkbox-node1')).toBeChecked();
            expect(screen.getByTestId('checkbox-node2')).toBeChecked();
        }, {timeout: 3000});
    });

    test('deselects all nodes with header checkbox', async () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        const tableHead = screen.getByTestId('table-head');
        const headerCheckbox = within(tableHead).getByTestId('header-checkbox');
        fireEvent.click(headerCheckbox); // Select all
        fireEvent.click(headerCheckbox); // Deselect all
        await waitFor(() => {
            expect(screen.getByTestId('checkbox-node1')).not.toBeChecked();
            expect(screen.getByTestId('checkbox-node2')).not.toBeChecked();
        }, {timeout: 3000});
    });

    test('executes action on multiple nodes', async () => {
        // Mock fetch to handle multiple calls
        global.fetch = jest.fn()
            .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({})}) // node1
            .mockResolvedValueOnce({ok: true, json: () => Promise.resolve({})}); // node2

        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        fireEvent.click(screen.getByTestId('checkbox-node1'));
        fireEvent.click(screen.getByTestId('checkbox-node2'));
        const actionsButton = screen.getByText('Actions on selected nodes');
        fireEvent.click(actionsButton);
        const freezeItem = screen.getByText('Freeze');
        fireEvent.click(freezeItem);
        await waitFor(() => {
            expect(screen.getByText('Confirm action/freeze Action')).toBeInTheDocument();
            const dialog = screen.getByRole('dialog');
            const dialogText = within(dialog).getByText(/Are you sure you want to execute/i);
            expect(dialogText.textContent).toContain('action/freeze');
            expect(dialogText.textContent).toContain('2 nodes');
        }, {timeout: 3000});
        const confirmButton = screen.getByText('OK');
        fireEvent.click(confirmButton);
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node1/action/freeze'),
                expect.any(Object)
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node2/action/freeze'),
                expect.any(Object)
            );
            const alert = screen.getByRole('alert');
            expect(alert.textContent).toMatch(/action\/freeze on node2 succeeded/i);
        }, {timeout: 3000});
    });

    test('closes confirmation dialog on cancel', async () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        fireEvent.click(screen.getByTestId('checkbox-node1'));
        const actionsButton = screen.getByText('Actions on selected nodes');
        fireEvent.click(actionsButton);
        const freezeItem = screen.getByText('Freeze');
        fireEvent.click(freezeItem);
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
        await waitFor(() => {
            expect(screen.queryByText('Confirm action/freeze Action')).not.toBeInTheDocument();
        }, {timeout: 3000});
    });

    test('triggers action from NodeRow menu', async () => {
        render(
            <MemoryRouter>
                <NodesTable/>
            </MemoryRouter>
        );
        const menuButton = screen.getByTestId('menu-button-node1');
        fireEvent.click(menuButton);
        const freezeItem = screen.getByTestId('menu-item-freeze-node1');
        fireEvent.click(freezeItem);
        await waitFor(() => {
            expect(screen.getByText('Confirm action/freeze Action')).toBeInTheDocument();
            const dialog = screen.getByRole('dialog');
            const dialogText = within(dialog).getByText(/Are you sure you want to execute/i);
            expect(dialogText.textContent).toContain('action/freeze');
            expect(dialogText.textContent).toContain('node1');
        }, {timeout: 3000});
        const confirmButton = screen.getByText('OK');
        fireEvent.click(confirmButton);
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node1/action/freeze'),
                expect.any(Object)
            );
            const alert = screen.getByRole('alert');
            expect(alert.textContent).toMatch(/action\/freeze on node1 succeeded/i);
        }, {timeout: 3000});
    });
});