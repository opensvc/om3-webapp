import React, {act} from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {green, red, orange, blue} from '@mui/material/colors';
import {axe, toHaveNoViolations} from 'jest-axe';
import Objects from '../Objects';
import useEventStore from '../../hooks/useEventStore';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus';
import {closeEventSource, startEventReception} from '../../eventSourceManager';

// Mock dependencies
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

const AVAILABLE_ACTIONS = [
    'start',
    'stop',
    'restart',
    'freeze',
    'unfreeze',
    'delete',
    'provision',
    'unprovision',
    'purge',
    'switch',
    'giveback',
    'abort',
];

expect.extend(toHaveNoViolations);

describe('Objects Component', () => {
    const mockNavigate = jest.fn();
    const mockStartEventReception = jest.fn();
    const mockCloseEventSource = jest.fn();
    const mockRemoveObject = jest.fn();
    const allNodes = ['node1', 'node2'];

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock location and navigation
        require('react-router-dom').useLocation.mockReturnValue({
            search: '',
            state: {namespace: 'all'},
        });
        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);

        // Mock useMediaQuery
        require('@mui/material/useMediaQuery').mockReturnValue(true);

        // Mock useEventStore
        const mockState = {
            objectStatus: {
                'test-ns/svc/test1': {avail: 'up', frozen: 'unfrozen'},
                'test-ns/svc/test2': {avail: 'down', frozen: 'frozen'},
                'root/svc/test3': {avail: 'warn', frozen: 'unfrozen'},
            },
            objectInstanceStatus: {
                'test-ns/svc/test1': {
                    node1: {avail: 'up', frozen_at: '0001-01-01T00:00:00Z'},
                    node2: {avail: 'down', frozen_at: '2025-05-16T10:00:00Z'},
                },
                'test-ns/svc/test2': {
                    node1: {avail: 'down', frozen_at: '2025-05-16T10:00:00Z'},
                },
                'root/svc/test3': {
                    node2: {avail: 'warn', frozen_at: '0001-01-01T00:00:00Z'},
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
        useEventStore.mockImplementation((selector) => selector(mockState));

        // Mock useFetchDaemonStatus
        useFetchDaemonStatus.mockReturnValue({
            daemon: {cluster: {object: {}}},
        });

        // Mock eventSourceManager
        startEventReception.mockImplementation(mockStartEventReception);
        closeEventSource.mockImplementation(mockCloseEventSource);

        // Mock localStorage
        jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('mock-token');

        // Mock fetch
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            })
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders correctly with initial state', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Objects')).toBeInTheDocument();
            expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
            expect(screen.getByLabelText('Kind')).toBeInTheDocument();
            expect(screen.getByLabelText('Name')).toBeInTheDocument();
            expect(screen.getByText('Status')).toBeInTheDocument();
            expect(screen.getByText('Object')).toBeInTheDocument();
            expect(screen.getByRole('columnheader', {name: /node1/i})).toBeInTheDocument();
            expect(screen.getByRole('columnheader', {name: /node2/i})).toBeInTheDocument();
        });
    });

    test('fetches data on mount and cleans up on unmount', async () => {
        // Render the component
        const {unmount} = await act(async () => {
            return render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        // Verify mount behavior
        await waitFor(() => {
            expect(screen.getByText('Objects')).toBeInTheDocument(); // Verify render
            expect(startEventReception).toHaveBeenCalledWith("mock-token", ["ObjectStatusUpdated", "InstanceStatusUpdated", "ObjectDeleted", "InstanceMonitorUpdated"]);
        }, {timeout: 2000});

        // Unmount the component to trigger cleanup
        await act(async () => {
            unmount();
        });

        // Verify cleanup behavior
        expect(closeEventSource).toHaveBeenCalledTimes(1);
    });

    test('displays objects table with correct data', async () => {
        // Mock useEffect to ensure proper mount and unmount behavior
        const mockUseEffect = jest.spyOn(React, 'useEffect').mockImplementation((effect) => {
            const cleanup = effect();
            return cleanup;
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test2/i})).toBeInTheDocument();
            expect(screen.getByRole('row', {name: /root\/svc\/test3/i})).toBeInTheDocument();
        });

        const verifyStatusColumn = (row, expectedIcons, expectedCaption = null) => {
            const cells = within(row).getAllByRole('cell');
            const statusCell = cells[1];
            expectedIcons.forEach((icon) => {
                // Map icon to correct aria-label
                const label = icon === 'warn' ? 'Object has warning' : `Object is ${icon}`;
                expect(within(statusCell).getByLabelText(label)).toBeInTheDocument();
            });
            if (expectedCaption) {
                expect(within(statusCell).getByText(expectedCaption)).toBeInTheDocument();
            }
        };

        const verifyNodeColumn = (row, node, expectedIcons) => {
            const nodeIndex = allNodes.indexOf(node);
            const nodeCell = within(row).getAllByRole('cell')[nodeIndex + 3];
            if (expectedIcons.length === 0) {
                expect(within(nodeCell).getByText('-')).toBeInTheDocument();
                return;
            }
            expectedIcons.forEach((icon) => {
                const label = icon === 'warn' ? `Node ${node} has warning` : `Node ${node} is ${icon}`;
                expect(within(nodeCell).getByLabelText(label)).toBeInTheDocument();
            });
        };

        const rows = screen.getAllByRole('row').slice(1);
        const rowTexts = rows.map((row) => row.textContent);

        const test1Row = rows[rowTexts.findIndex((text) => text.includes('test-ns/svc/test1'))];
        const test2Row = rows[rowTexts.findIndex((text) => text.includes('test-ns/svc/test2'))];
        const test3Row = rows[rowTexts.findIndex((text) => text.includes('root/svc/test3'))];

        verifyStatusColumn(test1Row, ['up'], 'frozen');
        verifyStatusColumn(test2Row, ['down', 'frozen']);
        verifyStatusColumn(test3Row, ['warn'], 'started');

        verifyNodeColumn(test1Row, 'node1', ['up']);
        verifyNodeColumn(test1Row, 'node2', ['down', 'frozen']);
        verifyNodeColumn(test2Row, 'node1', ['down', 'frozen']);
        verifyNodeColumn(test2Row, 'node2', []);
        verifyNodeColumn(test3Row, 'node1', []);
        verifyNodeColumn(test3Row, 'node2', ['warn']);

        mockUseEffect.mockRestore();
    });

    test('renders correctly with initial state', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Objects')).toBeInTheDocument();
            expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
            expect(screen.getByLabelText('Kind')).toBeInTheDocument();
            expect(screen.getByLabelText('Name')).toBeInTheDocument();
            expect(screen.getByText('Status')).toBeInTheDocument();
            expect(screen.getByText('Object')).toBeInTheDocument();
            expect(screen.getByRole('columnheader', {name: /node1/i})).toBeInTheDocument();
            expect(screen.getByRole('columnheader', {name: /node2/i})).toBeInTheDocument();
        });
    });

    test('handles object selection', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            const checkbox = within(
                screen.getByRole('row', {name: /test-ns\/svc\/test1/i})
            ).getByRole('checkbox');
            fireEvent.click(checkbox);
            expect(checkbox).toBeChecked();
        });
    });

    test('handles select all objects', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(selectAllCheckbox);

            const allCheckboxes = screen.getAllByRole('checkbox').slice(1);
            allCheckboxes.forEach((checkbox) => {
                expect(checkbox).toBeChecked();
            });
        });
    });

    test('opens actions menu', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            const checkbox = within(
                screen.getByRole('row', {name: /test-ns\/svc\/test1/i})
            ).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        const menu = await screen.findByRole('menu');
        expect(menu).toBeInTheDocument();

        AVAILABLE_ACTIONS.forEach((action) => {
            expect(
                within(menu).getByText(action.charAt(0).toUpperCase() + action.slice(1))
            ).toBeInTheDocument();
        });
    });

    test('filters objects by namespace', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            fireEvent.mouseDown(screen.getByLabelText(/namespace/i));
            const listbox = screen.getByRole('listbox');
            fireEvent.click(within(listbox).getByText(/test-ns/i));

            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test2/i})).toBeInTheDocument();
            expect(screen.queryByRole('row', {name: /root\/svc\/test3/i})).not.toBeInTheDocument();
        });
    });

    test('filters objects by search query', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            const searchInput = screen.getByLabelText('Name');
            fireEvent.change(searchInput, {target: {value: 'test1'}});

            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
            expect(screen.queryByRole('row', {name: /test-ns\/svc\/test2/i})).not.toBeInTheDocument();
            expect(screen.queryByRole('row', {name: /root\/svc\/test3/i})).not.toBeInTheDocument();
        });
    });

    test('handles object click navigation', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            fireEvent.click(screen.getByRole('row', {name: /test-ns\/svc\/test1/i}));
            expect(mockNavigate).toHaveBeenCalledWith('/objects/test-ns%2Fsvc%2Ftest1');
        });
    });

    test('executes action and shows snackbar', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            const checkbox = within(
                screen.getByRole('row', {name: /test-ns\/svc\/test1/i})
            ).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText(/Restart/i));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/test-ns/svc/test1/action/restart'),
                    expect.any(Object)
                );
                expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i);
            },
            {timeout: 5000}
        );
    });

    test('handles failed action execution', async () => {
        global.fetch.mockImplementation(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({}),
            })
        );

        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            const checkbox = within(
                screen.getByRole('row', {name: /test-ns\/svc\/test1/i})
            ).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText(/Restart/i));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

        await waitFor(
            () => {
                expect(screen.getByRole('alert')).toHaveTextContent(/failed/i);
            },
            {timeout: 5000}
        );
    });

    test('executes delete action and removes object', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        // Select the object
        await waitFor(() => {
            const checkbox = within(
                screen.getByRole('row', {name: /test-ns\/svc\/test1/i})
            ).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        // Open actions menu and select Delete
        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText(/Delete/i));

        // Wait for DeleteDialog to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText(/Confirm Delete/i)).toBeInTheDocument();
        });

        // Check the required checkboxes
        const configLossCheckbox = screen.getByLabelText(/Confirm configuration loss/i);
        const clusterwideCheckbox = screen.getByLabelText(/Confirm clusterwide orchestration/i);
        fireEvent.click(configLossCheckbox);
        fireEvent.click(clusterwideCheckbox);

        // Click Confirm button
        fireEvent.click(screen.getByRole('button', {name: /Delete/i}));

        // Verify the fetch call and object removal
        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/test-ns/svc/test1/action/delete'),
                    expect.any(Object)
                );
                expect(mockRemoveObject).toHaveBeenCalledWith('test-ns/svc/test1');
                expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i);
            },
            {timeout: 5000}
        );
    });

    test('executes purge action with confirmation', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            const checkbox = within(
                screen.getByRole('row', {name: /test-ns\/svc\/test1/i})
            ).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText(/Purge/i));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('checkbox', {name: /Confirm data loss/i}));
        fireEvent.click(screen.getByRole('checkbox', {name: /Confirm configuration loss/i}));
        fireEvent.click(screen.getByRole('checkbox', {name: /Confirm service interruption/i}));

        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        expect(confirmButton).not.toBeDisabled();
        fireEvent.click(confirmButton);

        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/test-ns/svc/test1/action/purge'),
                    expect.any(Object)
                );
                expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i);
            },
            {timeout: 5000}
        );
    });

    test('executes stop action with confirmation', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            const checkbox = within(
                screen.getByRole('row', {name: /test-ns\/svc\/test1/i})
            ).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText(/Stop/i));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText(/I understand that this may interrupt services/i));

        const confirmButton = screen.getByRole('button', {name: /Stop/i});
        expect(confirmButton).not.toBeDisabled();
        fireEvent.click(confirmButton);

        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/test-ns/svc/test1/action/stop'),
                    expect.any(Object)
                );
                expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i);
            },
            {timeout: 5000}
        );
    });

    test('executes unprovision action with confirmation', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            const checkbox = within(
                screen.getByRole('row', {name: /test-ns\/svc\/test1/i})
            ).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText(/Unprovision/i));

        await waitFor(() => {
            expect(screen.getByRole('dialog', {name: /Confirm Unprovision/i})).toBeInTheDocument();
        });

        // Check all three required checkboxes for object unprovision
        fireEvent.click(screen.getByLabelText(/I understand data will be lost/i));
        fireEvent.click(screen.getByLabelText(/I understand this action will be orchestrated clusterwide/i));
        fireEvent.click(screen.getByLabelText(/I understand the selected services may be temporarily interrupted during failover, or durably interrupted if no failover is configured/i));

        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        expect(confirmButton).not.toBeDisabled();
        fireEvent.click(confirmButton);

        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/test-ns/svc/test1/action/unprovision'),
                    expect.any(Object)
                );
                expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i);
            },
            {timeout: 5000}
        );
    });

    test('toggles filters visibility', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        // Check filters are visible initially
        const toggleButton = await screen.findByRole('button', {name: /filters/i});
        expect(toggleButton).toHaveTextContent('Hide filters');
        expect(screen.getByLabelText('Namespace')).toBeInTheDocument();

        // Click to hide filters
        fireEvent.click(toggleButton);

        // Check filters are hidden
        await waitFor(() => {
            expect(toggleButton).toHaveTextContent('Show filters');
            expect(screen.queryByLabelText('Namespace')).not.toBeInTheDocument();
        });

        // Click to show filters again
        fireEvent.click(toggleButton);

        await waitFor(() => {
            expect(toggleButton).toHaveTextContent('Hide filters');
            expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
        });
    });

    test('filters objects by global state', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            fireEvent.mouseDown(screen.getByLabelText(/Global State/i));
            const listbox = screen.getByRole('listbox');
            fireEvent.click(within(listbox).getByText(/up/i));

            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
            expect(screen.queryByRole('row', {name: /test-ns\/svc\/test2/i})).not.toBeInTheDocument();
            expect(screen.queryByRole('row', {name: /root\/svc\/test3/i})).not.toBeInTheDocument();
        });
    });

    test('filters objects by kind', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            fireEvent.mouseDown(screen.getByLabelText(/Kind/i));
            const listbox = screen.getByRole('listbox');
            fireEvent.click(within(listbox).getByText(/svc/i));

            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test2/i})).toBeInTheDocument();
            expect(screen.getByRole('row', {name: /root\/svc\/test3/i})).toBeInTheDocument();
        });
    });

    test('displays no objects when objectStatus is empty', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {},
                objectInstanceStatus: {},
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Objects')).toBeInTheDocument();
            expect(screen.getAllByRole('row')).toHaveLength(1); // Only header row
        });
    });

    test('accessibility check', async () => {
        await act(async () => {
            const {container} = render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
            const results = await axe(container);
            expect(results).toHaveNoViolations();
        });
    });
});