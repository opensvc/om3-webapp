import React from 'react';
import {render, screen, fireEvent, waitFor, act, within} from '@testing-library/react';
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
}));

// Mock Material-UI components
jest.mock('@mui/material', () => {
    const actual = jest.requireActual('@mui/material');
    return {
        ...actual,
        Accordion: ({children, expanded, onChange, ...props}) => (
            <div className={expanded ? 'expanded' : ''} {...props}>
                {children}
            </div>
        ),
        AccordionSummary: ({children, id, onChange, ...props}) => (
            <div
                role="button"
                onClick={() => onChange?.({}, !props.expanded)}
                {...props}
            >
                {children}
            </div>
        ),
        AccordionDetails: ({children, ...props}) => (
            <div {...props}>{children}</div>
        ),
        Menu: ({children, open, anchorEl, onClose, ...props}) =>
            open ? <div role="menu" {...props}>{children}</div> : null,
        MenuItem: ({children, onClick, ...props}) => (
            <div role="menuitem" onClick={onClick} {...props}>
                {children}
            </div>
        ),
        ListItemIcon: ({children, ...props}) => <span {...props}>{children}</span>,
        ListItemText: ({children, ...props}) => <span {...props}>{children}</span>,
        Dialog: ({children, open, ...props}) =>
            open ? <div role="dialog" {...props}>{children}</div> : null,
        DialogTitle: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogContent: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogActions: ({children, ...props}) => <div {...props}>{children}</div>,
        Snackbar: ({children, open, ...props}) =>
            open ? <div role="alertdialog" {...props}>{children}</div> : null,
        Alert: ({children, ...props}) => (
            <div role="alert" {...props}>{children}</div>
        ),
        Checkbox: ({checked, onChange, ...props}) => (
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                {...props}
            />
        ),
        IconButton: ({children, onClick, ...props}) => (
            <button onClick={onClick} {...props}>
                {children}
            </button>
        ),
    };
});

describe('ObjectDetail Component', () => {
    const mockFetchNodes = jest.fn();
    const mockStartEventReception = jest.fn();
    const mockCloseEventSource = jest.fn();

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
            instanceMonitor: {
                'node1:root/svc/service1': {
                    state: 'running',
                    global_expect: 'placed@node1',
                },
                'node2:root/svc/service1': {
                    state: 'idle',
                    global_expect: 'none',
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
        jest.clearAllMocks();
    });

    test('renders object name and no information message when no data', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({objectStatus: {}, objectInstanceStatus: {}, instanceMonitor: {}})
        );
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('root/svc/service1')).toBeInTheDocument();
            expect(screen.getByText(/No information available for object/i)).toBeInTheDocument();
        });
    });

    test('renders global status, nodes, and resources', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('root/svc/service1')).toBeInTheDocument();
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
            expect(screen.getByText('Node: node2')).toBeInTheDocument();
            expect(screen.getByText('Resources (2)')).toBeInTheDocument();
            expect(screen.getByText('Resources (1)')).toBeInTheDocument();
            expect(screen.getByText('running')).toBeInTheDocument(); // node1 state
            expect(screen.getByText('placed@node1')).toBeInTheDocument(); // global_expect
        });

        const node1AccordionToggle = screen.getByText('Resources (2)').closest('div');
        await act(async () => {
            fireEvent.click(node1AccordionToggle);
        });
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
            expect(screen.getByText('res2')).toBeInTheDocument();
        });

        const node2AccordionToggle = screen.getByText('Resources (1)').closest('div');
        await act(async () => {
            fireEvent.click(node2AccordionToggle);
        });
        await waitFor(() => {
            expect(screen.getByText('res3')).toBeInTheDocument();
        });
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
        expect(mockCloseEventSource).toHaveBeenCalled();
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
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            const nodeCheckbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(nodeCheckbox);
            const actionsButton = screen.getByRole('button', {name: /Actions on selected nodes/i});
            expect(actionsButton).not.toBeDisabled();
        });
    });

    test('opens batch node actions menu and triggers freeze action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Select node
        const nodeCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(nodeCheckbox);

        // Open actions menu
        const actionsButton = screen.getByRole('button', {name: /Actions on selected nodes/i});
        fireEvent.click(actionsButton);

        // Find and click freeze option
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const freezeItem = menuItems.find((item) => item.textContent.includes('Freeze'));
            expect(freezeItem).toBeInTheDocument();
            fireEvent.click(freezeItem);
        });

        // Verify confirm dialog appears
        await waitFor(() => {
            expect(screen.getByText('Confirm Freeze')).toBeInTheDocument();
        });

        // Check the confirmation checkbox
        const dialogCheckbox = screen.getAllByRole('checkbox').find((cb) =>
            cb.closest('[role="dialog"]')
        );
        fireEvent.click(dialogCheckbox);

        // Click confirm button
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node1/instance/path/root/svc/service1/action/freeze'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });

        // Verify snackbar
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/'freeze' succeeded on node 'node1'/i);
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

    await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Open node menu (IconButton with MoreVertIcon)
        const nodeSection = screen.getByText('Node: node1').closest('div').parentElement;
        const nodeMenuButton = within(nodeSection).getAllByRole('button').find((btn) =>
            btn.querySelector('svg[data-testid="MoreVertIcon"]')
        );
        await act(async () => {
            fireEvent.click(nodeMenuButton);
        });

        // Click 'stop' menu item
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const stopItem = menuItems.find((item) => item.textContent.toLowerCase() === 'stop');
            expect(stopItem).toBeInTheDocument();
            fireEvent.click(stopItem);
        });

        // Verify dialog
        await waitFor(() => {
            expect(screen.getByText('Confirm Stop')).toBeInTheDocument();
        });

        // Check checkbox and confirm
        const dialogCheckbox = screen.getAllByRole('checkbox').find((cb) =>
            cb.closest('[role="dialog"]')
        );
        await act(async () => {
            fireEvent.click(dialogCheckbox);
        });
        const confirmButton = screen.getByRole('button', {name: /Stop/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node1/instance/path/root/svc/service1/action/stop'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 10000);

    test('triggers batch resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Open resources accordion by clicking the summary
        const resourcesSection = screen.getByText('Resources (2)').closest('div');
        await act(async () => {
            fireEvent.click(resourcesSection);
        });

        // Select resource
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });
        const resourceSection = screen.getByText('res1').closest('div');
        const resourceCheckbox = within(resourceSection).getByRole('checkbox');
        await act(async () => {
            fireEvent.click(resourceCheckbox);
        });

        // Open resource actions menu
        const resourceMenuButton = within(resourcesSection).getAllByRole('button').find((btn) =>
            btn.querySelector('svg[data-testid="MoreVertIcon"]')
        );
        await act(async () => {
            fireEvent.click(resourceMenuButton);
        });

        // Select 'start' action
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const startItem = menuItems.find((item) => item.textContent === 'Start');
            expect(startItem).toBeInTheDocument();
            fireEvent.click(startItem);
        });

        // Confirm action
        await waitFor(() => {
            expect(screen.getByText('Confirm start')).toBeInTheDocument();
        });
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/svc/service1/action/start'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 10000);

    test('triggers individual resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Open resources accordion
        const resourcesSection = screen.getByText('Resources (2)').closest('div');
        await act(async () => {
            fireEvent.click(resourcesSection);
        });

        // Wait for resource
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        // Open resource menu
        const resourceSection = screen.getByText('res1').closest('div');
        const resourceMenuButton = within(resourceSection).getAllByRole('button').find((btn) =>
            btn.querySelector('svg[data-testid="MoreVertIcon"]')
        );
        await act(async () => {
            fireEvent.click(resourceMenuButton);
        });

        // Click 'restart'
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const restartItem = menuItems.find((item) => item.textContent.includes('restart'));
            expect(restartItem).toBeInTheDocument();
            fireEvent.click(restartItem);
        });

        // Confirm action
        await waitFor(() => {
            expect(screen.getByText('Confirm restart')).toBeInTheDocument();
        });
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node1/instance/path/root/svc/service1/action/restart?rid=res1'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 15000);

    test('triggers object action with unprovision dialog', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Open object menu
        const headerSection = screen.getByText('root/svc/service1').closest('div');
        const objectMenuButton = within(headerSection).getAllByRole('button').find((btn) =>
            btn.querySelector('svg[data-testid="MoreVertIcon"]')
        );
        await act(async () => {
            fireEvent.click(objectMenuButton);
        });

        // Select unprovision
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const unprovisionItem = menuItems.find((item) => item.textContent === 'unprovision');
            expect(unprovisionItem).toBeInTheDocument();
            fireEvent.click(unprovisionItem);
        });

        // Fill dialog
        await waitFor(() => {
            expect(screen.getByText('Confirm Unprovision')).toBeInTheDocument();
        });
        const dialogCheckbox = screen.getAllByRole('checkbox').find((cb) =>
            cb.closest('[role="dialog"]')
        );
        await act(async () => {
            fireEvent.click(dialogCheckbox);
        });
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/object/path/root/svc/service1/action/unprovision'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 10000);

    test('expands node and resource accordions', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Expand node resources
        const resourcesToggle = screen.getByText('Resources (2)');
        await act(async () => {
            fireEvent.click(resourcesToggle);
        });

        // Verify resources
        await waitFor(() => {
            const res1 = screen.queryByText('res1');
            if (!res1) {
                screen.debug();
            }
            expect(res1).toBeInTheDocument();
            expect(screen.getByText('res2')).toBeInTheDocument();
        });

        // Expand resource details
        const resourceSection = screen.getByText('res1').closest('div');
        await act(async () => {
            fireEvent.click(resourceSection);
        });

        // Verify resource details with flexible matcher
        await waitFor(() => {
            const resourceDetails = screen.getByText((content, element) =>
                content.includes('Resource 1')
            );
            expect(resourceDetails).toBeInTheDocument();
        });
    }, 10000);

    test('cancels freeze dialog', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Select node
        const nodeCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(nodeCheckbox);

        // Open actions menu
        const actionsButton = screen.getByRole('button', {name: /Actions on selected nodes/i});
        fireEvent.click(actionsButton);

        // Select freeze
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const freezeItem = menuItems.find((item) => item.textContent.includes('Freeze'));
            expect(freezeItem).toBeInTheDocument();
            fireEvent.click(freezeItem);
        });

        // Verify dialog
        await waitFor(() => {
            expect(screen.getByText('Confirm Freeze')).toBeInTheDocument();
        });

        // Cancel
        const cancelButton = screen.getByRole('button', {name: /Cancel/i});
        fireEvent.click(cancelButton);

        // Verify dialog closed
        await waitFor(() => {
            expect(screen.queryByText('Confirm Freeze')).not.toBeInTheDocument();
        });
    }, 10000);

    test('shows error snackbar when action fails', async () => {
        global.fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Select node
        const nodeCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(nodeCheckbox);

        // Open actions menu
        const actionsButton = screen.getByRole('button', {name: /Actions on selected nodes/i});
        fireEvent.click(actionsButton);

        // Select start
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const startItem = menuItems.find((item) => item.textContent.includes('Start'));
            expect(startItem).toBeInTheDocument();
            fireEvent.click(startItem);
        });

        // Confirm
        await waitFor(() => {
            expect(screen.getByText('Confirm start')).toBeInTheDocument();
        });
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify error snackbar
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/Error: Network error/i);
        });
    }, 10000);

    test('displays node state from instanceMonitor', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('running')).toBeInTheDocument(); // node1 state
            expect(screen.queryByText('idle')).not.toBeInTheDocument(); // node2 state is idle, not displayed
        });
    });

    test('displays global_expect from instanceMonitor', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('placed@node1')).toBeInTheDocument(); // global_expect
            expect(screen.queryByText('none')).not.toBeInTheDocument(); // node2 global_expect is none, not displayed
        });
    });
});