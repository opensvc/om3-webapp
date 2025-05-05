import React from 'react';
import {render, screen, fireEvent, waitFor, within, act} from '@testing-library/react';
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
    MenuItem: ({children, onClick, ...props}) => (
        <div data-testid="menu-item" onClick={onClick} {...props}>
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
}));

describe('ObjectDetail Component', () => {
    const mockFetchNodes = jest.fn(() => {
    });
    const mockStartEventReception = jest.fn(() => {
    });
    const mockCloseEventSource = jest.fn(() => {
    });

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
        jest.clearAllMocks();
    });

    test('renders object name and no information message when no data', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({objectStatus: {}, objectInstanceStatus: {}})
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
            expect(
                screen.getByText(/No information available for object/i)
            ).toBeInTheDocument();
        }, {timeout: 5000, interval: 100});
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
            expect(screen.getByText('Global Status')).toBeInTheDocument();
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
        render(
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
            const checkbox = screen.getByTestId('checkbox-node1');
            act(() => {
                fireEvent.click(checkbox);
            });
            const actionsButton = screen.getByText('Actions on selected nodes');
            act(() => {
                fireEvent.click(actionsButton);
            });
            const menu = screen.getByTestId('menu');
            expect(within(menu).getByText('freeze')).toBeInTheDocument();
            act(() => {
                fireEvent.click(within(menu).getByText('freeze'));
            });
        }, {timeout: 5000, interval: 100});
        await waitFor(() => {
            expect(screen.getByTestId('dialog-title')).toHaveTextContent('Confirm Freeze');
            expect(
                screen.getByText(/I understand that the selected service orchestration will be paused/)
            ).toBeInTheDocument();
            const dialogCheckbox = screen.getByTestId('checkbox');
            act(() => {
                fireEvent.click(dialogCheckbox);
            });
            act(() => {
                fireEvent.click(screen.getByText('Confirm'));
            });
        }, {timeout: 5000, interval: 100});
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node1/instance/path/root/svc/service1/action/freeze'),
                expect.any(Object)
            );
            const alert = screen.getByRole('alert');
            expect(alert.textContent).toMatch(/'freeze' succeeded on node 'node1'/i);
        }, {timeout: 5000, interval: 100});
    });

    test('triggers individual node stop action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            const nodeMenuButton = screen.getByTestId('icon-button-node1');
            act(() => {
                fireEvent.click(nodeMenuButton);
            });
            expect(screen.getByText('stop')).toBeInTheDocument();
            act(() => {
                fireEvent.click(screen.getByText('stop'));
            });
        }, {timeout: 5000, interval: 100});
        await waitFor(() => {
            expect(screen.getByTestId('dialog-title')).toHaveTextContent('Confirm Stop');
            const dialogCheckbox = screen.getByTestId('checkbox');
            act(() => {
                fireEvent.click(dialogCheckbox);
            });
            act(() => {
                fireEvent.click(screen.getByText('Stop'));
            });
        }, {timeout: 5000, interval: 100});
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node1/instance/path/root/svc/service1/action/stop'),
                expect.any(Object)
            );
            const alert = screen.getByRole('alert');
            expect(alert.textContent).toMatch(/'stop' succeeded on node 'node1'/i);
        }, {timeout: 5000, interval: 100});
    });

    test('enables batch resource actions when resources are selected', async () => {
        render(
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
    });

    test('triggers batch resource action', async () => {
        render(
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
    });

    test('triggers individual resource action', async () => {
        render(
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

        // Open resource menu
        const resourceMenuButton = await screen.findByTestId('icon-button-res1');
        fireEvent.click(resourceMenuButton);

        // Select 'restart' action
        const restartAction = screen.getByText('restart');
        fireEvent.click(restartAction);

        // Confirm action
        const confirmButton = await screen.findByText('Confirm');
        fireEvent.click(confirmButton);

        // Verify action was triggered
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node1/instance/path/root/svc/service1/action/restart?rid=res1'),
                expect.any(Object)
            );
        });
    });

    test('triggers object action with unprovision dialog', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            const objectMenuButton = screen.getByTestId('icon-button-object');
            act(() => {
                fireEvent.click(objectMenuButton);
            });
            act(() => {
                fireEvent.click(screen.getByText('unprovision'));
            });
        }, {timeout: 5000, interval: 100});
        await waitFor(() => {
            expect(screen.getByTestId('dialog-title')).toHaveTextContent('Confirm Unprovision');
            expect(
                screen.getByText(/I understand that data will be lost/)
            ).toBeInTheDocument();
            const dialogCheckbox = screen.getByTestId('checkbox');
            act(() => {
                fireEvent.click(dialogCheckbox);
            });
            act(() => {
                fireEvent.click(screen.getByText('Confirm'));
            });
        }, {timeout: 5000, interval: 100});
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/object/path/root/svc/service1/action/unprovision'),
                expect.any(Object)
            );
            const alert = screen.getByRole('alert');
            expect(alert.textContent).toMatch(/'unprovision' succeeded on object/i);
        }, {timeout: 5000, interval: 100});
    });

    test('expands node and resource accordions', async () => {
        render(
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
            // Use more flexible matching function for fragmented text
            expect(screen.getByText((content, element) => {
                const hasText = (node) => node.textContent.includes('Label:') && node.textContent.includes('Resource 1');
                const elementHasText = hasText(element);
                const childrenDontHaveText = Array.from(element?.children || []).every(
                    (child) => !hasText(child)
                );
                return elementHasText && childrenDontHaveText;
            })).toBeInTheDocument();
        });
    });

    test('cancels freeze dialog', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            act(() => {
                fireEvent.click(screen.getByTestId('checkbox-node1'));
            });
            act(() => {
                fireEvent.click(screen.getByText('Actions on selected nodes'));
            });
            act(() => {
                fireEvent.click(screen.getByText('freeze'));
            });
            expect(screen.getByTestId('dialog-title')).toHaveTextContent('Confirm Freeze');
            act(() => {
                fireEvent.click(screen.getByText('Cancel'));
            });
        }, {timeout: 5000, interval: 100});
        await waitFor(() => {
            expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
        }, {timeout: 5000, interval: 100});
    });

    test('shows error snackbar when action fails', async () => {
        global.fetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({}),
            })
        );
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fservice1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            act(() => {
                fireEvent.click(screen.getByTestId('checkbox-node1'));
            });
            act(() => {
                fireEvent.click(screen.getByText('Actions on selected nodes'));
            });
            act(() => {
                fireEvent.click(screen.getByText('start'));
            });
            act(() => {
                fireEvent.click(screen.getByText('Confirm'));
            });
        }, {timeout: 5000, interval: 100});
        await waitFor(() => {
            const alert = screen.getByRole('alert');
            expect(alert.textContent).toMatch(/Error:/i);
        }, {timeout: 5000, interval: 100});
    });
});