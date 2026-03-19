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

const selectFilterOption = async (labelText, optionText) => {
    const filter = screen.getByLabelText(labelText);

    fireEvent.mouseDown(filter);

    await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const listbox = screen.getByRole('listbox');

    const options = within(listbox).getAllByRole('option');
    const option = options.find(opt =>
        opt.textContent.toLowerCase().includes(optionText.toLowerCase())
    );

    if (!option) {
        throw new Error(`Option with text "${optionText}" not found`);
    }

    const checkbox = within(option).getByRole('checkbox');
    fireEvent.click(checkbox);

    const backdrop = document.querySelector('.MuiBackdrop-root, .MuiModal-backdrop');
    if (backdrop) {
        fireEvent.click(backdrop);
    } else {
        fireEvent.keyDown(listbox, {key: 'Escape', code: 'Escape'});
    }
};

const waitForFilterApplied = async () => {
    await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
    }, {timeout: 1000});
};

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

        require('react-router-dom').useLocation.mockReturnValue({
            search: '',
            pathname: '/objects',
        });
        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);

        require('@mui/material/useMediaQuery').mockReturnValue(true);

        const mockState = {
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
                'root/svc/test3': {
                    node2: {avail: 'warn', frozen_at: '0001-01-01T00:00:00Z'},
                },
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

        useEventStore.mockImplementation((selector) => selector(mockState));

        useFetchDaemonStatus.mockReturnValue({
            daemon: {cluster: {object: {}}},
        });

        startEventReception.mockImplementation(mockStartEventReception);
        closeEventSource.mockImplementation(mockCloseEventSource);

        jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('mock-token');

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
        require('@mui/material/useMediaQuery').mockReturnValue(true);
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
            expect(screen.getByLabelText('Global State')).toBeInTheDocument();
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

        expect(screen.getByLabelText('Global State')).toBeInTheDocument();
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

        await selectFilterOption('Namespace', 'test-ns');
        await waitForFilterApplied();

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

        await selectObject('test-ns/svc/test1');

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));

        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        const menu = screen.getByRole('menu');
        const deleteOption = within(menu).getByText(/^Delete$/i);
        fireEvent.click(deleteOption);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        expect(screen.getByText(/Confirm Delete/i)).toBeInTheDocument();

        const configLossCheckbox = screen.getByLabelText(/Confirm configuration loss/i);
        const clusterwideCheckbox = screen.getByLabelText(/Confirm clusterwide orchestration/i);

        fireEvent.click(configLossCheckbox);
        fireEvent.click(clusterwideCheckbox);

        fireEvent.click(screen.getByRole('button', {name: /Delete/i}));

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

        const menu = await screen.findByRole('menu');
        fireEvent.click(within(menu).getByText(/Unprovision/i));

        await waitFor(() => {
            expect(screen.getByRole('dialog', {name: /Confirm Unprovision/i})).toBeInTheDocument();
        });

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

        const toggleButton = await screen.findByRole('button', {name: /filters/i});
        expect(screen.getByLabelText('Namespace')).toBeInTheDocument();

        fireEvent.click(toggleButton);

        await waitFor(() => {
            expect(toggleButton).toHaveAttribute('aria-label', 'Show filters');
        });
        expect(screen.queryByLabelText('Namespace')).not.toBeInTheDocument();

        fireEvent.click(toggleButton);

        await waitFor(() => {
            expect(toggleButton).toHaveAttribute('aria-label', 'Hide filters');
        });
        expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
    });

    test('filters objects by global state', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await selectFilterOption('Global State', 'Up');
        await waitForFilterApplied();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/test1/i})).toBeInTheDocument();
        });

        expect(screen.queryByRole('row', {name: /test-ns\/svc\/test2/i})).not.toBeInTheDocument();
        expect(screen.queryByRole('row', {name: /root\/svc\/test3/i})).not.toBeInTheDocument();
    });

    test('filters objects by kind', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await selectFilterOption('Kind', 'svc');
        await waitForFilterApplied();

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

        const row = screen.getByRole('row', {name: /test-ns\/svc\/test1/i});
        const checkbox = within(row).getByRole('checkbox');
        fireEvent.click(checkbox);

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));

        const menu = await screen.findByRole('menu');

        const deleteAction = within(menu).getByText('Delete');
        expect(deleteAction).toBeInTheDocument();
    });

    test('handles sorting by status column', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const statusHeader = screen.getByText('Status');
        fireEvent.click(statusHeader);

        await waitFor(() => {
            expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
        });
    });

    test('handles sorting by object name', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const objectHeader = screen.getByText('Object');
        fireEvent.click(objectHeader);

        await waitFor(() => {
            expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
        });
    });

    test('handles sorting by node status', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const nodeHeader = screen.getByRole('columnheader', {name: /node1/i});
        fireEvent.click(nodeHeader);

        await waitFor(() => {
            expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
        });
    });

    test('handles sort direction change', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const objectHeader = screen.getByText('Object');

        fireEvent.click(objectHeader);

        fireEvent.click(objectHeader);

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
                objectInstanceStatus: {},
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/no-instance/i})).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('row', {name: /test-ns\/svc\/no-instance/i}));

        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('handles narrow screen layout', async () => {
        const mockUseMediaQuery = require('@mui/material/useMediaQuery');
        mockUseMediaQuery.mockReturnValue(false);

        setupComponent();
        await waitForComponentToLoad();

        expect(screen.queryByRole('columnheader', {name: /node1/i})).not.toBeInTheDocument();
        expect(screen.queryByRole('columnheader', {name: /node2/i})).not.toBeInTheDocument();
    });

    test('handles URL parameter synchronization with invalid globalState', async () => {
        require('react-router-dom').useLocation.mockReturnValue({
            search: '?globalState=invalid&namespace=test&kind=svc&name=obj1',
            pathname: '/objects'
        });

        setupComponent();

        await waitFor(() => {
            expect(screen.getByLabelText('Global State')).toBeInTheDocument();
            expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
        });
    });

    test('handles event source setup without auth token', async () => {
        jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

        setupComponent();

        await waitFor(() => {
            expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
        });

        expect(startEventReception).not.toHaveBeenCalled();
    });

    test('handles action execution with single object target', async () => {
        setupComponent();

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

    test('handles scroll loading more objects', async () => {
        const manyObjects = {};
        const manyInstanceStatus = {};
        for (let i = 0; i < 50; i++) {
            const name = `test-ns/svc/obj${i}`;
            manyObjects[name] = {avail: i % 2 === 0 ? 'up' : 'down', frozen: 'unfrozen'};
            manyInstanceStatus[name] = {
                node1: {avail: i % 2 === 0 ? 'up' : 'down', frozen_at: '0001-01-01T00:00:00Z'}
            };
        }
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: manyObjects,
                objectInstanceStatus: manyInstanceStatus,
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        const rows = screen.getAllByRole('row').slice(1);
        expect(rows.length).toBe(30);

        const tableContainer = document.querySelector('.MuiTableContainer-root');
        Object.defineProperty(tableContainer, 'scrollHeight', {value: 1000});
        Object.defineProperty(tableContainer, 'clientHeight', {value: 500});
        Object.defineProperty(tableContainer, 'scrollTop', {value: 500});

        fireEvent.scroll(tableContainer);

        await waitFor(() => {
            const newRows = screen.getAllByRole('row').slice(1);
            expect(newRows.length).toBeGreaterThan(30);
        });
    });
    test('uses daemon objects as fallback when objectStatus is empty', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {},
                objectInstanceStatus: {},
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );
        useFetchDaemonStatus.mockReturnValue({
            daemon: {
                cluster: {
                    object: {
                        'daemon/svc/obj1': {avail: 'up', frozen: 'unfrozen'},
                        'daemon/svc/obj2': {avail: 'down', frozen: 'frozen'},
                    }
                }
            },
        });

        setupComponent();
        await waitForComponentToLoad();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /daemon\/svc\/obj1/i})).toBeInTheDocument();
            expect(screen.getByRole('row', {name: /daemon\/svc\/obj2/i})).toBeInTheDocument();
        });
    });

    test('filters by unprovisioned global state and finds objects', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await selectFilterOption('Global State', 'Unprovisioned');
        await waitForFilterApplied();

        await waitFor(() => {
            expect(screen.getByRole('row', {name: /test-ns\/svc\/unprovisioned/i})).toBeInTheDocument();
        });
        expect(screen.queryByRole('row', {name: /test-ns\/svc\/test1/i})).not.toBeInTheDocument();
    });

    test('freeze action is available for non-frozen object and unfreeze for frozen', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const row1 = screen.getByRole('row', {name: /test-ns\/svc\/test1/i});
        const menuButton1 = within(row1).getByRole('button', {name: /more actions/i});
        fireEvent.click(menuButton1);
        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });
        let menu = screen.getByRole('menu');
        expect(within(menu).getByText('Freeze')).toBeInTheDocument();
        expect(within(menu).queryByText('Unfreeze')).not.toBeInTheDocument();

        fireEvent.keyDown(menu, {key: 'Escape', code: 'Escape'});
        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        const row2 = screen.getByRole('row', {name: /test-ns\/svc\/test2/i});
        const menuButton2 = within(row2).getByRole('button', {name: /more actions/i});
        fireEvent.click(menuButton2);
        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });
        menu = screen.getByRole('menu');
        expect(within(menu).queryByText('Freeze')).not.toBeInTheDocument();
        expect(within(menu).getByText('Unfreeze')).toBeInTheDocument();
    });

    test('executes unfreeze action on frozen object', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await selectObject('test-ns/svc/test2');

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText('Unfreeze'));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/test-ns/svc/test2/action/unfreeze'),
                expect.any(Object)
            );
        });
    });

    test('handles partial success during action execution', async () => {
        global.fetch
            .mockResolvedValueOnce({ok: true})
            .mockResolvedValueOnce({ok: false, status: 500});

        setupComponent();
        await waitForComponentToLoad();

        await selectObject('test-ns/svc/test1');
        await selectObject('test-ns/svc/test2');

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText('Restart'));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/partially succeeded: 1 ok, 1 errors/i);
        });
    });

    test('handles network error during action', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));

        setupComponent();
        await waitForComponentToLoad();

        await selectObject('test-ns/svc/test1');

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText('Restart'));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/failed on all 1 object\(s\)/i);
        });
    });

    test('removes filter chip by clicking delete icon', async () => {
        setupComponent();
        await waitForComponentToLoad();

        await selectFilterOption('Namespace', 'test-ns');
        await waitForFilterApplied();

        const chip = screen.getByText('test-ns').closest('.MuiChip-root');
        expect(chip).toBeInTheDocument();

        const deleteIcon = within(chip).getByTestId('CloseIcon');
        fireEvent.click(deleteIcon);

        await waitFor(() => {
            expect(screen.queryByText('test-ns')).not.toBeInTheDocument();
            expect(screen.getByRole('row', {name: /root\/svc\/test3/i})).toBeInTheDocument();
        });
    });

    test('global actions button is disabled when no objects selected', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const actionsButton = screen.getByRole('button', {name: /actions on selected objects/i});
        expect(actionsButton).toBeDisabled();
    });

    test('row menu closes when clicking outside (backdrop)', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const row = screen.getByRole('row', {name: /test-ns\/svc\/test1/i});
        const menuButton = within(row).getByRole('button', {name: /more actions/i});
        fireEvent.click(menuButton);

        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        const backdrop = document.querySelector('.MuiModal-backdrop');
        expect(backdrop).toBeInTheDocument();
        fireEvent.click(backdrop);

        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });

    test('sorts by status with n/a values', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const statusHeader = screen.getByText('Status');
        fireEvent.click(statusHeader);

        await waitFor(() => {
            const rows = screen.getAllByRole('row').slice(1);
            const firstRow = rows[0];
            expect(firstRow).toHaveTextContent(/test-ns\/svc\/test4/i);
        });
    });

    test('sorts by node column when some objects lack node data', async () => {
        setupComponent();
        await waitForComponentToLoad();

        const nodeHeader = screen.getByRole('columnheader', {name: /node1/i});
        fireEvent.click(nodeHeader);

        await waitFor(() => {
            expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
        });
    });

    test('scroll does not load more when already loading', async () => {
        const manyObjects = {};
        for (let i = 0; i < 50; i++) {
            manyObjects[`test/svc/obj${i}`] = {avail: 'up', frozen: 'unfrozen'};
        }
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: manyObjects,
                objectInstanceStatus: {},
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        const tableContainer = document.querySelector('.MuiTableContainer-root');
        Object.defineProperty(tableContainer, 'scrollHeight', {value: 1000});
        Object.defineProperty(tableContainer, 'clientHeight', {value: 500});
        Object.defineProperty(tableContainer, 'scrollTop', {value: 500});

        fireEvent.scroll(tableContainer);

        await waitFor(() => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        fireEvent.scroll(tableContainer);

        await new Promise(r => setTimeout(r, 50));
        const rows = screen.getAllByRole('row').slice(1);
        expect(rows.length).toBe(30);
    });

    test('scroll does not load more when no more objects', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {'test/svc/obj1': {avail: 'up'}},
                objectInstanceStatus: {},
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        const tableContainer = document.querySelector('.MuiTableContainer-root');
        Object.defineProperty(tableContainer, 'scrollHeight', {value: 1000});
        Object.defineProperty(tableContainer, 'clientHeight', {value: 500});
        Object.defineProperty(tableContainer, 'scrollTop', {value: 500});

        fireEvent.scroll(tableContainer);

        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        const rows = screen.getAllByRole('row').slice(1);
        expect(rows.length).toBe(1);
    });

    test('synchronizes URL with debounce', async () => {
        jest.useFakeTimers();
        setupComponent();
        await waitForComponentToLoad();

        const searchInput = screen.getByLabelText('Name');
        fireEvent.change(searchInput, {target: {value: 'test'}});

        jest.advanceTimersByTime(300);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
                '/objects?name=test',
                {replace: true}
            );
        });

        jest.useRealTimers();
    });

    test('updates filters from URL on location change', async () => {
        const {rerender} = setupComponent();
        await waitForComponentToLoad();

        require('react-router-dom').useLocation.mockReturnValue({
            search: '?namespace=test-ns&kind=svc&name=test1',
            pathname: '/objects'
        });

        rerender(
            <MemoryRouter>
                <Objects/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText('Namespace')).toHaveTextContent('test-ns');
            expect(screen.getByText('test-ns')).toBeInTheDocument();
            expect(screen.getByText('svc')).toBeInTheDocument();
            expect(screen.getByLabelText('Name')).toHaveValue('test1');
        });
    });

    test('handles parseObjectName with different formats', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'simpleName': {avail: 'up', frozen: 'unfrozen'},
                },
                objectInstanceStatus: {
                    'simpleName': {node1: {avail: 'up'}},
                },
                instanceMonitor: {},
                removeObject: mockRemoveObject,
            })
        );

        setupComponent();
        await waitForComponentToLoad();

        await selectObject('simpleName');
        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText('Restart'));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/root/svc/simpleName/action/restart'),
                expect.any(Object)
            );
        });
    });

    test('shows snackbar when token missing on action', async () => {
        jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

        setupComponent();
        await waitForComponentToLoad();

        await selectObject('test-ns/svc/test1');

        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText('Restart'));

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Authentication token not found');
        });
    });

    test('closes snackbar after autoHideDuration', async () => {
        jest.useFakeTimers();
        setupComponent();
        await waitForComponentToLoad();

        await selectObject('test-ns/svc/test1');
        fireEvent.click(screen.getByRole('button', {name: /actions on selected objects/i}));
        fireEvent.click(screen.getByText('Restart'));
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', {name: /Confirm/i}));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        jest.advanceTimersByTime(4000);

        await waitFor(() => {
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        jest.useRealTimers();
    });
});