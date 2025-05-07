import React from 'react';
import {render, screen, fireEvent, waitFor, within, act, cleanup} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ObjectDetail from '../ObjectDetails';
import useEventStore from '../../hooks/useEventStore.js';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus.jsx';
import {closeEventSource} from '../../eventSourceManager.jsx';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
}));
jest.mock('../../hooks/useEventStore.js');
jest.mock('../../hooks/useFetchDaemonStatus.jsx');
jest.mock('../../eventSourceManager.jsx', () => ({
    closeEventSource: jest.fn(),
    startEventReception: jest.fn(),
}));

// Mock Material-UI components to add data-testid
jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    Accordion: ({children, expanded, onChange, ...props}) => (
        <div data-testid="accordion" className={expanded ? 'expanded' : ''} {...props}>
            {children}
            {onChange && (
                <button
                    onClick={() => onChange({}, !expanded)}
                    data-testid={`accordion-toggle-${props['aria-controls'] || 'unknown'}`}
                >
                    Toggle
                </button>
            )}
        </div>
    ),
    AccordionSummary: ({children, id, ...props}) => (
        <div data-testid={`accordion-summary-${id}`} {...props}>
            {children}
        </div>
    ),
    AccordionDetails: ({children, ...props}) => (
        <div data-testid="accordion-details" {...props}>
            {children}
        </div>
    ),
    Menu: ({children, open, ...props}) => (
        open ? <div data-testid="menu" {...props}>{children}</div> : null
    ),
    MenuItem: ({children, onClick, 'data-testid': testId, ...props}) => (
        <div data-testid={testId || 'menu-item'} onClick={onClick} {...props}>
            {children}
        </div>
    ),
    Dialog: ({children, open, ...props}) => (
        open ? <div role="dialog" data-testid="dialog" {...props}>{children}</div> : null
    ),
    DialogTitle: ({children, ...props}) => (
        <div data-testid="dialog-title" {...props}>{children}</div>
    ),
    DialogContent: ({children, ...props}) => (
        <div data-testid="dialog-content" {...props}>
            {children}
        </div>
    ),
    DialogActions: ({children, ...props}) => (
        <div data-testid="dialog-actions" {...props}>
            {children}
        </div>
    ),
    Snackbar: ({children, open, ...props}) => (
        open ? <div data-testid="snackbar" {...props}>{children}</div> : null
    ),
    Alert: ({children, ...props}) => (
        <div role="alert" data-testid="alert" {...props}>
            {children}
        </div>
    ),
    Checkbox: ({checked, onChange, ...props}) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            data-testid={props['data-testid'] || 'checkbox'}
            {...props}
        />
    ),
    IconButton: ({children, onClick, ...props}) => (
        <button
            data-testid={props['data-testid'] || 'icon-button'}
            onClick={onClick}
            {...props}
        >
            {children}
        </button>
    ),
    ListItemIcon: ({children, ...props}) => (
        <span data-testid="list-item-icon" {...props}>{children}</span>
    ),
}));

describe('ObjectDetail Component', () => {
    const mockFetchNodes = jest.fn(() => {});
    const mockStartEventReception = jest.fn(() => {});
    const mockCloseEventSource = jest.fn(() => {});

    beforeEach(() => {
        jest.setTimeout(20000);
        jest.clearAllMocks();

        // Mock localStorage
        Storage.prototype.getItem = jest.fn((key) => 'mock-token');
        Storage.prototype.setItem = jest.fn();
        Storage.prototype.removeItem = jest.fn();

        // Mock useParams
        require('react-router-dom').useParams.mockReturnValue({
            objectName: encodeURIComponent('root/svc/service1'),
        });

        // Mock useFetchDaemonStatus
        useFetchDaemonStatus.mockReturnValue({
            fetchNodes: mockFetchNodes,
            startEventReception: mockStartEventReception,
        });

        // Mock useEventStore
        const mockState = {
            objectStatus: {
                'root/svc/service1': {
                    avail: 'up',
                    frozen: 'frozen',
                },
            },
            objectInstanceStatus: {
                'root/svc/service1': {
                    node1: {
                        avail: 'up',
                        frozen_at: '2023-01-01T12:00:00Z',
                        resources: {
                            res1: {
                                status: 'up',
                                label: 'Resource 1',
                                type: 'disk',
                                provisioned: {state: true, mtime: '2023-01-01T12:00:00Z'},
                            },
                            res2: {
                                status: 'down',
                                label: 'Resource 2',
                                type: 'network',
                                provisioned: {state: false, mtime: '2023-01-01T12:00:00Z'},
                            },
                        },
                    },
                    node2: {
                        avail: 'down',
                        frozen_at: null,
                        resources: {
                            res3: {
                                status: 'warn',
                                label: 'Resource 3',
                                type: 'compute',
                                provisioned: {state: true, mtime: '2023-01-01T12:00:00Z'},
                            },
                        },
                    },
                },
            },
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        // Mock fetch
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            })
        );

        // Link mockCloseEventSource
        require('../../eventSourceManager.jsx').closeEventSource.mockImplementation(mockCloseEventSource);
    });

    afterEach(() => {
        cleanup(); // Explicitly clean up the DOM
        jest.clearAllMocks();
    });

    test('renders object name and no information message when no data', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({objectStatus: {}, objectInstanceStatus: {}})
        );
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('root/svc/service1')).toBeInTheDocument();
            expect(
                screen.getByText(/No information available for object/i)
            ).toBeInTheDocument();
        }, {timeout: 5000, interval: 100});
        unmount();
    });

    test('renders global status, nodes, and resources', async () => {
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
            expect(screen.getByText('Node: node2')).toBeInTheDocument();
            expect(screen.getByText('Resources (2)')).toBeInTheDocument();
            expect(screen.getByText('Resources (1)')).toBeInTheDocument();
        }, {timeout: 5000, interval: 100});
        const nodeAccordion = screen.getAllByTestId('accordion')[0];
        await act(async () => {
            fireEvent.click(within(nodeAccordion).getByTestId('accordion-summary-panel-resources-node1-header'));
        });
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
            expect(screen.getByText('res2')).toBeInTheDocument();
        }, {timeout: 5000, interval: 100});
        const node2Accordion = screen.getAllByTestId('accordion')[1];
        await waitFor(() => {
            const node2Summary = screen.getByTestId('accordion-summary-panel-resources-node2-header');
            act(() => {
                fireEvent.click(node2Summary);
            });
        }, {timeout: 5000, interval: 100});
        await waitFor(() => {
            expect(screen.getByText('res3')).toBeInTheDocument();
        }, {timeout: 5000, interval: 100});
    });

    test('calls fetchNodes and startEventReception on mount', () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        expect(mockFetchNodes).toHaveBeenCalledWith('mock-token');
        expect(mockStartEventReception).toHaveBeenCalledWith('mock-token');
    });

    test('calls closeEventSource on unmount', async () => {
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await act(async () => {
            unmount();
        });
        await waitFor(() => {
            expect(mockCloseEventSource).toHaveBeenCalled();
        }, {timeout: 5000, interval: 100});
    });

    test('does not call fetchNodes or startEventReception without auth token', () => {
        Storage.prototype.getItem = jest.fn(() => null);
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        expect(mockFetchNodes).not.toHaveBeenCalled();
        expect(mockStartEventReception).not.toHaveBeenCalled();
    });

    test('enables batch node actions button when nodes are selected', async () => {
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            const checkbox = screen.getByTestId('checkbox-node1');
            act(() => {
                fireEvent.click(checkbox);
            });
            const actionsButton = screen.getByText('Actions on selected nodes');
            expect(actionsButton).not.toBeDisabled();
        }, {timeout: 5000, interval: 100});
        unmount();
    });

    test('opens batch node actions menu and triggers freeze action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for node to appear
        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Select node
        const checkbox = screen.getByTestId('checkbox-node1');
        fireEvent.click(checkbox);

        // Open actions menu
        const actionsButton = screen.getByText('Actions on selected nodes');
        fireEvent.click(actionsButton);

        // Verify menu is open and contains freeze option
        await waitFor(() => {
            expect(screen.getByTestId('menu')).toBeInTheDocument();
            expect(screen.getByText('Freeze')).toBeInTheDocument();
        });

        // Click freeze option
        fireEvent.click(screen.getByText('Freeze'));

        // Verify confirm dialog appears
        await waitFor(() => {
            expect(screen.getByTestId('dialog')).toBeInTheDocument();
            expect(screen.getByText('Confirm Freeze')).toBeInTheDocument();
        });

        // Check the confirmation checkbox
        const dialogCheckbox = screen.getByTestId('checkbox');
        fireEvent.click(dialogCheckbox);

        // Click confirm button
        const confirmButton = screen.getByText('Confirm');
        fireEvent.click(confirmButton);

        // Verify API call was made
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node1/instance/path/root/svc/service1/action/freeze'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer mock-token'
                    }
                })
            );
        });

        // Verify snackbar appears
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/'freeze' succeeded on node 'node1'/i)).toBeInTheDocument();
        });
    }, 10000);

    test('triggers individual node stop action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for the component to be ready
        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Debug: display the DOM if needed
        // screen.debug();

        // 1. Open the node menu
        const nodeMenuButton = await screen.findByTestId('icon-button-node1');
        fireEvent.click(nodeMenuButton);

        // 2. Verify that the menu is open
        await waitFor(() => {
            expect(screen.getByTestId('node-menu-item-stop')).toBeInTheDocument();
        });

        // 3. Click 'stop'
        fireEvent.click(screen.getByTestId('node-menu-item-stop'));

        // 4. Verify the dialog
        await waitFor(() => {
            expect(screen.getByTestId('dialog-title')).toHaveTextContent('Confirm Stop');
        });

        // 5. Fill and submit the form
        fireEvent.click(screen.getByTestId('checkbox'));
        fireEvent.click(screen.getByRole('button', {name: /stop/i}));

        // 6. Verify the API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/stop'),
                expect.any(Object)
            );
        });
    }, 10000); // Extended timeout to 10 seconds

    test('enables batch resource actions when resources are selected', async () => {
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            const nodeAccordion = screen.getAllByTestId('accordion')[0];
            act(() => {
                fireEvent.click(within(nodeAccordion).getByTestId('accordion-summary-panel-resources-node1-header'));
            });
            const resCheckbox = screen.getByTestId('checkbox-res1');
            act(() => {
                fireEvent.click(resCheckbox);
            });
            const resMenuButton = within(nodeAccordion).getByTestId('icon-button-resources-node1');
            expect(resMenuButton).not.toBeDisabled();
        }, {timeout: 5000, interval: 100});
        unmount();
    });

    test('triggers batch resource action', async () => {
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Open resources accordion
        const resourcesHeader = screen.getByTestId('accordion-summary-panel-resources-node1-header');
        fireEvent.click(resourcesHeader);

        // Select a resource
        const resourceCheckbox = await screen.findByTestId('checkbox-res1');
        fireEvent.click(resourceCheckbox);

        // Open actions menu
        const actionsButton = screen.getByTestId('icon-button-resources-node1');
        fireEvent.click(actionsButton);

        // Select 'start' action
        const startAction = screen.getByTestId('menu-item-start');
        fireEvent.click(startAction);

        // Confirm action
        const confirmButton = await screen.findByText('Confirm');
        fireEvent.click(confirmButton);

        // Verify action was triggered with correct URL
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/svc/service1/action/start'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer mock-token'
                    }
                })
            );
        });
        unmount();
    });

    test('triggers individual resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for initial load
        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // 1. Open the resources accordion
        const resourcesHeader = await screen.findByTestId('accordion-summary-panel-resources-node1-header');
        fireEvent.click(resourcesHeader);

        // 2. Wait for the resource to be visible
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        // 3. Open the resource menu
        const resourceMenuButton = await screen.findByTestId('icon-button-res1');
        fireEvent.click(resourceMenuButton);

        // 4. Verify that the menu is open
        await waitFor(() => {
            expect(screen.getByTestId('resource-actions-menu')).toBeInTheDocument();
        });

        // 5. Find and click the restart action
        const restartAction = await screen.findByTestId('resource-action-restart');
        fireEvent.click(restartAction);

        // 6. Verify that the dialog is open
        await waitFor(() => {
            expect(screen.getByTestId('dialog')).toBeInTheDocument();
        });

        // 7. Confirm the action
        const confirmButton = await screen.findByRole('button', {name: /confirm/i});
        fireEvent.click(confirmButton);

        // 8. Verify the API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('action/restart?rid=res1'),
                expect.any(Object)
            );
        });
    }, 15000); // Extended timeout to 15 seconds

    test('triggers object action with unprovision dialog', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Open object menu
        fireEvent.click(screen.getByTestId('icon-button-object'));

        // Select unprovision
        fireEvent.click(screen.getByTestId('menu-item-unprovision'));

        // Fill the dialog
        await waitFor(() => {
            expect(screen.getByText('Confirm Unprovision')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('checkbox'));
        fireEvent.click(screen.getByText('Confirm'));

        // Verify the API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/unprovision'),
                expect.any(Object)
            );
        });
    });

    test('expands node and resource accordions', async () => {
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for node to be displayed
        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Find and click on node resources header
        const resourcesHeader = await screen.findByText('Resources (2)');
        fireEvent.click(resourcesHeader);

        // Verify resources are visible
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        // Find and click on resource res1
        const resourceHeader = await screen.findByText('res1');
        fireEvent.click(resourceHeader);

        // Verify resource details are visible
        await waitFor(() => {
            expect(screen.getByText((content, element) => {
                const hasText = (node) => node.textContent.includes('Label:') && node.textContent.includes('Resource 1');
                const elementHasText = hasText(element);
                const childrenDontHaveText = Array.from(element?.children || []).every(
                    (child) => !hasText(child)
                );
                return elementHasText && childrenDontHaveText;
            })).toBeInTheDocument();
        });
        unmount();
    });

    test('cancels freeze dialog', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for the component to load
        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // 1. Select the node
        const nodeCheckbox = screen.getByTestId('checkbox-node1');
        fireEvent.click(nodeCheckbox);

        // 2. Open the actions menu
        const actionsButton = screen.getByText('Actions on selected nodes');
        fireEvent.click(actionsButton);

        // 3. Select the 'freeze' action
        await waitFor(() => {
            expect(screen.getByText('Freeze')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Freeze'));

        // 4. Verify that the confirmation dialog appears
        await waitFor(() => {
            expect(screen.getByTestId('dialog')).toBeInTheDocument();
            expect(screen.getByText('Confirm Freeze')).toBeInTheDocument();
        });

        // 5. Click Cancel
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        // 6. Verify that the dialog is closed
        await waitFor(() => {
            expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
        });
    }, 10000);

    test('shows error snackbar when action fails', async () => {
        // 1. Mock fetch to return an error
        global.fetch.mockImplementationOnce(() =>
            Promise.reject(new Error('Network error')) // More robust than ok: false
        );

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail />} />
                </Routes>
            </MemoryRouter>
        );

        // 2. Wait for initial load
        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // 3. Select a node
        const checkbox = screen.getByTestId('checkbox-node1');
        fireEvent.click(checkbox);

        // 4. Open the actions menu
        const actionsButton = screen.getByText('Actions on selected nodes');
        fireEvent.click(actionsButton);

        // 5. Select the 'start' action
        await waitFor(() => {
            expect(screen.getByText('Start')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Start'));

        // 6. Confirm the action
        await waitFor(() => {
            expect(screen.getByTestId('dialog')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Confirm'));

        // 7. Verify the error display
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/Error: Network error/i)).toBeInTheDocument();
        }, { timeout: 3000 }); // Explicit timeout

    }, 10000); // Global timeout
});