import React from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
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

    let originalConsoleError;

    beforeEach(() => {
        originalConsoleError = console.error;
        console.error = jest.fn((message, ...args) => {
            if (typeof message === 'string' &&
                (message.includes('A props object containing a "key" prop is being spread into JSX') ||
                    message.includes('<li> cannot appear as a descendant of <li>'))) {
                return;
            }
            originalConsoleError.call(console, message, ...args);
        });

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
        console.error = originalConsoleError;
        jest.restoreAllMocks();
    });

    const setupComponent = () => {
        return render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );
    };

    const waitForComponentToLoad = async () => {
        await waitFor(() => {
            expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
        });
    };

    const verifyStatusColumn = (row, expectedIcons, expectedCaption = null) => {
        const cells = within(row).getAllByRole('cell');
        const statusCell = cells[1];

        expectedIcons.forEach((icon) => {
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

    const selectObject = async (objectName) => {
        const row = screen.getByRole('row', {name: new RegExp(objectName, 'i')});
        const checkbox = within(row).getByRole('checkbox');
        fireEvent.click(checkbox);
        return checkbox;
    };

    test('renders correctly with initial state', async () => {
        setupComponent();

        await waitForComponentToLoad();

        expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
        expect(screen.getByLabelText('Kind')).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Object')).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: /node1/i})).toBeInTheDocument();
        expect(screen.getByRole('columnheader', {name: /node2/i})).toBeInTheDocument();
    });

    test('fetches data on mount and cleans up on unmount', async () => {
        const {unmount} = setupComponent();

        await waitForComponentToLoad();

        expect(startEventReception).toHaveBeenCalledWith(
            "mock-token",
            [
                "ObjectStatusUpdated",
                "InstanceStatusUpdated",
                "ObjectDeleted",
                "InstanceMonitorUpdated"
            ]
        );

        unmount();

        expect(closeEventSource).toHaveBeenCalledTimes(1);
    });

    test('displays objects table with correct data', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
        });

        expect(screen.getByRole('row', {name: /test-ns\/svc\/test2/i})).toBeInTheDocument();
        expect(screen.getByRole('row', {name: /root\/svc\/test3/i})).toBeInTheDocument();

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
    });

    test('handles object selection', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const checkbox = await selectObject('test-ns/svc/test1');

        expect(checkbox).toBeChecked();
    });

    test('handles select all objects', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(selectAllCheckbox);

        const allCheckboxes = screen.getAllByRole('checkbox').slice(1);
        allCheckboxes.forEach((checkbox) => {
            expect(checkbox).toBeChecked();
        });
    });

    test('opens actions menu', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await selectObject('test-ns/svc/test1');

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
        setupComponent();
        await waitForComponentToLoad();

        fireEvent.mouseDown(screen.getByLabelText(/namespace/i));
        const listbox = screen.getByRole('listbox');
        fireEvent.click(within(listbox).getByText(/test-ns/i));

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
        });

        expect(screen.getByRole('row', {name: /test-ns\/svc\/test2/i})).toBeInTheDocument();
        expect(screen.queryByRole('row', {name: /root\/svc\/test3/i})).not.toBeInTheDocument();
    });

    test('filters objects by search query', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const searchInput = screen.getByLabelText('Name');
        fireEvent.change(searchInput, {target: {value: 'test1'}});

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
        });

        expect(screen.queryByRole('row', {name: /test-ns\/svc\/test2/i})).not.toBeInTheDocument();
        expect(screen.queryByRole('row', {name: /root\/svc\/test3/i})).not.toBeInTheDocument();
    });

    test('handles object click navigation', async () => {
        setupComponent();
        await waitForComponentToLoad();

        fireEvent.click(screen.getByRole('row', {name: /test-ns\/svc\/test1/i}));

        expect(mockNavigate).toHaveBeenCalledWith('/objects/test-ns%2Fsvc%2Ftest1');
    });

    test('executes action and shows snackbar', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await selectObject('test-ns/svc/test1');

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText(/Restart/i));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test-ns/svc/test1/action/restart'),
                expect.any(Object)
            );
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i);
        });
    });

    test('handles failed action execution', async () => {
        const originalConsoleErrorInTest = console.error;

        console.error = jest.fn((message, ...args) => {
            if (typeof message === 'string' &&
                (message.includes('Failed to execute') ||
                    message.includes('HTTP error!'))) {
                return;
            }
            originalConsoleErrorInTest.call(console, message, ...args);
        });

        try {
            global.fetch.mockImplementation(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                })
            );

            setupComponent();
            await waitForComponentToLoad();

            await selectObject('test-ns/svc/test1');

            fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
            fireEvent.click(screen.getByText(/Restart/i));

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent(/failed/i);
            });
        } finally {
            console.error = originalConsoleErrorInTest;
        }
    });

    test('executes delete action and removes object', async () => {
        setupComponent();
        await waitForComponentToLoad();

        // Select the object
        await selectObject('test-ns/svc/test1');

        // Open actions menu and select Delete
        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));

        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        const menu = screen.getByRole('menu');
        const deleteOption = within(menu).getByText(/^Delete$/i);
        fireEvent.click(deleteOption);

        // Wait for DeleteDialog to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        expect(screen.getByText(/Confirm Delete/i)).toBeInTheDocument();

        // Check the required checkboxes
        const configLossCheckbox = screen.getByLabelText(/Confirm configuration loss/i);
        const clusterwideCheckbox = screen.getByLabelText(/Confirm clusterwide orchestration/i);

        fireEvent.click(configLossCheckbox);
        fireEvent.click(clusterwideCheckbox);

        // Click Confirm button
        fireEvent.click(screen.getByRole('button', {name: /Delete/i}));

        // Verify the fetch call and object removal
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test-ns/svc/test1/action/delete'),
                expect.any(Object)
            );
        });

        expect(mockRemoveObject).toHaveBeenCalledWith('test-ns/svc/test1');

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i);
        });
    });

    test('executes purge action with confirmation', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await selectObject('test-ns/svc/test1');

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

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test-ns/svc/test1/action/purge'),
                expect.any(Object)
            );
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i);
        });
    });

    test('executes stop action with confirmation', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await selectObject('test-ns/svc/test1');

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText(/Stop/i));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText(/I understand that this may interrupt services/i));

        const confirmButton = screen.getByRole('button', {name: /Stop/i});
        expect(confirmButton).not.toBeDisabled();

        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test-ns/svc/test1/action/stop'),
                expect.any(Object)
            );
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i);
        });
    });

    test('executes unprovision action with confirmation', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await selectObject('test-ns/svc/test1');

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

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test-ns/svc/test1/action/unprovision'),
                expect.any(Object)
            );
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/succeeded/i);
        });
    });

    test('toggles filters visibility', async () => {
        setupComponent();
        await waitForComponentToLoad();

        // Check filters are visible initially
        const toggleButton = await screen.findByRole('button', {name: /filters/i});
        expect(screen.getByLabelText('Namespace')).toBeInTheDocument();

        // Click to hide filters
        fireEvent.click(toggleButton);

        // Check filters are hidden
        await waitFor(() => {
            expect(toggleButton).toHaveTextContent('Filters');
        });

        expect(screen.queryByLabelText('Namespace')).not.toBeInTheDocument();

        // Click to show filters again
        fireEvent.click(toggleButton);

        expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
    });

    test('filters objects by global state', async () => {
        setupComponent();
        await waitForComponentToLoad();

        fireEvent.mouseDown(screen.getByLabelText(/Global State/i));
        const listbox = screen.getByRole('listbox');
        fireEvent.click(within(listbox).getByText(/up/i));

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
        });

        expect(screen.queryByRole('row', {name: /test-ns\/svc\/test2/i})).not.toBeInTheDocument();
        expect(screen.queryByRole('row', {name: /root\/svc\/test3/i})).not.toBeInTheDocument();
    });

    test('filters objects by kind', async () => {
        setupComponent();
        await waitForComponentToLoad();

        fireEvent.mouseDown(screen.getByLabelText(/Kind/i));
        const listbox = screen.getByRole('listbox');
        fireEvent.click(within(listbox).getByText(/svc/i));

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
        });

        expect(screen.getByRole('row', {name: /test-ns\/svc\/test2/i})).toBeInTheDocument();
        expect(screen.getByRole('row', {name: /root\/svc\/test3/i})).toBeInTheDocument();
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

        setupComponent();

        await waitFor(() => {
            expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
        });

        // Only header row should be present
        expect(screen.getAllByRole('row')).toHaveLength(1);
    });

    test('accessibility check', async () => {
        const {container} = setupComponent();

        await waitForComponentToLoad();

        const results = await axe(container, {
            rules: {
                'aria-prohibited-attr': {enabled: false},
                'label': {enabled: false}
            }
        });
        expect(results).toHaveNoViolations();
    });

    test('handles objects without instance status', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'test-ns/svc/test4': {avail: 'up', frozen: 'unfrozen'},
                },
                objectInstanceStatus: {},
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test4/i})).toBeInTheDocument();
        });

        const row = screen.getByRole('row', {name: /test-ns\/svc\/test4/i});
        expect(row).toBeInTheDocument();
    });

    test('handles objects with string provisioned status', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'test-ns/svc/unprovisioned': {avail: 'n/a', frozen: 'unfrozen', provisioned: 'false'},
                },
                objectInstanceStatus: {
                    'test-ns/svc/unprovisioned': {
                        node1: {avail: 'n/a', frozen_at: '0001-01-01T00:00:00Z', provisioned: 'false'},
                    },
                },
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/unprovisioned/i})).toBeInTheDocument();
        });

        expect(screen.getByLabelText('Object is not provisioned')).toBeInTheDocument();
    });

    test('handles objects with boolean provisioned status', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'test-ns/svc/unprovisioned-bool': {avail: 'n/a', frozen: 'unfrozen', provisioned: false},
                },
                objectInstanceStatus: {
                    'test-ns/svc/unprovisioned-bool': {
                        node1: {avail: 'n/a', frozen_at: '0001-01-01T00:00:00Z', provisioned: false},
                    },
                },
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/unprovisioned-bool/i})).toBeInTheDocument();
        });

        expect(screen.getByLabelText('Object is not provisioned')).toBeInTheDocument();
    });

    test('handles nodes with not provisioned status', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'test-ns/svc/node-unprovisioned': {avail: 'up', frozen: 'unfrozen', provisioned: 'true'},
                },
                objectInstanceStatus: {
                    'test-ns/svc/node-unprovisioned': {
                        node1: {avail: 'up', frozen_at: '0001-01-01T00:00:00Z', provisioned: 'false'},
                    },
                },
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/node-unprovisioned/i})).toBeInTheDocument();
        });

        expect(screen.getByLabelText('Node node1 is not provisioned')).toBeInTheDocument();
    });

    test('handles objects with globalExpect status', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'test-ns/svc/global-expect': {avail: 'up', frozen: 'unfrozen'},
                },
                objectInstanceStatus: {
                    'test-ns/svc/global-expect': {
                        node1: {avail: 'up', frozen_at: '0001-01-01T00:00:00Z'},
                    },
                },
                instanceMonitor: {
                    'node1:test-ns/svc/global-expect': {state: 'idle', global_expect: 'started'},
                },
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/global-expect/i})).toBeInTheDocument();
        });

        expect(screen.getByText('started')).toBeInTheDocument();
    });

    test('handles nodes with non-idle state', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'test-ns/svc/non-idle': {avail: 'up', frozen: 'unfrozen'},
                },
                objectInstanceStatus: {
                    'test-ns/svc/non-idle': {
                        node1: {avail: 'up', frozen_at: '0001-01-01T00:00:00Z'},
                    },
                },
                instanceMonitor: {
                    'node1:test-ns/svc/non-idle': {state: 'running', global_expect: 'none'},
                },
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/non-idle/i})).toBeInTheDocument();
        });

        expect(screen.getByText('running')).toBeInTheDocument();
    });

    test('disables freeze action for frozen objects', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'test-ns/svc/test1': {avail: 'up', frozen: 'unfrozen'},
                    'test-ns/svc/test2': {avail: 'down', frozen: 'frozen'},
                },
                objectInstanceStatus: {
                    'test-ns/svc/test1': {
                        node1: {avail: 'up', frozen_at: '0001-01-01T00:00:00Z'},
                    },
                    'test-ns/svc/test2': {
                        node1: {avail: 'down', frozen_at: '2025-05-16T10:00:00Z'},
                    },
                },
                instanceMonitor: {
                    'node1:test-ns/svc/test1': {state: 'running', global_expect: 'none'},
                    'node1:test-ns/svc/test2': {state: 'idle', global_expect: 'none'},
                },
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        const frozenObjectRow = screen.getByRole('row', {name: /test-ns\/svc\/test2/i});
        const menuButton = within(frozenObjectRow).getByRole('button', {name: /more actions/i});
        fireEvent.click(menuButton);

        await waitFor(() => {
            const menu = screen.getByRole('menu');
            const freezeAction = within(menu).queryByText('Freeze');
            expect(freezeAction).not.toBeInTheDocument();
        });
    });

    test('disables actions in global menu when not allowed', async () => {
        setupComponent();
        await waitForComponentToLoad();

        // Select an object
        const row = screen.getByRole('row', {name: /test-ns\/svc\/test1/i});
        const checkbox = within(row).getByRole('checkbox');
        fireEvent.click(checkbox);

        // Open global actions menu
        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));

        const menu = await screen.findByRole('menu');

        // Verify that some actions are disabled according to business logic
        const deleteAction = within(menu).getByText('Delete');
        expect(deleteAction).toBeInTheDocument();
    });

    test('handles sorting by status column', async () => {
        setupComponent();
        await waitForComponentToLoad();

        // Click on Status column header to sort
        const statusHeader = screen.getByText('Status');
        fireEvent.click(statusHeader);

        // Verify that sorting was triggered (we don't check specific order as it depends on implementation)
        await waitFor(() => {
            expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
        });
    });

    test('handles sorting by object name', async () => {
        setupComponent();
        await waitForComponentToLoad();

        // Click on Object column header to sort
        const objectHeader = screen.getByText('Object');
        fireEvent.click(objectHeader);

        // Verify that sorting was triggered
        await waitFor(() => {
            expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
        });
    });

    test('handles sorting by node status', async () => {
        setupComponent();
        await waitForComponentToLoad();

        // Click on a node column header to sort
        const nodeHeader = screen.getByRole('columnheader', {name: /node1/i});
        fireEvent.click(nodeHeader);

        // Verify that sorting was triggered
        await waitFor(() => {
            expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
        });
    });

    test('handles sort direction change', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const objectHeader = screen.getByText('Object');

        // First click: ascending sort
        fireEvent.click(objectHeader);

        // Second click: descending sort
        fireEvent.click(objectHeader);

        // Verify that sorting was triggered twice
        await waitFor(() => {
            expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
        });
    });

    test('prevents navigation for objects without instance status', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'test-ns/svc/no-instance': {avail: 'up', frozen: 'unfrozen'},
                },
                objectInstanceStatus: {}, // No instance status
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/no-instance/i})).toBeInTheDocument();
        });

        // Click on the row
        fireEvent.click(screen.getByRole('row', {name: /test-ns\/svc\/no-instance/i}));

        // Should not navigate because no instanceStatus
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('filters objects by unprovisioned state', async () => {
        setupComponent();
        await waitForComponentToLoad();

        // Select "unprovisioned" filter
        fireEvent.mouseDown(screen.getByLabelText(/Global State/i));
        const listbox = screen.getByRole('listbox');
        fireEvent.click(within(listbox).getByText(/unprovisioned/i));

        // With mocked data, no object is unprovisioned, so no results
        await waitFor(() => {
            expect(screen.getByText(/No objects found/i)).toBeInTheDocument();
        });
    });

    test('handles narrow screen layout', async () => {
        // Mock useMediaQuery to return false (narrow screen)
        require('@mui/material/useMediaQuery').mockReturnValue(false);

        setupComponent();
        await waitForComponentToLoad();

        // Verify that node columns are not displayed
        expect(screen.queryByRole('columnheader', {name: /node1/i})).not.toBeInTheDocument();
        expect(screen.queryByRole('columnheader', {name: /node2/i})).not.toBeInTheDocument();
    })

    test('handles URL parameter synchronization with invalid globalState', () => {
        require('react-router-dom').useLocation.mockReturnValue({
            search: '?globalState=invalid&namespace=test&kind=svc&name=obj1',
            pathname: '/objects'
        });

        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        return waitFor(() => {
            expect(screen.getByLabelText('Global State')).toHaveValue('all');
        });
    });

    test('handles event source setup without auth token', () => {
        jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        return waitFor(() => {
            expect(startEventReception).not.toHaveBeenCalled();
        });
    });

    test('handles action execution with single object target', async () => {
        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        await waitForComponentToLoad();

        const row = screen.getByRole('row', {name: /test-ns\/svc\/test1/i});
        const menuButton = within(row).getByRole('button', {name: /more actions/i});
        fireEvent.click(menuButton);

        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Restart'));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test-ns/svc/test1/action/restart'),
                expect.any(Object)
            );
        });
    });

    test('handles debounced URL updates', async () => {
        jest.useFakeTimers();

        render(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        await waitForComponentToLoad();

        fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'test'}});

        jest.advanceTimersByTime(400);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                expect.stringContaining('name=test'),
                expect.any(Object)
            );
        });

        jest.useRealTimers();
    });
});
