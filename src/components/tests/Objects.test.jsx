import React, {act} from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {green, red, orange, blue} from '@mui/material/colors';
import Objects from '../Objects';
import useEventStore from '../../hooks/useEventStore';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus';
import {closeEventSource} from '../../eventSourceManager';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
    useLocation: jest.fn(),
}));
jest.mock('../../hooks/useEventStore');
jest.mock('../../hooks/useFetchDaemonStatus');
jest.mock('../../eventSourceManager');
jest.mock('@mui/material/useMediaQuery', () => {
    return jest.fn().mockReturnValue(true);
});
jest.mock('@mui/material/Collapse', () => {
    return ({in: inProp, children}) => (inProp ? children : null);
});

const AVAILABLE_ACTIONS = ["restart", "freeze", "unfreeze", "delete", "provision", "unprovision", "purge", "switch", "giveback", "abort"];

describe('Objects Component', () => {
    const mockNavigate = jest.fn();
    const mockFetchNodes = jest.fn();
    const mockStartEventReception = jest.fn();
    const mockRemoveObject = jest.fn();
    const allNodes = ['node1', 'node2'];

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock location and navigation
        require('react-router-dom').useLocation.mockReturnValue({
            state: {namespace: 'all'}
        });
        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);

        // Mock useEventStore with selector application
        const mockState = {
            objectStatus: {
                'test-ns/svc/test1': {avail: 'up', frozen: 'unfrozen'},
                'test-ns/svc/test2': {avail: 'down', frozen: 'frozen'},
                'root/svc/test3': {avail: 'warn', frozen: 'unfrozen'},
            },
            objectInstanceStatus: {
                'test-ns/svc/test1': {
                    'node1': {avail: 'up', frozen_at: '0001-01-01T00:00:00Z'},
                    'node2': {avail: 'down', frozen_at: '2025-05-16T10:00:00Z'},
                },
                'test-ns/svc/test2': {
                    'node1': {avail: 'down', frozen_at: '2025-05-16T10:00:00Z'},
                },
                'root/svc/test3': {
                    'node2': {avail: 'warn', frozen_at: '0001-01-01T00:00:00Z'},
                },
            },
            instanceMonitor: {
                'node1:test-ns/svc/test1': {state: 'running', global_expect: 'frozen'},
                'node2:test-ns/svc/test1': {state: 'idle', global_expect: 'none'},
                'node1:test-ns/svc/test2': {state: 'failed', global_expect: 'none'},
                'node2:root/svc/test3': {state: 'idle', global_expect: 'started'},
            },
            heartbeatStatus: {
                'node1': {
                    streams: [{state: 'running'}, {state: 'stopped'}],
                },
                'node2': {
                    streams: [{state: 'running'}, {state: 'running'}],
                },
            },
            removeObject: mockRemoveObject,
        };
        useEventStore.mockImplementation((selector) => {
            const result = selector(mockState);
            console.log('useEventStore selector result:', result);
            return result;
        });

        // Mock useFetchDaemonStatus
        useFetchDaemonStatus.mockReturnValue({
            daemon: {cluster: {object: {}}},
            fetchNodes: mockFetchNodes,
            startEventReception: mockStartEventReception,
        });

        Storage.prototype.getItem = jest.fn(() => 'mock-token');
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

    test('fetches data on mount', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            expect(mockFetchNodes).toHaveBeenCalledWith('mock-token');
            expect(mockStartEventReception).toHaveBeenCalledWith('mock-token');
        });
    });

    test('displays objects table with correct data', async () => {
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

        // Verify Status column icons (avail, frozen)
        const verifyStatusColumn = (row, expected) => {
            const statusCell = within(row).getAllByRole('cell')[1]; // Status column
            const svgs = statusCell.querySelectorAll('svg');

            const iconStyles = Array.from(svgs).map(svg => ({
                color: window.getComputedStyle(svg).color,
            }));
            console.log(`Status column for ${row.textContent}:`, {iconStyles});

            const iconTests = [
                {
                    condition: expected.icons?.includes('up'),
                    test: () => iconStyles.some(style => style.color === 'rgb(76, 175, 80)'), // green[500]
                },
                {
                    condition: expected.icons?.includes('down'),
                    test: () => iconStyles.some(style => style.color === 'rgb(244, 67, 54)'), // red[500]
                },
                {
                    condition: expected.icons?.includes('warn'),
                    test: () => iconStyles.some(style => style.color === 'rgb(255, 152, 0)'), // orange[500]
                },
                {
                    condition: expected.icons?.includes('frozen'),
                    test: () => iconStyles.some(style => style.color === 'rgb(144, 202, 249)'), // blue[200]
                },
            ];

            iconTests.forEach(({condition, test}) => {
                console.log(`Checking condition ${condition}:`, test());
                if (condition) {
                    expect(test()).toBeTruthy();
                } else {
                    expect(test()).toBeFalsy();
                }
            });
        };

        // Verify node column icons (avail, frozen)
        const verifyNodeColumn = (row, node, expected) => {
            const nodeIndex = allNodes.indexOf(node);
            const nodeCell = within(row).getAllByRole('cell')[nodeIndex + 3]; // Checkbox, Status, Object, then nodes
            console.log(`Verifying node column ${node} for ${row.textContent}: nodeCell ${nodeCell ? 'found' : 'not found'}, index ${nodeIndex + 3}`);
            if (!nodeCell) {
                console.log(`Expected for ${node}:`, expected);
                expect(expected).toEqual({icons: []});
                return;
            }

            const svgs = nodeCell.querySelectorAll('svg');

            const iconStyles = Array.from(svgs).map(svg => ({
                color: window.getComputedStyle(svg).color,
            }));
            console.log(`Node column ${node} for ${row.textContent}:`, {iconStyles});

            const iconTests = [
                {
                    condition: expected.icons?.includes('up'),
                    test: () => iconStyles.some(style => style.color === 'rgb(76, 175, 80)'),
                },
                {
                    condition: expected.icons?.includes('down'),
                    test: () => iconStyles.some(style => style.color === 'rgb(244, 67, 54)'),
                },
                {
                    condition: expected.icons?.includes('warn'),
                    test: () => iconStyles.some(style => style.color === 'rgb(255, 152, 0)'),
                },
                {
                    condition: expected.icons?.includes('frozen'),
                    test: () => iconStyles.some(style => style.color === 'rgb(144, 202, 249)'),
                },
            ];

            iconTests.forEach(({condition, test}) => {
                console.log(`Checking condition ${condition} for node ${node}:`, test());
                if (condition) {
                    expect(test()).toBeTruthy();
                } else {
                    expect(test()).toBeFalsy();
                }
            });
        };

        const rows = screen.getAllByRole('row').slice(1); // Skip header
        const rowTexts = rows.map(row => row.textContent);

        const test1Row = rows[rowTexts.findIndex(text => text.includes('test-ns/svc/test1'))];
        const test2Row = rows[rowTexts.findIndex(text => text.includes('test-ns/svc/test2'))];
        const test3Row = rows[rowTexts.findIndex(text => text.includes('root/svc/test3'))];

        // Status column expectations (icons only)
        verifyStatusColumn(test1Row, {icons: ['up']}); // Green icon
        verifyStatusColumn(test2Row, {icons: ['down', 'frozen']}); // Red and blue icons
        verifyStatusColumn(test3Row, {icons: ['warn']}); // Orange icon

        // Node column expectations (icons only)
        verifyNodeColumn(test1Row, 'node1', {icons: ['up']});
        verifyNodeColumn(test1Row, 'node2', {icons: ['down', 'frozen']});
        verifyNodeColumn(test2Row, 'node1', {icons: ['down', 'frozen']});
        verifyNodeColumn(test2Row, 'node2', {icons: []});
        verifyNodeColumn(test3Row, 'node1', {icons: []});
        verifyNodeColumn(test3Row, 'node2', {icons: ['warn']});
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
            const checkbox = within(screen.getByRole('row', {
                name: /test-ns\/svc\/test1/i
            })).getByRole('checkbox');
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
            allCheckboxes.forEach(checkbox => {
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
            const checkbox = within(screen.getByRole('row', {
                name: /test-ns\/svc\/test1/i
            })).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();

        AVAILABLE_ACTIONS.forEach(action => {
            expect(within(menu).getByText(action.charAt(0).toUpperCase() + action.slice(1))).toBeInTheDocument();
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

    test('shows confirmation dialog for freeze action', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Objects/>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            const checkbox = within(screen.getByRole('row', {
                name: /test-ns\/svc\/test1/i
            })).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        const menu = screen.getByRole('menu');
        fireEvent.click(within(menu).getByText('Freeze'));

        expect(screen.getByText('Freeze selected objects')).toBeInTheDocument();
        expect(screen.getByText(/I understand the selected services orchestration will be paused/i)).toBeInTheDocument();
    });

    test('executes action and shows snackbar', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
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
            const checkbox = within(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText(/restart/i));
        fireEvent.click(screen.getByRole('button', {name: /ok/i}));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
            const alert = screen.getByRole('alert');
            expect(alert).toHaveTextContent(/succeeded|ok/i);
        }, {timeout: 5000});

        global.fetch.mockClear();
    });

    test('handles failed action execution', async () => {
        global.fetch = jest.fn(() =>
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
            const checkbox = within(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).getByRole('checkbox');
            fireEvent.click(checkbox);
        });

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText(/restart/i));
        fireEvent.click(screen.getByRole('button', {name: /ok/i}));

        await waitFor(() => {
            const alert = screen.getByRole('alert');
            expect(alert).toHaveTextContent(/failed|error/i);
        }, {timeout: 5000});

        global.fetch.mockClear();
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
        expect(screen.getByLabelText('Kind')).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toBeInTheDocument();

        // Click to hide filters
        fireEvent.click(toggleButton);

        // Check filters are hidden
        await waitFor(() => {
            expect(toggleButton).toHaveTextContent('Show filters');
            expect(screen.queryByLabelText('Namespace')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Kind')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
        });

        // Click to show filters again
        fireEvent.click(toggleButton);

        // Check filters are visible again
        await waitFor(() => {
            expect(toggleButton).toHaveTextContent('Hide filters');
            expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
            expect(screen.getByLabelText('Kind')).toBeInTheDocument();
            expect(screen.getByLabelText('Name')).toBeInTheDocument();
        });
    });
});