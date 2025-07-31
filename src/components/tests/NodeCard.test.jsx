import React from 'react';
import {render, screen, fireEvent, waitFor, act, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ObjectDetail from '../ObjectDetails';
import NodeCard from '../NodeCard';
import useEventStore from '../../hooks/useEventStore.js';
import {closeEventSource, startEventReception, configureEventSource} from '../../eventSourceManager.jsx';
import userEvent from '@testing-library/user-event';
import {grey} from '@mui/material/colors';
import {RESOURCE_ACTIONS} from '../../constants/actions';

// Helper to find node section
const findNodeSection = async (nodeName, timeout = 10000) => {
    try {
        const nodeElement = await screen.findByText(
            (content, element) => {
                const hasText = content === nodeName;
                const isTypography = element?.tagName.toLowerCase() === 'span' && element?.getAttribute('variant') === 'h6';
                return hasText && isTypography;
            },
            {},
            {timeout}
        );

        const nodeSection = nodeElement.closest('div[style*="border: 1px solid"]');
        if (!nodeSection) {
            throw new Error(`Node section container not found for ${nodeName}`);
        }
        return nodeSection;
    } catch (error) {
        console.error(`Error in findNodeSection for ${nodeName}:`, error);
        screen.debug();
        throw error;
    }
};

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
}));
jest.mock('../../hooks/useEventStore.js');
jest.mock('../../eventSourceManager.jsx', () => ({
    closeEventSource: jest.fn(),
    startEventReception: jest.fn(),
    configureEventSource: jest.fn(),
}));

// Mock Material-UI components
jest.mock('@mui/material', () => {
    const actual = jest.requireActual('@mui/material');
    return {
        ...actual,
        Accordion: ({children, expanded, onChange, ...props}) => (
            <div data-testid="accordion" className={expanded ? 'expanded' : ''} {...props}>
                {children}
            </div>
        ),
        AccordionSummary: ({children, id, onChange, expanded, ...props}) => (
            <div
                role="button"
                data-testid="accordion-summary"
                aria-expanded={expanded ? 'true' : 'false'}
                onClick={() => onChange?.({}, !expanded)}
                {...props}
            >
                {children}
            </div>
        ),
        AccordionDetails: ({children, ...props}) => (
            <div data-testid="accordion-details" {...props}>
                {children}
            </div>
        ),
        Menu: ({children, open, anchorEl, onClose, ...props}) => (
            open ? <div role="menu" {...props}>{children}</div> : null
        ),
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
        Alert: ({children, severity, ...props}) => (
            <div role="alert" data-severity={severity} {...props}>
                {children}
            </div>
        ),
        Checkbox: ({checked, onChange, ...props}) => (
            <input type="checkbox" checked={checked} onChange={onChange} {...props} />
        ),
        IconButton: ({children, onClick, disabled, ...props}) => (
            <button onClick={onClick} disabled={disabled} {...props}>
                {children}
            </button>
        ),
        TextField: ({label, value, onChange, disabled, multiline, rows, ...props}) => (
            <input
                type={multiline ? 'text' : 'text'}
                placeholder={label}
                value={value}
                onChange={onChange}
                disabled={disabled}
                {...(multiline ? {'data-multiline': true, rows} : {})}
                {...props}
            />
        ),
        Input: ({type, onChange, disabled, ...props}) => (
            <input type={type} onChange={onChange} disabled={disabled} {...props} />
        ),
        CircularProgress: () => <div role="progressbar">Loading...</div>,
        Box: ({children, sx, ...props}) => (
            <div style={{...sx, minWidth: sx?.minWidth || 'auto'}} {...props}>
                {children}
            </div>
        ),
        Typography: ({children, ...props}) => <span {...props}>{children}</span>,
        FiberManualRecordIcon: ({sx, ...props}) => (
            <svg
                data-testid="FiberManualRecordIcon"
                style={{color: sx?.color, fontSize: sx?.fontSize}}
                {...props}
            />
        ),
        Tooltip: ({children, title, ...props}) => (
            <span {...props} title={title}>
                {children}
            </span>
        ),
        Button: ({children, onClick, disabled, variant, component, htmlFor, ...props}) => (
            <button
                onClick={onClick}
                disabled={disabled}
                data-variant={variant}
                {...(component === 'label' ? {htmlFor} : {})}
                {...props}
            >
                {children}
            </button>
        ),
    };
});

// Mock Material-UI icons
jest.mock('@mui/icons-material/ExpandMore', () => () => <span data-testid="ExpandMoreIcon"/>);
jest.mock('@mui/icons-material/UploadFile', () => () => <span data-testid="UploadFileIcon"/>);
jest.mock('@mui/icons-material/Edit', () => () => <span data-testid="EditIcon"/>);
jest.mock('@mui/icons-material/WarningAmber', () => () => <span data-testid="WarningAmberIcon"/>);
jest.mock('@mui/icons-material/AcUnit', () => () => <span data-testid="AcUnitIcon"/>);
jest.mock('@mui/icons-material/MoreVert', () => () => <span data-testid="MoreVertIcon"/>);

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn((key) => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {value: mockLocalStorage});

describe('NodeCard Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        jest.setTimeout(30000);
        jest.clearAllMocks();

        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        const mockState = {
            objectStatus: {
                'root/svc/svc1': {
                    avail: 'up',
                    frozen: 'frozen',
                },
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: '2023-01-01T12:00:00Z',
                        resources: {
                            res1: {
                                status: 'up',
                                label: 'Resource 1',
                                type: 'disk',
                                provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
                                running: true,
                            },
                            res2: {
                                status: 'down',
                                label: 'Resource 2',
                                type: 'network',
                                provisioned: {state: 'false', mtime: '2023-01-01T12:00:00Z'},
                                running: false,
                            },
                            container1: {
                                status: 'up',
                                label: 'Container 1',
                                type: 'container',
                                running: true,
                            },
                        },
                        encap: {
                            container1: {
                                resources: {
                                    encap1: {
                                        status: 'up',
                                        label: 'Encap Resource 1',
                                        type: 'task',
                                        running: true,
                                    },
                                },
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
                                provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
                                running: false,
                            },
                        },
                    },
                },
            },
            instanceMonitor: {
                'node1:root/svc/svc1': {
                    state: 'running',
                    global_expect: 'placed@node1',
                    resources: {
                        res1: {restart: {remaining: 0}},
                        res2: {restart: {remaining: 5}},
                        encap1: {restart: {remaining: 0}},
                    },
                },
            },
            instanceConfig: {
                'root/svc/svc1': {
                    resources: {
                        res1: {
                            is_monitored: true,
                            is_disabled: false,
                            is_standby: false,
                            restart: 0,
                        },
                    },
                },
            },
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        global.fetch = jest.fn((url) => {
            if (url.includes('/action/')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                    text: () => Promise.resolve(''),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
                text: () => Promise.resolve(''),
            });
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        window.innerWidth = 1024;
        window.dispatchEvent(new Event('resize'));
    });

    test('enables batch node actions button when nodes are selected', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
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
    }, 15000);

    test('opens batch node actions menu and triggers freeze action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 10000);
        const nodeCheckbox = await within(nodeSection).findByRole('checkbox', {name: /select node node1/i});
        await user.click(nodeCheckbox);

        const actionsButton = await screen.findByRole('button', {name: /actions on selected nodes/i});
        await user.click(actionsButton);

        const freezeItem = await screen.findByRole('menuitem', {name: /^Freeze$/i});
        await user.click(freezeItem);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Confirm Freeze/i);
        }, {timeout: 10000});

        const dialogCheckbox = await within(screen.getByRole('dialog')).findByRole('checkbox');
        await user.click(dialogCheckbox);

        const confirmButton = await within(screen.getByRole('dialog')).findByRole('button', {name: /Confirm/i});
        await user.click(confirmButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/freeze'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        }, {timeout: 10000});
    }, 30000);

    test('triggers individual node stop action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const actionsButton = await screen.findByRole('button', {name: /node1 actions/i});
        await user.click(actionsButton);

        const stopActions = await screen.findAllByRole('menuitem', {name: /^Stop$/i});
        await user.click(stopActions[0]);

        const dialog = await screen.findByRole('dialog');
        await waitFor(() => {
            expect(dialog).toHaveTextContent(/Confirm.*Stop/i);
        });

        const checkbox = screen.queryByRole('checkbox', {name: /confirm/i});
        if (checkbox) {
            await user.click(checkbox);
            await waitFor(() => expect(checkbox).toBeChecked());
        }

        const confirmButton = await screen.findByRole('button', {name: /Confirm/i});
        await waitFor(() => {
            expect(confirmButton).not.toHaveAttribute('disabled');
        }, {timeout: 5000});

        await user.click(confirmButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/action/stop'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 15000);

    test('triggers batch resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 15000);
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await act(async () => {
            await user.click(resourcesHeader);
        });

        const resourceCheckbox = await within(nodeSection).findByRole('checkbox', {name: /select resource res1/i});
        await act(async () => {
            await user.click(resourceCheckbox);
        });

        const actionsButton = await within(nodeSection).findByRole('button', {name: /resource actions for node node1/i});
        await act(async () => {
            await user.click(actionsButton);
        });

        const startItem = await screen.findByRole('menuitem', {name: /^Start$/i});
        await act(async () => {
            await user.click(startItem);
        });

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Confirm.*Start/i);
        }, {timeout: 15000});

        const confirmButton = await within(screen.getByRole('dialog')).findByRole('button', {name: /Confirm/i});
        await act(async () => {
            await user.click(confirmButton);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/action/start'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        }, {timeout: 15000});
    }, 45000);

    test('triggers individual resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 15000);
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await act(async () => {
            await user.click(resourcesHeader);
        });

        const res1Row = await within(nodeSection).findByText('res1');
        const resourceMenuButton = await within(res1Row.closest('div')).findByRole('button', {
            name: /Resource res1 actions/i,
        });
        await act(async () => {
            fireEvent.click(resourceMenuButton);
        });

        const restartItem = await screen.findByRole('menuitem', {name: /Restart/i});
        await act(async () => {
            fireEvent.click(restartItem);
        });

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Confirm Restart/i);
        });

        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/restart?rid=res1'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 15000);

    test('expands node and resource accordion', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 10000);
        const resourcesHeader = await within(nodeSection).findByText(/Resources.*\(/i, {}, {timeout: 5000});
        const resourcesExpandButton = await within(resourcesHeader.closest('div')).findByTestId('ExpandMoreIcon');
        await user.click(resourcesExpandButton);

        const accordion = resourcesHeader.closest('[data-testid="accordion"]');
        await waitFor(() => {
            expect(accordion).toHaveClass('expanded');
        }, {timeout: 5000});

        const res1Element = await within(nodeSection).findByText('res1', {}, {timeout: 5000});
        expect(res1Element).toBeInTheDocument();
        const res2Element = await within(nodeSection).findByText('res2', {}, {timeout: 5000});
        expect(res2Element).toBeInTheDocument();
    }, 30000);

    test('cancels freeze dialog', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 10000);
        const nodeCheckbox = await within(nodeSection).findByRole('checkbox', {name: /select node node1/i});
        await act(async () => {
            await user.click(nodeCheckbox);
        });

        const actionsButton = await screen.findByRole('button', {name: /actions on selected nodes/i});
        await act(async () => {
            await user.click(actionsButton);
        });

        const menu = await screen.findByRole('menu');
        const freezeItem = await within(menu).findByRole('menuitem', {name: 'Freeze'});
        await act(async () => {
            await user.click(freezeItem);
        });

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Confirm Freeze/i);
        }, {timeout: 5000});

        const cancelButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Cancel/i});
        await act(async () => {
            await user.click(cancelButton);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }, {timeout: 5000});

        expect(global.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining('/action/freeze'),
            expect.any(Object)
        );
    }, 20000);

    test('shows error snackbar when action fails', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/action/')) {
                return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            });
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 15000);
        const nodeCheckbox = await within(nodeSection).findByRole('checkbox', {name: /select node node1/i});
        await act(async () => {
            await user.click(nodeCheckbox);
        });

        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        await act(async () => {
            await user.click(actionsButton);
        });

        const menu = await screen.findByRole('menu');
        const startItem = await within(menu).findByRole('menuitem', {name: 'Start'});
        await act(async () => {
            await user.click(startItem);
        });

        await waitFor(
            () => {
                expect(screen.getByRole('dialog')).toHaveTextContent(/Confirm start/i);
            },
            {timeout: 10000}
        );

        const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Confirm/i});
        await act(async () => {
            await user.click(confirmButton);
        });

        await waitFor(
            () => {
                const alerts = screen.getAllByRole('alert');
                const errorAlert = alerts.find((alert) => /network error/i.test(alert.textContent));
                expect(errorAlert).toBeInTheDocument();
                expect(errorAlert).toHaveAttribute('data-severity', 'error');
            },
            {timeout: 10000}
        );
    }, 30000);

    test('displays node state from instanceMonitor', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('running')).toBeInTheDocument();
            expect(screen.queryByText('idle')).not.toBeInTheDocument();
        });
    });

    test('displays global_expect from instanceMonitor', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter
            >
        );
        await waitFor(() => {
            expect(screen.getByText('placed@node1')).toBeInTheDocument();
            expect(screen.queryByText('none')).not.toBeInTheDocument();
        });
    });

    test('getColor handles unknown status', async () => {
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {avail: 'unknown', resources: {}},
                },
            },
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        render(<ObjectDetail/>);
        await waitFor(() => {
            const statusIcon = screen.getByTestId('FiberManualRecordIcon');
            expect(statusIcon).toHaveStyle({color: grey[500]});
        });
    }, 10000);

    test('getNodeState handles idle state', async () => {
        render(<ObjectDetail/>);
        const nodeSection = await findNodeSection('node2', 10000);
        await waitFor(() => {
            expect(within(nodeSection).queryByText(/idle/i)).not.toBeInTheDocument();
        });
    });

    test('postResourceAction handles successful resource action', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({message: 'restart succeeded'}),
        });

        render(
            <MemoryRouter initialEntries={['/objects/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/objects/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 15000);
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);

        const res1Row = await within(nodeSection).findByText('res1');
        const resourceMenuButton = await within(res1Row.closest('div')).findByRole('button', {
            name: /Resource res1 actions/i,
        });
        await user.click(resourceMenuButton);

        const menu = await screen.findByRole('menu');
        const actionItem = await within(menu).findByRole('menuitem', {name: /Restart/i});
        await user.click(actionItem);

        const confirmButton = await screen.findByRole('button', {name: /Confirm/i});
        await user.click(confirmButton);

        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/action/restart?rid=res1'),
                    expect.any(Object)
                );
                const snackbar = screen.getByRole('alertdialog');
                expect(snackbar).toHaveTextContent("'restart' succeeded on resource 'res1'");
            },
            {timeout: 15000}
        );
    }, 30000);

    test('handles empty node data gracefully', async () => {
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: null,
                },
            },
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
            expect(screen.getByText('No resources available.')).toBeInTheDocument();
        });
    });

    test('displays warning icon when avail is "warn"', async () => {
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'warn',
                        frozen_at: null,
                        resources: {},
                    },
                },
            },
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            const warningIcon = screen.getByTestId('WarningAmberIcon');
            expect(warningIcon).toBeInTheDocument();
        });
    });

    test('handles container resources with encapsulated resources', async () => {
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {
                            container1: {
                                status: 'up',
                                label: 'Container 1',
                                type: 'container',
                                running: true,
                            },
                        },
                        encap: {
                            container1: {
                                resources: {
                                    encap1: {
                                        status: 'up',
                                        label: 'Encap Resource 1',
                                        type: 'task',
                                        running: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);

        await waitFor(() => {
            expect(screen.getByText('container1')).toBeInTheDocument();
            expect(screen.getByText('encap1')).toBeInTheDocument();
        });
    });

    test('handles select all resources for node with no resources', async () => {
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {},
                    },
                },
            },
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1');
        const selectAllCheckbox = await within(nodeSection).findByRole('checkbox', {
            name: /Select all resources for node node1/i,
        });

        expect(selectAllCheckbox).toBeDisabled();
    });

    test('handles resource status letters for various states', async () => {
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {
                            complexRes: {
                                status: 'up',
                                label: 'Complex Resource',
                                type: 'disk',
                                provisioned: {state: 'false'},
                                running: true,
                                optional: true,
                            },
                        },
                        encap: {
                            complexRes: {
                                resources: {
                                    encapRes: {
                                        status: 'up',
                                        label: 'Encap Resource',
                                        running: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            instanceMonitor: {
                'node1:root/svc/svc1': {
                    resources: {
                        complexRes: {restart: {remaining: 5}},
                    },
                },
            },
            instanceConfig: {
                'root/svc/svc1': {
                    resources: {
                        complexRes: {
                            is_monitored: true,
                            is_disabled: true,
                            is_standby: true,
                            restart: 0,
                        },
                    },
                },
            },
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 10000);
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);

        await waitFor(
            () => {
                const statusElements = screen.getAllByRole('status', {
                    name: 'Resource complexRes status: RMDO.PS5',
                });
                expect(statusElements.length).toBeGreaterThan(0);
                expect(statusElements.some((el) => el.textContent === 'RMDO.PS5')).toBe(true);
            },
            {timeout: 10000}
        );
    }, 30000);

    test('handles unprovision action with checkboxes', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 10000);
        const actionsButton = await within(nodeSection).findByRole('button', {name: /node1 actions/i});
        await user.click(actionsButton);

        const menu = await within(nodeSection).findByRole('menu');
        const unprovisionItem = await within(menu).findByRole('menuitem', {name: /Node node1 unprovision action/i});
        await user.click(unprovisionItem);

        await waitFor(
            () => {
                const dialog = screen.getByRole('dialog');
                expect(dialog).toHaveTextContent(/Confirm Unprovision/i);

                const dataLossCheckbox = within(dialog).getByRole('checkbox', {name: /data loss/i});
                expect(dataLossCheckbox).not.toBeChecked();

                const serviceCheckbox = within(dialog).getByRole('checkbox', {name: /service interruption/i});
                expect(serviceCheckbox).not.toBeChecked();
            },
            {timeout: 10000}
        );

        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        expect(confirmButton).toBeDisabled();

        const dataLossCheckbox = screen.getByRole('checkbox', {name: /data loss/i});
        await user.click(dataLossCheckbox);
        const serviceCheckbox = screen.getByRole('checkbox', {name: /service interruption/i});
        await user.click(serviceCheckbox);

        await waitFor(
            () => {
                expect(confirmButton).not.toBeDisabled();
            },
            {timeout: 10000}
        );

        await user.click(confirmButton);

        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/action/unprovision'),
                    expect.objectContaining({
                        method: 'POST',
                        headers: {Authorization: 'Bearer mock-token'},
                    })
                );
            },
            {timeout: 10000}
        );
    }, 30000);

    test('handles mobile view for resources', async () => {
        window.innerWidth = 500;
        window.dispatchEvent(new Event('resize'));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);

        await waitFor(() => {
            const res1Element = screen.getByText('res1');
            const parentDiv = res1Element.closest('div[style*="flex-direction: column"]');
            expect(parentDiv).toBeInTheDocument();
        });
    });

    test('handles missing node prop gracefully', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
        render(<NodeCard node={null}/>);
        expect(console.error).toHaveBeenCalledWith('Node name is required');
        expect(screen.queryByTestId('accordion')).not.toBeInTheDocument();
        console.error.mockRestore();
    });

    test('triggers useEffect on selectedResourcesByNode change', async () => {
        const setSelectedResourcesByNode = jest.fn();
        const mockState = {
            selectedResourcesByNode: {node1: ['res1']},
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        jest.spyOn(console, 'log').mockImplementation(() => {
        });

        const {rerender} = render(
            <NodeCard
                node="node1"
                nodeData={{resources: {res1: {status: 'up', label: 'Resource 1', type: 'disk'}}}}
                selectedResourcesByNode={mockState.selectedResourcesByNode}
                setSelectedResourcesByNode={setSelectedResourcesByNode}
                handleNodeResourcesAccordionChange={() => {
                }}
            />
        );

        mockState.selectedResourcesByNode = {node1: ['res1', 'res2']};
        rerender(
            <NodeCard
                node="node1"
                nodeData={{resources: {res1: {status: 'up', label: 'Resource 1', type: 'disk'}}}}
                selectedResourcesByNode={mockState.selectedResourcesByNode}
                setSelectedResourcesByNode={setSelectedResourcesByNode}
                handleNodeResourcesAccordionChange={() => {
                }}
            />
        );

        await waitFor(() => {
            expect(console.log).toHaveBeenCalledWith(
                'selectedResourcesByNode changed:',
                {node1: ['res1', 'res2']}
            );
        });
        console.log.mockRestore();
    });

    test('handles invalid setSelectedResourcesByNode in handleSelectAllResources', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {res1: {status: 'up', type: 'disk'}}}}
                setSelectedResourcesByNode={null}
                handleNodeResourcesAccordionChange={() => {
                }}
            />
        );

        const nodeSection = await findNodeSection('node1');
        const selectAllCheckbox = await within(nodeSection).findByRole('checkbox', {
            name: /Select all resources for node node1/i,
        });
        await user.click(selectAllCheckbox);

        expect(console.error).toHaveBeenCalledWith(
            'setSelectedResourcesByNode is not a function:',
            null
        );
        console.error.mockRestore();
    });

    test('selects all resources including encapsulated ones', async () => {
        const setSelectedResourcesByNode = jest.fn((fn) => fn({}));
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {container1: {status: 'up', type: 'container'}},
                    encap: {container1: {resources: {encap1: {status: 'up'}}}},
                }}
                setSelectedResourcesByNode={setSelectedResourcesByNode}
                handleNodeResourcesAccordionChange={() => {
                }}
            />
        );

        const nodeSection = await findNodeSection('node1');
        const selectAllCheckbox = await within(nodeSection).findByRole('checkbox', {
            name: /Select all resources for node node1/i,
        });
        await user.click(selectAllCheckbox);

        expect(setSelectedResourcesByNode).toHaveBeenCalledWith(expect.any(Function));
        expect(setSelectedResourcesByNode.mock.calls[0][0]({})).toEqual({
            node1: ['container1', 'encap1'],
        });
    });

    test('triggers console.warn for all default prop functions', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        let anchorEl = null;
        const setIndividualNodeMenuAnchor = jest.fn((el) => {
            anchorEl = el;
        });
        const {rerender} = render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {res1: {status: 'up', type: 'disk'}},
                }}
                setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                individualNodeMenuAnchor={anchorEl}
                handleNodeResourcesAccordionChange={() => {
                }}
            />
        );

        const nodeSection = await findNodeSection('node1');
        const nodeCheckbox = await within(nodeSection).findByRole('checkbox', {
            name: /select node node1/i,
        });
        await user.click(nodeCheckbox);

        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);
        const res1Row = await within(nodeSection).findByText('res1');
        const resourceCheckbox = await within(res1Row.closest('div')).findByRole('checkbox', {
            name: /select resource res1/i,
        });
        await user.click(resourceCheckbox);

        const resourceMenuButton = await within(res1Row.closest('div')).findByRole('button', {
            name: /Resource res1 actions/i,
        });
        await user.click(resourceMenuButton);

        const nodeActionsButton = await within(nodeSection).findByRole('button', {
            name: /node1 actions/i,
        });
        await user.click(nodeActionsButton);

        await act(async () => {
            setIndividualNodeMenuAnchor(nodeActionsButton);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={nodeActionsButton}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
        });

        const nodeMenu = await screen.findByRole('menu');
        let freezeItem = await within(nodeMenu).findByRole('menuitem', {
            name: /Node node1 freeze action/i,
        });
        await user.click(freezeItem);

        await act(async () => {
            setIndividualNodeMenuAnchor(null);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={null}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
            await user.click(nodeActionsButton);
            setIndividualNodeMenuAnchor(nodeActionsButton);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={nodeActionsButton}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
        });
        const stopItem = await within(nodeMenu).findByRole('menuitem', {
            name: /Node node1 stop action/i,
        });
        await user.click(stopItem);

        await act(async () => {
            setIndividualNodeMenuAnchor(null);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={null}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
            await user.click(nodeActionsButton);
            setIndividualNodeMenuAnchor(nodeActionsButton);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={nodeActionsButton}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
        });
        const unprovisionItem = await within(nodeMenu).findByRole('menuitem', {
            name: /Node node1 unprovision action/i,
        });
        await user.click(unprovisionItem);

        await act(async () => {
            setIndividualNodeMenuAnchor(null);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={null}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
            await user.click(nodeActionsButton);
            setIndividualNodeMenuAnchor(nodeActionsButton);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={nodeActionsButton}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
        });
        const startItem = await within(nodeMenu).findByRole('menuitem', {
            name: /Node node1 start action/i,
        });
        await user.click(startItem);

        const selectAllCheckbox = await within(nodeSection).findByRole('checkbox', {
            name: /Select all resources for node node1/i,
        });
        await user.click(selectAllCheckbox);

        await waitFor(() => {
            const warnCalls = warnSpy.mock.calls.map(([message]) => message);
            expect(warnCalls).toContain('toggleNode not provided');
            expect(warnCalls).toContain('toggleResource not provided');
            expect(warnCalls).toContain('handleResourceMenuOpen not provided');
            expect(warnCalls).toContain('setCurrentNode not provided');
            expect(warnCalls).toContain('setPendingAction not provided');
            expect(warnCalls).toContain('setConfirmDialogOpen not provided');
            expect(warnCalls).toContain('setCheckboxes not provided');
            expect(warnCalls).toContain('setStopDialogOpen not provided');
            expect(warnCalls).toContain('setStopCheckbox not provided');
            expect(warnCalls).toContain('setUnprovisionDialogOpen not provided');
            expect(warnCalls).toContain('setUnprovisionCheckboxes not provided');
            expect(warnCalls).toContain('setSimpleDialogOpen not provided');
            expect(warnCalls).toContain('setSelectedResourcesByNode not provided');
        }, {timeout: 15000});
        warnSpy.mockRestore();
    }, 30000);

    test('triggers console.warn for dialog-related default prop functions', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const setIndividualNodeMenuAnchor = jest.fn();
        let anchorEl = null;

        const {rerender} = render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {res1: {status: 'up', type: 'disk'}},
                }}
                setIndividualNodeMenuAnchor={(el) => {
                    anchorEl = el;
                    setIndividualNodeMenuAnchor(el);
                    rerender(
                        <NodeCard
                            node="node1"
                            nodeData={{
                                resources: {res1: {status: 'up', type: 'disk'}},
                            }}
                            setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                            individualNodeMenuAnchor={anchorEl}
                            handleNodeResourcesAccordionChange={() => {
                            }}
                        />
                    );
                }}
                individualNodeMenuAnchor={anchorEl}
                handleNodeResourcesAccordionChange={() => {
                }}
            />
        );

        const nodeSection = await findNodeSection('node1');
        const nodeActionsButton = await within(nodeSection).findByRole('button', {
            name: /node1 actions/i,
        });
        await user.click(nodeActionsButton);

        await act(async () => {
            setIndividualNodeMenuAnchor(nodeActionsButton);
        });

        const nodeMenu = await screen.findByRole('menu');
        const freezeItem = await within(nodeMenu).findByRole('menuitem', {
            name: /Node node1 freeze action/i,
        });
        await user.click(freezeItem);

        await act(async () => {
            setIndividualNodeMenuAnchor(null);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={null}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
            await user.click(nodeActionsButton);
            setIndividualNodeMenuAnchor(nodeActionsButton);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={nodeActionsButton}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
        });
        const stopItem = await within(nodeMenu).findByRole('menuitem', {
            name: /Node node1 stop action/i,
        });
        await user.click(stopItem);

        await act(async () => {
            setIndividualNodeMenuAnchor(null);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={null}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
            await user.click(nodeActionsButton);
            setIndividualNodeMenuAnchor(nodeActionsButton);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={nodeActionsButton}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
        });
        const unprovisionItem = await within(nodeMenu).findByRole('menuitem', {
            name: /Node node1 unprovision action/i,
        });
        await user.click(unprovisionItem);

        await act(async () => {
            setIndividualNodeMenuAnchor(null);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={null}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
            await user.click(nodeActionsButton);
            setIndividualNodeMenuAnchor(nodeActionsButton);
            rerender(
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {res1: {status: 'up', type: 'disk'}},
                    }}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                    individualNodeMenuAnchor={nodeActionsButton}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                />
            );
        });
        const startItem = await within(nodeMenu).findByRole('menuitem', {
            name: /Node node1 start action/i,
        });
        await user.click(startItem);

        await waitFor(() => {
            const warnCalls = warnSpy.mock.calls.map(([message]) => message);
            expect(warnCalls).toContain('setCurrentNode not provided');
            expect(warnCalls).toContain('setPendingAction not provided');
            expect(warnCalls).toContain('setConfirmDialogOpen not provided');
            expect(warnCalls).toContain('setCheckboxes not provided');
            expect(warnCalls).toContain('setStopDialogOpen not provided');
            expect(warnCalls).toContain('setStopCheckbox not provided');
            expect(warnCalls).toContain('setUnprovisionDialogOpen not provided');
            expect(warnCalls).toContain('setUnprovisionCheckboxes not provided');
            expect(warnCalls).toContain('setSimpleDialogOpen not provided');
        }, {timeout: 15000});
        warnSpy.mockRestore();
    }, 30000);

    test('triggers console.warn for setIndividualNodeMenuAnchor', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {res1: {status: 'up', type: 'disk'}},
                }}
                handleNodeResourcesAccordionChange={() => {
                }}
            />
        );

        const nodeSection = await findNodeSection('node1');
        const nodeActionsButton = await within(nodeSection).findByRole('button', {
            name: /node1 actions/i,
        });
        await user.click(nodeActionsButton);

        await waitFor(() => {
            expect(warnSpy).toHaveBeenCalledWith('setIndividualNodeMenuAnchor not provided');
        }, {timeout: 5000});
        warnSpy.mockRestore();
    }, 10000);

    test('getResourceType returns type for top-level resource', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {res1: {status: 'up', type: 'disk'}},
                }}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourceMenuOpen={(node, rid, e) => {
                }}
            />
        );

        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);

        const res1Row = await within(nodeSection).findByText('res1');
        const resourceMenuButton = await within(res1Row.closest('div')).findByRole('button', {
            name: /Resource res1 actions/i,
        });
        await user.click(resourceMenuButton);

        await waitFor(() => {
            expect(console.log).toHaveBeenCalledWith('getResourceType called for rid: res1');
            expect(console.log).toHaveBeenCalledWith('Found resource type in resources[res1]: disk');
        }, {timeout: 10000});

        console.log.mockRestore();
    }, 15000);

    test('getResourceType returns type for encapsulated resource', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {container1: {status: 'up', type: 'container'}},
                    encap: {container1: {resources: {encap1: {status: 'up', type: 'task'}}}},
                }}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourceMenuOpen={(node, rid, e) => {
                }}
            />
        );

        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);

        const encap1Row = await within(nodeSection).findByText('encap1');
        const resourceMenuButton = await within(encap1Row.closest('div')).findByRole('button', {
            name: /Resource encap1 actions/i,
        });
        await user.click(resourceMenuButton);

        await waitFor(() => {
            expect(console.log).toHaveBeenCalledWith('getResourceType called for rid: encap1');
            expect(console.log).toHaveBeenCalledWith(
                'Found resource type in encapData[container1].resources[encap1]: task'
            );
        }, {timeout: 10000});

        console.log.mockRestore();
    }, 15000);

    test('getResourceType handles missing rid gracefully', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {res1: {status: 'up', type: 'disk'}},
                }}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourceMenuOpen={(node, rid, e) => {
                }}
                getResourceType={() => {
                    console.warn('getResourceType called with undefined or null rid');
                    return '';
                }}
            />
        );

        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);

        const res1Row = await within(nodeSection).findByText('res1');
        const resourceMenuButton = await within(res1Row.closest('div')).findByRole('button', {
            name: /Resource res1 actions/i,
        });
        await user.click(resourceMenuButton);

        await waitFor(() => {
            expect(console.warn).not.toHaveBeenCalledWith('getResourceType called with undefined or null rid');
        }, {timeout: 10000});

        console.warn.mockRestore();
    }, 15000);
});
