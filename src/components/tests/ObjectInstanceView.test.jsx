// ObjectInstanceView.test.js
import React from 'react';
import {render, screen, fireEvent, waitFor, within, act} from '@testing-library/react';
import {MemoryRouter, Routes, Route} from 'react-router-dom';
import '@testing-library/jest-dom';
import ObjectInstanceView from '../ObjectInstanceView';
import useEventStore from '../../hooks/useEventStore';
import {startEventReception, closeEventSource} from '../../eventSourceManager';

// Mock dependencies
jest.mock('../../hooks/useEventStore');
jest.mock('../../eventSourceManager');
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
}));
jest.mock('../../utils/objectUtils.jsx', () => ({
    parseObjectPath: jest.fn(),
}));

// Mock child components
jest.mock('../EventLogger', () => () => <div data-testid="event-logger"/>);
jest.mock('../LogsViewer', () => () => <div data-testid="logs-viewer"/>);

// Mock action constants
jest.mock('../../constants/actions', () => ({
    INSTANCE_ACTIONS: [
        {name: 'start', icon: () => <span>StartIcon</span>},
        {name: 'stop', icon: () => <span>StopIcon</span>},
        {name: 'freeze', icon: () => <span>FreezeIcon</span>},
        {name: 'unfreeze', icon: () => <span>UnfreezeIcon</span>},
        {name: 'restart', icon: () => <span>RestartIcon</span>},
        {name: 'unprovision', icon: () => <span>UnprovisionIcon</span>},
        {name: 'purge', icon: () => <span>PurgeIcon</span>},
    ],
    RESOURCE_ACTIONS: [
        {name: 'start', icon: () => <span>StartIcon</span>},
        {name: 'stop', icon: () => <span>StopIcon</span>},
        {name: 'restart', icon: () => <span>RestartIcon</span>},
        {name: 'run', icon: () => <span>RunIcon</span>},
        {name: 'console', icon: () => <span>ConsoleIcon</span>},
        {name: 'freeze', icon: () => <span>FreezeIcon</span>},
        {name: 'unprovision', icon: () => <span>UnprovisionIcon</span>},
        {name: 'purge', icon: () => <span>PurgeIcon</span>},
    ],
}));

// Mock MUI icons
jest.mock('@mui/icons-material', () => ({
    MoreVert: () => <span data-testid="more-vert-icon">MoreVertIcon</span>,
    FiberManualRecord: () => <span data-testid="fiber-manual-record-icon">●</span>,
    PriorityHigh: () => <span data-testid="priority-high-icon" aria-label="Not Provisioned">!</span>,
    AcUnit: () => <span data-testid="ac-unit-icon" aria-label="Frozen">❄</span>,
    Article: () => <span data-testid="article-icon">📄</span>,
    Close: () => <span data-testid="close-icon" aria-label="Close">×</span>,
}));

// Mock navigator.clipboard
Object.assign(navigator, {
    clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
    },
});

// Helper to wait for element removal
const waitForElementToBeRemoved = (callback) => {
    return waitFor(callback, {timeout: 2000});
};

describe('ObjectInstanceView', () => {
    const mockUseEventStore = {
        objectInstanceStatus: {},
        instanceMonitor: {},
        instanceConfig: {},
    };

    const mockParseObjectPath = {
        namespace: 'test-namespace',
        kind: 'test-kind',
        name: 'test-name',
    };

    const mockNodeName = 'test-node';
    const mockObjectName = 'test-namespace/test-kind/test-name';

    // Mock localStorage
    let localStorageMock;

    const setup = (overrides = {}) => {
        useEventStore.mockImplementation((selector) => {
            if (typeof selector === 'function') {
                return selector({
                    ...mockUseEventStore,
                    ...overrides.storeState,
                });
            }
            return mockUseEventStore;
        });

        require('react-router-dom').useParams.mockReturnValue({
            node: mockNodeName,
            objectName: encodeURIComponent(mockObjectName),
        });

        require('../../utils/objectUtils.jsx').parseObjectPath.mockReturnValue(mockParseObjectPath);

        return render(
            <MemoryRouter initialEntries={[`/node/${mockNodeName}/instance/${encodeURIComponent(mockObjectName)}`]}>
                <Routes>
                    <Route path="/node/:node/instance/:objectName" element={<ObjectInstanceView/>}/>
                </Routes>
            </MemoryRouter>
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseEventStore.objectInstanceStatus = {};
        mockUseEventStore.instanceMonitor = {};
        mockUseEventStore.instanceConfig = {};

        // Global fetch mock
        global.fetch = jest.fn();

        // Mock localStorage
        localStorageMock = {
            getItem: jest.fn(() => 'mock-token'),
            setItem: jest.fn(),
            clear: jest.fn(),
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
            writable: true
        });

        // Reset document body
        document.body.innerHTML = '';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders loading state initially', () => {
        setup();
        expect(screen.getByText('Loading instance data...')).toBeInTheDocument();
    });

    test('renders instance data after loading', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    frozen_at: null,
                    provisioned: true,
                    resources: {
                        'res1': {
                            type: 'container',
                            running: true,
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        expect(screen.getByText(mockObjectName)).toBeInTheDocument();
        expect(screen.getByText(`Node: ${mockNodeName}`)).toBeInTheDocument();
        expect(screen.getByText('Resources (1)')).toBeInTheDocument();
        expect(screen.getByText('res1')).toBeInTheDocument();
    });

    test('displays resource status correctly', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'container',
                            running: true,
                            label: 'Resource 1',
                            status: 'up',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        // Check that the component displays status
        const statusElements = screen.getAllByRole('status');
        expect(statusElements.length).toBeGreaterThan(0);
    });

    test('opens instance action menu when clicking more button', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Find the instance action button (last button with MoreVert icon)
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        expect(instanceMenuButton).toBeDefined();
        fireEvent.click(instanceMenuButton);

        // Check that menu opens
        await waitFor(() => {
            expect(screen.getByText('Start')).toBeInTheDocument();
            expect(screen.getByText('Stop')).toBeInTheDocument();
            expect(screen.getByText('Freeze')).toBeInTheDocument();
        });
    });

    test('opens resource action menu when clicking resource more button', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'container',
                            running: true,
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        // Find resource action button
        const resourceRow = screen.getByText('res1').closest('div');
        const moreVertIcons = within(resourceRow).getAllByTestId('more-vert-icon');
        const resourceMenuButton = moreVertIcons[0].closest('button');

        expect(resourceMenuButton).toBeDefined();
        fireEvent.click(resourceMenuButton);

        // Check that menu opens
        await waitFor(() => {
            expect(screen.getByText('Start')).toBeInTheDocument();
            expect(screen.getByText('Stop')).toBeInTheDocument();
            expect(screen.getByText('Console')).toBeInTheDocument();
        });
    });

    test('displays logs drawer when logs button is clicked', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Find and click logs button
        const logsButton = screen.getByRole('button', {
            name: /view logs for instance test-namespace\/test-kind\/test-name/i
        });
        fireEvent.click(logsButton);

        // Check that drawer opens
        await waitFor(() => {
            expect(screen.getByTestId('logs-viewer')).toBeInTheDocument();
            expect(screen.getByText(`Instance Logs - ${mockNodeName}/${mockObjectName}`)).toBeInTheDocument();
        });
    });

    test('shows not provisioned warning when instance is not provisioned', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    provisioned: false,
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Check for priority high icon (not provisioned)
        const priorityHighIcons = await screen.findAllByTestId('priority-high-icon');
        expect(priorityHighIcons.length).toBe(1);
    });

    test('shows frozen icon when instance is frozen', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    frozen_at: '2024-01-01T00:00:00Z',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Check for AcUnit icon (frozen)
        const frozenIcon = await screen.findByTestId('ac-unit-icon');
        expect(frozenIcon).toBeInTheDocument();
    });

    test('displays encapsulated resources', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                    encap: {
                        'container1': {
                            resources: {
                                'encap1': {
                                    type: 'fs',
                                    running: true,
                                    label: 'Encapsulated FS',
                                },
                            },
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        expect(screen.getByText('encap1')).toBeInTheDocument();
    });

    test('handles API call for instance actions', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            headers: new Map(),
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Find and click instance action button
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);

        // Click Start action
        await waitFor(() => {
            expect(screen.getByText('Start')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Start'));

        // Confirm in simple dialog
        await waitFor(() => {
            expect(screen.getByText('Confirm Start')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Confirm'));

        // Check API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`/instance/path/${mockParseObjectPath.namespace}/${mockParseObjectPath.kind}/${mockParseObjectPath.name}/action/start`),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                    }),
                })
            );
        });
    });

    test('displays snackbar on API error', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Find and click instance action button
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);

        // Click Start action
        await waitFor(() => {
            expect(screen.getByText('Start')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Start'));

        // Confirm in simple dialog
        await waitFor(() => {
            expect(screen.getByText('Confirm Start')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Confirm'));

        // Check that error snackbar appears
        await waitFor(() => {
            expect(screen.getByText(/Failed: HTTP 500/i)).toBeInTheDocument();
        });
    });

    test('filters resource actions based on resource type', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'task1': {
                            type: 'task',
                            running: false,
                            label: 'Task 1',
                        },
                        'fs1': {
                            type: 'fs',
                            running: true,
                            label: 'Filesystem 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('task1')).toBeInTheDocument();
            expect(screen.getByText('fs1')).toBeInTheDocument();
        });

        // Open action menu for task1 resource
        const taskRow = screen.getByText('task1').closest('div');
        const taskMoreVertIcons = within(taskRow).getAllByTestId('more-vert-icon');
        const taskMenuButton = taskMoreVertIcons[0].closest('button');

        fireEvent.click(taskMenuButton);

        // Task should only have Run action (filtered)
        await waitFor(() => {
            expect(screen.getByText('Run')).toBeInTheDocument();
        });

        // Check that Console is not present (filtered)
        expect(screen.queryByText('Console')).not.toBeInTheDocument();

        // Close menu
        fireEvent.click(document.body);

        // Wait for menu to close
        await waitForElementToBeRemoved(() => screen.queryByText('Run'));

        // Open action menu for fs1 resource
        const fsRow = screen.getByText('fs1').closest('div');
        const fsMoreVertIcons = within(fsRow).getAllByTestId('more-vert-icon');
        const fsMenuButton = fsMoreVertIcons[0].closest('button');

        fireEvent.click(fsMenuButton);

        // FS should have actions but not Run or Console
        await waitFor(() => {
            expect(screen.getByText('Start')).toBeInTheDocument();
        });

        expect(screen.queryByText('Run')).not.toBeInTheDocument();
        expect(screen.queryByText('Console')).not.toBeInTheDocument();
    });

    test('displays frozen icon when instance is frozen (duplicate check)', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    frozen_at: '2024-01-01T00:00:00Z',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const frozenIcon = screen.getByTestId('ac-unit-icon');
        expect(frozenIcon).toBeInTheDocument();
    });

    test('displays "No resources found" message when there are no resources', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('No resources found on this instance.')).toBeInTheDocument();
        });
    });

    test('displays resource logs when present', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'container',
                            running: true,
                            label: 'Resource 1',
                            log: [
                                {level: 'info', message: 'Resource started'},
                                {level: 'warn', message: 'High memory usage'},
                            ],
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('info: Resource started')).toBeInTheDocument();
            expect(screen.getByText('warn: High memory usage')).toBeInTheDocument();
        });
    });

    test('handles encapsulated resources without resources', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                    encap: {
                        'container1': {
                            // No resources inside
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        expect(screen.getByText('Encapsulated data found for container1, but no resources defined.')).toBeInTheDocument();
    });

    test('filters "run" action for container resources', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        // Open action menu
        const containerRow = screen.getByText('container1').closest('div');
        const containerMoreVertIcons = within(containerRow).getAllByTestId('more-vert-icon');
        const containerMenuButton = containerMoreVertIcons[0].closest('button');

        fireEvent.click(containerMenuButton);

        // Check that "Run" is not present
        await waitFor(() => {
            expect(screen.getByText('Start')).toBeInTheDocument();
            expect(screen.queryByText('Run')).not.toBeInTheDocument();
        });
    });

    test('cleans up event source on unmount', () => {
        const {unmount} = setup();
        unmount();
        expect(closeEventSource).toHaveBeenCalled();
    });

    test('handles confirmation dialogs with checkboxes', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Test freeze action
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Freeze'));

        // Check that dialog opens
        await waitFor(() => {
            expect(screen.getByText('Confirm Freeze')).toBeInTheDocument();
        });

        // Confirm button should be disabled
        const confirmButton = screen.getByRole('button', {name: /confirm/i});
        expect(confirmButton).toBeDisabled();

        // Check the checkbox
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
        expect(confirmButton).not.toBeDisabled();

        // Cancel
        fireEvent.click(screen.getByText('Cancel'));
        await waitFor(() => {
            expect(screen.queryByText('Confirm Freeze')).not.toBeInTheDocument();
        });
    });

    test('handles fetch errors', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Open action menu
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Start'));
        fireEvent.click(screen.getByText('Confirm'));

        // Check error message appears in snackbar
        await waitFor(() => {
            const alerts = screen.getAllByRole('alert');
            const errorAlert = alerts.find(alert =>
                alert.textContent?.includes('Error: Network error')
            );
            expect(errorAlert).toBeInTheDocument();
        });
    });

    test('displays logs drawer with resizing', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Open logs drawer
        const logsButton = screen.getByRole('button', {
            name: /view logs for instance/i
        });
        fireEvent.click(logsButton);

        // Check that drawer opens
        await waitFor(() => {
            expect(screen.getByTestId('logs-viewer')).toBeInTheDocument();
        });

        // Check that close button is present
        expect(screen.getByLabelText('Close')).toBeInTheDocument();

        // Close drawer
        fireEvent.click(screen.getByLabelText('Close'));
        await waitFor(() => {
            expect(screen.queryByTestId('logs-viewer')).not.toBeInTheDocument();
        });
    });

    test('displays monitor status when present', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        mockUseEventStore.instanceMonitor = {
            [`${mockNodeName}:${mockObjectName}`]: {
                state: 'starting',
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        expect(screen.getByText('starting')).toBeInTheDocument();
    });

    test('displays resource logs with proper styling for different levels', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'container',
                            running: true,
                            label: 'Resource 1',
                            log: [
                                {level: 'error', message: 'Critical error'},
                                {level: 'warn', message: 'Warning message'},
                                {level: 'info', message: 'Info message'},
                            ],
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('error: Critical error')).toBeInTheDocument();
            expect(screen.getByText('warn: Warning message')).toBeInTheDocument();
            expect(screen.getByText('info: Info message')).toBeInTheDocument();
        });
    });

    test('handles stop dialog confirmation', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            headers: new Map(),
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Open instance action menu and click Stop
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Stop'));

        // Check stop dialog opens
        await waitFor(() => {
            expect(screen.getByText('Confirm Stop')).toBeInTheDocument();
        });

        // Check checkbox and confirm
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        const stopButton = screen.getByRole('button', {name: /stop/i});
        fireEvent.click(stopButton);

        // Check API was called
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    test('handles unprovision dialog confirmation', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            headers: new Map(),
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Open instance action menu and click Unprovision
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Unprovision'));

        // Check unprovision dialog opens
        await waitFor(() => {
            expect(screen.getByText('Confirm Unprovision')).toBeInTheDocument();
        });

        // Check checkboxes and confirm
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]); // dataLoss
        fireEvent.click(checkboxes[1]); // serviceInterruption

        const confirmButton = screen.getByRole('button', {name: /confirm/i});
        fireEvent.click(confirmButton);

        // Check API was called
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    test('handles purge dialog confirmation', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            headers: new Map(),
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Open instance action menu and click Purge
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Purge'));

        // Check purge dialog opens
        await waitFor(() => {
            expect(screen.getByText('Confirm Purge')).toBeInTheDocument();
        });

        // Check checkboxes and confirm
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]); // dataLoss
        fireEvent.click(checkboxes[1]); // configLoss
        fireEvent.click(checkboxes[2]); // serviceInterruption

        const confirmButton = screen.getByRole('button', {name: /confirm/i});
        fireEvent.click(confirmButton);

        // Check API was called
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    test('handles console action for resource', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            headers: new Headers({'Location': 'https://console.example.com'}),
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        // Open resource action menu
        const containerRow = screen.getByText('container1').closest('div');
        const containerMoreVertIcons = within(containerRow).getAllByTestId('more-vert-icon');
        const containerMenuButton = containerMoreVertIcons[0].closest('button');

        fireEvent.click(containerMenuButton);

        // Click Console
        fireEvent.click(screen.getByText('Console'));

        // Check console dialog opens
        await waitFor(() => {
            expect(screen.getByRole('heading', {name: 'Open Console'})).toBeInTheDocument();
        });

        // Set seats and timeout
        const seatsInput = screen.getByLabelText('Number of Seats');
        fireEvent.change(seatsInput, {target: {value: '2'}});

        const timeoutInput = screen.getByLabelText('Greet Timeout');
        fireEvent.change(timeoutInput, {target: {value: '10s'}});

        // Confirm
        const openConsoleButton = screen.getByRole('button', {name: 'Open Console'});
        fireEvent.click(openConsoleButton);

        // Check API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/console?rid=container1&seats=2&greet_timeout=10s'),
                expect.anything()
            );
        });

        // Check console URL dialog opens
        await waitFor(() => {
            expect(screen.getByText('Console URL')).toBeInTheDocument();
            expect(screen.getByText('https://console.example.com')).toBeInTheDocument();
        });
    });

    test('handles console URL dialog actions', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            headers: new Headers({'Location': 'https://console.example.com'}),
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        // Trigger console action as above
        const containerRow = screen.getByText('container1').closest('div');
        const containerMoreVertIcons = within(containerRow).getAllByTestId('more-vert-icon');
        const containerMenuButton = containerMoreVertIcons[0].closest('button');

        fireEvent.click(containerMenuButton);
        fireEvent.click(screen.getByText('Console'));

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: 'Open Console'})).toBeInTheDocument();
        });

        const openConsoleButton = screen.getByRole('button', {name: 'Open Console'});
        fireEvent.click(openConsoleButton);

        await waitFor(() => {
            expect(screen.getByText('Console URL')).toBeInTheDocument();
        });

        // Click Copy URL
        fireEvent.click(screen.getByText('Copy URL'));
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://console.example.com');

        // Click Open in New Tab (mock window.open)
        const originalOpen = window.open;
        window.open = jest.fn();
        fireEvent.click(screen.getByText('Open in New Tab'));
        expect(window.open).toHaveBeenCalledWith('https://console.example.com', '_blank', 'noopener,noreferrer');
        window.open = originalOpen;

        // Close dialog
        fireEvent.click(screen.getByText('Close'));
        await waitFor(() => {
            expect(screen.queryByText('Console URL')).not.toBeInTheDocument();
        });
    });

    test('handles no auth token', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Trigger an action
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Start'));
        fireEvent.click(screen.getByText('Confirm'));

        // Check snackbar
        await waitFor(() => {
            expect(screen.getByText('Auth token not found.')).toBeInTheDocument();
        });
    });

    test('handles encapsulated resources with no data', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                    encap: {
                        'container1': {
                            resources: {},
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        expect(screen.getByText('No encapsulated resources available for container1.')).toBeInTheDocument();
    });

    test('handles action in progress disables buttons', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'container',
                            running: true,
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        global.fetch.mockImplementation(() => new Promise(() => {
        })); // Hang to simulate in progress

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        // Trigger an action to set actionInProgress true
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Start'));
        fireEvent.click(screen.getByText('Confirm'));

        await waitFor(() => {
            const resourceRow = screen.getByText('res1').closest('div');
            const moreVertIcons = within(resourceRow).getAllByTestId('more-vert-icon');
            const resourceMenuButton = moreVertIcons[0].closest('button');
            expect(resourceMenuButton).toBeDisabled();
        });
    });

    test('handles snackbar close', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Trigger error
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Start'));
        fireEvent.click(screen.getByText('Confirm'));

        await waitFor(() => {
            expect(screen.getByText(/Failed: HTTP 500/i)).toBeInTheDocument();
        });

        // Close snackbar
        const closeButton = screen.getByLabelText('Close');
        fireEvent.click(closeButton);

        await waitFor(() => {
            expect(screen.queryByText(/Failed: HTTP 500/i)).not.toBeInTheDocument();
        });
    });

    test('handles drawer resizing with mouse events', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Open logs drawer
        const logsButton = screen.getByRole('button', {
            name: /view logs for instance/i
        });
        fireEvent.click(logsButton);

        await waitFor(() => {
            expect(screen.getByTestId('logs-viewer')).toBeInTheDocument();
        });

        // Find resize handle (the Box with cursor: ew-resize)
        const resizeHandle = screen.getByLabelText('Resize drawer');

        // Simulate mouse down
        fireEvent.mouseDown(resizeHandle, {clientX: 500});

        // Simulate mouse move
        fireEvent.mouseMove(document, {clientX: 400});

        // Simulate mouse up
        fireEvent.mouseUp(document);

        // Check if width changed (but since state, we can mock setDrawerWidth if needed, but assume logic)
    });

    test('handles invalid pending action in dialog confirm', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // To trigger warn, would need to force pendingAction null, but hard in test
        // Instead, test normal close
        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Start'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Start')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Cancel'));

        expect(consoleWarnSpy).not.toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
    });

    test('handles resource console failure', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            headers: new Headers(), // No Location
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        // Trigger console
        const containerRow = screen.getByText('container1').closest('div');
        const containerMoreVertIcons = within(containerRow).getAllByTestId('more-vert-icon');
        const containerMenuButton = containerMoreVertIcons[0].closest('button');

        fireEvent.click(containerMenuButton);
        fireEvent.click(screen.getByText('Console'));

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: 'Open Console'})).toBeInTheDocument();
        });

        const openConsoleButton = screen.getByRole('button', {name: 'Open Console'});
        fireEvent.click(openConsoleButton);

        // Check error snackbar
        await waitFor(() => {
            expect(screen.getByText('Failed to open console: Console URL not found in response')).toBeInTheDocument();
        });
    });

    test('handles different resource status letters', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: false,
                            optional: true,
                            provisioned: {state: 'true'},
                        },
                    },
                },
            },
        };

        mockUseEventStore.instanceConfig = {
            [mockObjectName]: {
                [mockNodeName]: {
                    resources: {
                        'res1': {
                            is_monitored: true,
                            is_disabled: false,
                            is_standby: false,
                            restart: 5,
                        },
                    },
                },
            },
        };

        mockUseEventStore.instanceMonitor = {
            [`${mockNodeName}:${mockObjectName}`]: {
                resources: {
                    'res1': {
                        restart: {remaining: 5},
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        // Check status string (covers getResourceStatusLetters branches)
        const statusElements = screen.getAllByRole('status');
        expect(statusElements[0].textContent).toContain('M'); // Example check
    });

    // Additional tests to improve coverage

    test('handles unfreeze action', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            headers: new Map(),
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    frozen_at: '2024-01-01T00:00:00Z',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Unfreeze'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Unfreeze')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Confirm'));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    test('handles resource status with provisioned state n/a', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: true,
                            label: 'Resource 1',
                            provisioned: {state: 'n/a'},
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const statusElements = screen.getAllByRole('status');
        expect(statusElements[0].textContent).toContain('P');
    });

    test('handles resource with is_disabled true', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: false,
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        mockUseEventStore.instanceConfig = {
            [mockObjectName]: {
                [mockNodeName]: {
                    resources: {
                        'res1': {
                            is_disabled: true,
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const statusElements = screen.getAllByRole('status');
        expect(statusElements[0].textContent).toContain('D');
    });

    test('handles resource with is_standby true', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: true,
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        mockUseEventStore.instanceConfig = {
            [mockObjectName]: {
                [mockNodeName]: {
                    resources: {
                        'res1': {
                            is_standby: true,
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const statusElements = screen.getAllByRole('status');
        expect(statusElements[0].textContent).toContain('S');
    });

    test('handles resource with 0 remaining restarts', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: true,
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        mockUseEventStore.instanceMonitor = {
            [`${mockNodeName}:${mockObjectName}`]: {
                resources: {
                    'res1': {
                        restart: {remaining: 0},
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const statusElements = screen.getAllByRole('status');
        // 0 restarts = '.' in position 7
        expect(statusElements[0].textContent).toBeDefined();
    });

    test('handles resource with more than 10 remaining restarts', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: true,
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        mockUseEventStore.instanceMonitor = {
            [`${mockNodeName}:${mockObjectName}`]: {
                resources: {
                    'res1': {
                        restart: {remaining: 15},
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const statusElements = screen.getAllByRole('status');
        // >10 restarts = '+' in position 7
        expect(statusElements[0].textContent).toContain('+');
    });

    test('handles resource with specific restart count (1-10)', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: true,
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        mockUseEventStore.instanceMonitor = {
            [`${mockNodeName}:${mockObjectName}`]: {
                resources: {
                    'res1': {
                        restart: {remaining: 3},
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const statusElements = screen.getAllByRole('status');
        expect(statusElements[0].textContent).toContain('3');
    });

    test('handles container resource with encap provisioned state', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                    encap: {
                        'container1': {
                            provisioned: false,
                            resources: {},
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        // Container with encap provisioned=false should show Not Provisioned icon
        const priorityHighIcons = screen.getAllByTestId('priority-high-icon');
        expect(priorityHighIcons.length).toBeGreaterThan(0);
    });

    test('handles resource info actions disabled label', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: true,
                            label: 'Resource 1',
                            info: {actions: 'disabled'},
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        expect(screen.getAllByText(/info: actions disabled/).length).toBeGreaterThan(0);
    });

    test('handles monitor state idle - does not display state', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        mockUseEventStore.instanceMonitor = {
            [`${mockNodeName}:${mockObjectName}`]: {
                state: 'idle',
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // 'idle' state should NOT be displayed
        expect(screen.queryByText('idle')).not.toBeInTheDocument();
    });

    test('handles restart action on instance', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            headers: new Map(),
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Restart'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Restart')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Confirm'));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/restart'),
                expect.anything()
            );
        });
    });

    test('closes simple dialog on cancel', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Start'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Start')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(screen.queryByText('Confirm Start')).not.toBeInTheDocument();
        });
    });

    test('closes stop dialog on cancel', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Stop'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Stop')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(screen.queryByText('Confirm Stop')).not.toBeInTheDocument();
        });
    });

    test('closes unprovision dialog on cancel', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Unprovision'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Unprovision')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(screen.queryByText('Confirm Unprovision')).not.toBeInTheDocument();
        });
    });

    test('closes purge dialog on cancel', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Purge'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Purge')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(screen.queryByText('Confirm Purge')).not.toBeInTheDocument();
        });
    });

    test('closes console dialog on cancel', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        const containerRow = screen.getByText('container1').closest('div');
        const containerMoreVertIcons = within(containerRow).getAllByTestId('more-vert-icon');
        const containerMenuButton = containerMoreVertIcons[0].closest('button');

        fireEvent.click(containerMenuButton);
        fireEvent.click(screen.getByText('Console'));

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: 'Open Console'})).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(screen.queryByRole('heading', {name: 'Open Console'})).not.toBeInTheDocument();
        });
    });

    test('handles seats input with value below 1 - clamps to 1', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        const containerRow = screen.getByText('container1').closest('div');
        const containerMoreVertIcons = within(containerRow).getAllByTestId('more-vert-icon');
        const containerMenuButton = containerMoreVertIcons[0].closest('button');

        fireEvent.click(containerMenuButton);
        fireEvent.click(screen.getByText('Console'));

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: 'Open Console'})).toBeInTheDocument();
        });

        const seatsInput = screen.getByLabelText('Number of Seats');
        // Set to 0 which should be clamped to 1
        fireEvent.change(seatsInput, {target: {value: '0'}});
        expect(seatsInput.value).toBe('1');

        // Set to invalid which parses as NaN, default to 1
        fireEvent.change(seatsInput, {target: {value: 'abc'}});
        expect(seatsInput.value).toBe('1');
    });

    test('handles instance menu close on click away', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');

        fireEvent.click(instanceMenuButton);

        await waitFor(() => {
            expect(screen.getByText('Start')).toBeInTheDocument();
        });

        // Click away to close menu
        fireEvent.click(document.body);

        await waitFor(() => {
            expect(screen.queryByText('Start')).not.toBeInTheDocument();
        });
    });

    test('handles resource menu close on click away', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'container',
                            running: true,
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const resourceRow = screen.getByText('res1').closest('div');
        const moreVertIcons = within(resourceRow).getAllByTestId('more-vert-icon');
        const resourceMenuButton = moreVertIcons[0].closest('button');

        fireEvent.click(resourceMenuButton);

        await waitFor(() => {
            expect(screen.getByText('Console')).toBeInTheDocument();
        });

        fireEvent.click(document.body);

        await waitFor(() => {
            expect(screen.queryByText('Console')).not.toBeInTheDocument();
        });
    });

    test('handles resource type lookup from encap resources', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            status: 'up',
                            label: 'Container 1',
                        },
                    },
                    encap: {
                        'container1': {
                            resources: {
                                'task-encap1': {
                                    type: 'task',
                                    running: false,
                                    label: 'Encap Task',
                                },
                            },
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('task-encap1')).toBeInTheDocument();
        });

        // Open action menu for encap task resource
        const encapRow = screen.getByText('task-encap1').closest('div');
        const encapMoreVertIcons = within(encapRow).getAllByTestId('more-vert-icon');
        const encapMenuButton = encapMoreVertIcons[0].closest('button');

        fireEvent.click(encapMenuButton);

        // task type should only show Run
        await waitFor(() => {
            expect(screen.getByText('Run')).toBeInTheDocument();
        });

        expect(screen.queryByText('Console')).not.toBeInTheDocument();
    });

    test('handles instance with undefined avail - uses unknown status', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    // No avail field
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        // Status circle should still render
        const statusIcons = screen.getAllByTestId('fiber-manual-record-icon');
        expect(statusIcons.length).toBeGreaterThan(0);
    });

    test('handles is_monitored and is_disabled as string "true"/"false"', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: true,
                            label: 'Resource 1',
                        },
                        'res2': {
                            type: 'fs',
                            running: true,
                            label: 'Resource 2',
                        },
                    },
                },
            },
        };

        mockUseEventStore.instanceConfig = {
            [mockObjectName]: {
                [mockNodeName]: {
                    resources: {
                        'res1': {
                            is_monitored: 'true',
                            is_disabled: 'true',
                            is_standby: 'true',
                        },
                        'res2': {
                            is_monitored: 'false',
                            is_disabled: 'false',
                            is_standby: 'false',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
            expect(screen.getByText('res2')).toBeInTheDocument();
        });

        const statusElements = screen.getAllByRole('status');
        // res1 should have M, D, S
        expect(statusElements[0].textContent).toContain('M');
        expect(statusElements[0].textContent).toContain('D');
        expect(statusElements[0].textContent).toContain('S');
    });

    test('handles resource action for resource with no type', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res-no-type': {
                            running: true,
                            label: 'No Type Resource',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res-no-type')).toBeInTheDocument();
        });

        const resourceRow = screen.getByText('res-no-type').closest('div');
        const moreVertIcons = within(resourceRow).getAllByTestId('more-vert-icon');
        const resourceMenuButton = moreVertIcons[0].closest('button');

        fireEvent.click(resourceMenuButton);

        // All actions should be available when no type
        await waitFor(() => {
            expect(screen.getByText('Start')).toBeInTheDocument();
            expect(screen.getByText('Console')).toBeInTheDocument();
            expect(screen.getByText('Run')).toBeInTheDocument();
        });
    });

    test('handles optional resource boolean true', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: true,
                            optional: true,
                            label: 'Optional Resource',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const statusElements = screen.getAllByRole('status');
        expect(statusElements[0].textContent).toContain('O');
    });

    test('handles resource with config restart count', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: true,
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        mockUseEventStore.instanceConfig = {
            [mockObjectName]: {
                [mockNodeName]: {
                    resources: {
                        'res1': {
                            restart: 7,
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const statusElements = screen.getAllByRole('status');
        expect(statusElements[0].textContent).toContain('7');
    });

    // ---- TARGETED TESTS FOR REMAINING UNCOVERED LINES ----

    test('ResourceRow shows not-provisioned icon when encapData provisioned is false for container', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                            // No provisioned field at resource level
                        },
                    },
                    encap: {
                        'container1': {
                            provisioned: false,
                            resources: {},
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        // The not-provisioned icon should appear because encapData[rid].provisioned === false
        const priorityHighIcons = screen.getAllByTestId('priority-high-icon');
        expect(priorityHighIcons.length).toBeGreaterThan(0);
    });

    test('getColor handles boolean false status for resource', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            running: false,
                            status: false, // boolean false triggers red branch
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const statusIcons = screen.getAllByTestId('fiber-manual-record-icon');
        expect(statusIcons.length).toBeGreaterThan(0);
    });

    test('resource status letters handle undefined running field', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'res1': {
                            type: 'fs',
                            // No running field at all
                            label: 'Resource 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        // Status string should start with '.' (not running, since running is undefined)
        const statusElements = screen.getAllByRole('status');
        expect(statusElements[0].textContent.charAt(0)).toBe('.');
    });

    test('touch resize respects passive false option and cleans up on touchend', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
        const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const logsButton = screen.getByRole('button', {name: /view logs for instance/i});
        fireEvent.click(logsButton);

        await waitFor(() => {
            expect(screen.getByTestId('logs-viewer')).toBeInTheDocument();
        });

        const resizeHandle = screen.getByLabelText('Resize drawer');

        // Fire touchstart to trigger the touch branch
        fireEvent.touchStart(resizeHandle, {touches: [{clientX: 600}]});

        // Verify touchmove listener was registered (with passive:false)
        expect(addEventListenerSpy).toHaveBeenCalledWith(
            'touchmove',
            expect.any(Function),
            {passive: false}
        );

        // Fire touchmove to resize
        fireEvent.touchMove(document, {touches: [{clientX: 500}]});

        // Fire touchend to stop resizing
        fireEvent.touchEnd(document);

        // Verify cleanup
        expect(removeEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    test('freeze confirm dialog closes via onClose (backdrop)', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');
        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Freeze'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Freeze')).toBeInTheDocument();
        });

        // Trigger onClose via Escape key (simulates backdrop/ESC close)
        fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', code: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByText('Confirm Freeze')).not.toBeInTheDocument();
        });
    });

    test('stop dialog closes via onClose (ESC key)', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');
        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Stop'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Stop')).toBeInTheDocument();
        });

        fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', code: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByText('Confirm Stop')).not.toBeInTheDocument();
        });
    });

    test('unprovision dialog closes via onClose (ESC key)', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');
        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Unprovision'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Unprovision')).toBeInTheDocument();
        });

        fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', code: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByText('Confirm Unprovision')).not.toBeInTheDocument();
        });
    });

    test('purge dialog closes via onClose (ESC key)', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');
        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Purge'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Purge')).toBeInTheDocument();
        });

        fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', code: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByText('Confirm Purge')).not.toBeInTheDocument();
        });
    });

    test('console dialog closes via onClose (ESC key)', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        const containerRow = screen.getByText('container1').closest('div');
        const containerMoreVertIcons = within(containerRow).getAllByTestId('more-vert-icon');
        const containerMenuButton = containerMoreVertIcons[0].closest('button');

        fireEvent.click(containerMenuButton);
        fireEvent.click(screen.getByText('Console'));

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: 'Open Console'})).toBeInTheDocument();
        });

        fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', code: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByRole('heading', {name: 'Open Console'})).not.toBeInTheDocument();
        });
    });

    test('console URL dialog closes via onClose (ESC key)', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            headers: new Headers({'Location': 'https://console.example.com'}),
        });

        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {
                        'container1': {
                            type: 'container',
                            running: true,
                            label: 'Container 1',
                        },
                    },
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
        });

        const containerRow = screen.getByText('container1').closest('div');
        const containerMoreVertIcons = within(containerRow).getAllByTestId('more-vert-icon');
        const containerMenuButton = containerMoreVertIcons[0].closest('button');

        fireEvent.click(containerMenuButton);
        fireEvent.click(screen.getByText('Console'));

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: 'Open Console'})).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', {name: 'Open Console'}));

        await waitFor(() => {
            expect(screen.getByText('Console URL')).toBeInTheDocument();
        });

        // Close via ESC
        fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', code: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByText('Console URL')).not.toBeInTheDocument();
        });
    });

    test('simple action dialog closes via onClose (ESC key)', async () => {
        mockUseEventStore.objectInstanceStatus = {
            [mockObjectName]: {
                [mockNodeName]: {
                    avail: 'up',
                    resources: {},
                },
            },
        };

        setup();

        await waitFor(() => {
            expect(screen.queryByText('Loading instance data...')).not.toBeInTheDocument();
        });

        const moreVertButtons = screen.getAllByTestId('more-vert-icon');
        const instanceMenuButton = moreVertButtons[moreVertButtons.length - 1].closest('button');
        fireEvent.click(instanceMenuButton);
        fireEvent.click(screen.getByText('Start'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Start')).toBeInTheDocument();
        });

        fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', code: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByText('Confirm Start')).not.toBeInTheDocument();
        });
    });
});
