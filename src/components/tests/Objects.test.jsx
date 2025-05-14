import React from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {green, red, orange} from '@mui/material/colors';
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
// Mock Collapse to render children immediately
jest.mock('@mui/material/Collapse', () => {
    return ({in: inProp, children}) => (inProp ? children : null);
});

const AVAILABLE_ACTIONS = ["restart", "freeze", "unfreeze", "delete", "provision", "unprovision", "purge", "switch", "giveback", "abort"];

describe('Objects Component', () => {
    const mockNavigate = jest.fn();
    const mockFetchNodes = jest.fn();
    const mockStartEventReception = jest.fn();
    const mockRemoveObject = jest.fn();

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
                'test-ns/svc/test1': {instances: []},
            },
            removeObject: mockRemoveObject,
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

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
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Objects')).toBeInTheDocument();
            expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
            expect(screen.getByLabelText('Kind')).toBeInTheDocument();
            expect(screen.getByLabelText('Name')).toBeInTheDocument();
        });
    });

    test('fetches data on mount', async () => {
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockFetchNodes).toHaveBeenCalledWith('mock-token');
            expect(mockStartEventReception).toHaveBeenCalledWith('mock-token');
        });
    });

    test('displays objects table with correct data', async () => {
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test2/i})).toBeInTheDocument();
            expect(screen.getByRole('row', {name: /root\/svc\/test3/i})).toBeInTheDocument();
        });

        // Verify row states by checking SVG icon colors
        const verifyRowState = (row, expected) => {
            // Query all SVG elements within the row
            const svgs = row.querySelectorAll('svg');
            const iconStyles = Array.from(svgs).map(svg => ({
                color: window.getComputedStyle(svg).color,
                className: svg.className,
            }));

            console.log('SVGs found:', iconStyles);

            const iconTests = [
                {
                    condition: expected.includes('up'),
                    test: () => iconStyles.some(style => style.color === 'rgb(76, 175, 80)'), // green[500]
                },
                {
                    condition: expected.includes('down'),
                    test: () => iconStyles.some(style => style.color === 'rgb(244, 67, 54)'), // red[500]
                },
                {
                    condition: expected.includes('warn'),
                    test: () => iconStyles.some(style => style.color === 'rgb(255, 152, 0)'), // orange[500]
                },
                {
                    condition: expected.includes('frozen'),
                    test: () => iconStyles.some(style => style.color === 'rgb(144, 202, 249)'), // blue[200]
                },
            ];

            iconTests.forEach(({condition, test}) => {
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

        verifyRowState(test1Row, ['up']);
        verifyRowState(test2Row, ['down', 'frozen']);
        verifyRowState(test3Row, ['warn']);
    });

    test('handles object selection', async () => {
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        await waitFor(() => {
            const checkbox = within(screen.getByRole('row', {
                name: /test-ns\/svc\/test1/i
            })).getByRole('checkbox');
            fireEvent.click(checkbox);
            expect(checkbox).toBeChecked();
        });
    });

    test('handles select all objects', async () => {
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

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
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

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
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

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
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        await waitFor(() => {
            const searchInput = screen.getByLabelText('Name');
            fireEvent.change(searchInput, {target: {value: 'test1'}});

            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
            expect(screen.queryByRole('row', {name: /test-ns\/svc\/test2/i})).not.toBeInTheDocument();
            expect(screen.queryByRole('row', {name: /root\/svc\/test3/i})).not.toBeInTheDocument();
        });
    });

    test('handles object click navigation', async () => {
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        await waitFor(() => {
            fireEvent.click(screen.getByRole('row', {name: /test-ns\/svc\/test1/i}));
            expect(mockNavigate).toHaveBeenCalledWith('/objects/test-ns%2Fsvc%2Ftest1');
        });
    });

    test('shows confirmation dialog for freeze action', async () => {
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

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
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

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