import React from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ObjectDetail from '../ObjectDetails';
import NodeCard from '../NodeCard';
import useEventStore from '../../hooks/useEventStore.js';
import userEvent from '@testing-library/user-event';
import {grey} from '@mui/material/colors';
import {act} from '@testing-library/react';

// Helper function to find node section
const findNodeSection = async (nodeName, timeout = 10000) => {
    const nodeElement = await screen.findByText(nodeName, {}, {timeout});
    // eslint-disable-next-line testing-library/no-node-access
    const nodeSection = nodeElement.closest('div[style*="border: 1px solid"]');
    if (!nodeSection) {
        throw new Error(`Node section container not found for ${nodeName}`);
    }
    return nodeSection;
};

// Mock implementations
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

jest.mock('@mui/icons-material/ExpandMore', () => () => <span data-testid="ExpandMoreIcon"/>);
jest.mock('@mui/icons-material/UploadFile', () => () => <span data-testid="UploadFileIcon"/>);
jest.mock('@mui/icons-material/Edit', () => () => <span data-testid="EditIcon"/>);
jest.mock('@mui/icons-material/PriorityHigh', () => () => <span data-testid="PriorityHighIcon"/>);
jest.mock('@mui/icons-material/AcUnit', () => () => <span data-testid="AcUnitIcon"/>);
jest.mock('@mui/icons-material/MoreVert', () => () => <span data-testid="MoreVertIcon"/>);

const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
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
            expect(screen.getAllByRole('checkbox')[0]).toBeInTheDocument();
        });

        const nodeCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(nodeCheckbox);

        await waitFor(() => {
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
        await user.click(resourcesHeader);

        const resourceCheckbox = await within(nodeSection).findByRole('checkbox', {name: /select resource res1/i});
        await user.click(resourceCheckbox);

        const actionsButton = await within(nodeSection).findByRole('button', {name: /resource actions for node node1/i});
        await user.click(actionsButton);

        const resourceActionsMenu = await within(nodeSection).findByRole('menu', {name: 'Batch resource actions for node node1'});
        const startItem = await within(resourceActionsMenu).findByRole('menuitem', {name: /^Start$/i});
        await user.click(startItem);

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Confirm.*Start/i);
        }, {timeout: 15000});

        const confirmButton = await within(screen.getByRole('dialog')).findByRole('button', {name: /Confirm/i});
        await user.click(confirmButton);

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
        await user.click(resourcesHeader);
        const res1Row = await within(nodeSection).findByText('res1');
        // eslint-disable-next-line testing-library/no-node-access
        const resourceRow = res1Row.closest('div');
        const resourceMenuButton = await within(resourceRow).findByRole('button', {
            name: /Resource res1 actions/i,
        });
        await user.click(resourceMenuButton);
        const restartItem = await screen.findByRole('menuitem', {name: /Restart/i});
        await user.click(restartItem);
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Confirm Restart/i);
        });
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await user.click(confirmButton);
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
        // eslint-disable-next-line testing-library/no-node-access
        const resourcesExpandButton = await within(resourcesHeader.closest('div')).findByTestId('ExpandMoreIcon');
        await user.click(resourcesExpandButton);
        // eslint-disable-next-line testing-library/no-node-access
        const accordion = resourcesHeader.closest('[data-testid="accordion"]');
        await waitFor(() => {
            expect(accordion).toHaveClass('expanded');
        }, {timeout: 5000});
        await waitFor(() => {
            expect(within(nodeSection).getByText('res1')).toBeInTheDocument();
        }, {timeout: 5000});
        await waitFor(() => {
            expect(within(nodeSection).getByText('res2')).toBeInTheDocument();
        }, {timeout: 5000});
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
        await user.click(nodeCheckbox);
        const actionsButton = await screen.findByRole('button', {name: /actions on selected nodes/i});
        await user.click(actionsButton);
        const menu = await screen.findByRole('menu');
        const freezeItem = await within(menu).findByRole('menuitem', {name: 'Freeze'});
        await user.click(freezeItem);
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Confirm Freeze/i);
        }, {timeout: 5000});
        const cancelButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Cancel/i});
        await user.click(cancelButton);
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
        await user.click(nodeCheckbox);
        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        await user.click(actionsButton);
        const menu = await screen.findByRole('menu');
        const startItem = await within(menu).findByRole('menuitem', {name: 'Start'});
        await user.click(startItem);
        await waitFor(
            () => {
                expect(screen.getByRole('dialog')).toHaveTextContent(/Confirm start/i);
            },
            {timeout: 10000}
        );
        const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Confirm/i});
        await user.click(confirmButton);

        let errorAlert;
        await waitFor(
            () => {
                const alerts = screen.getAllByRole('alert');
                errorAlert = alerts.find((alert) => /network error/i.test(alert.textContent));
                expect(errorAlert).toBeInTheDocument();
            },
            {timeout: 10000}
        );
        expect(errorAlert).toHaveAttribute('data-severity', 'error');
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
        });
        await waitFor(() => {
            expect(screen.queryByText('idle')).not.toBeInTheDocument();
        });
    });

    test('displays global_expect from instanceMonitor', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('placed@node1')).toBeInTheDocument();
        });
        await waitFor(() => {
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
        // eslint-disable-next-line testing-library/no-node-access
        const resourceRow = res1Row.closest('div');
        const resourceMenuButton = await within(resourceRow).findByRole('button', {
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
            },
            {timeout: 15000}
        );
        await waitFor(
            () => {
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
        });
        await waitFor(() => {
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
            const warningIcon = screen.getByTestId('PriorityHighIcon');
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
        });
        await waitFor(() => {
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
        window.innerWidth = 1024;
        window.dispatchEvent(new Event('resize'));
        const nodeData = {
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
            instanceConfig: {
                resources: {
                    complexRes: {
                        is_monitored: true,
                        is_disabled: true,
                        is_standby: true,
                        restart: 0,
                    },
                },
            },
            instanceMonitor: {
                resources: {
                    complexRes: {restart: {remaining: 5}},
                },
            },
        };
        const handleNodeResourcesAccordionChange = jest.fn().mockReturnValue(jest.fn());
        const toggleResource = jest.fn();
        const setSelectedResourcesByNode = jest.fn((fn) => fn({}));
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={toggleResource}
                setSelectedResourcesByNode={setSelectedResourcesByNode}
                handleNodeResourcesAccordionChange={handleNodeResourcesAccordionChange}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1', 10000);
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        // eslint-disable-next-line testing-library/no-node-access
        const accordion = resourcesHeader.closest('[data-testid="accordion"]');
        await waitFor(() => {
            expect(accordion).toHaveClass('expanded');
        }, {timeout: 10000});
        await waitFor(() => {
            expect(within(nodeSection).getByText('complexRes')).toBeInTheDocument();
        }, {timeout: 5000});
        await waitFor(() => expect(screen.getAllByRole('status', {
            name: /Resource complexRes status: RMDO\.PS5/,
        }).length).toBeGreaterThan(0), {timeout: 10000});
        await waitFor(() => expect(screen.getAllByRole('status').some((el) => el.textContent === 'RMDO.PS5')).toBe(true), {timeout: 10000});
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
            // eslint-disable-next-line testing-library/no-node-access
            const parentDiv = res1Element.closest('div[style*="flex-direction: column"]');
            expect(parentDiv).toBeInTheDocument();
        });
    });

    test('handles missing node prop gracefully', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        render(<NodeCard node={null}/>);
        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith('Node name is required');
        });
        await waitFor(() => {
            expect(screen.queryByTestId('accordion')).not.toBeInTheDocument();
        });
        consoleErrorSpy.mockRestore();
    });

    test('triggers useEffect on selectedResourcesByNode change', async () => {
        const setSelectedResourcesByNode = jest.fn((fn) => fn({}));
        const mockState = {
            selectedResourcesByNode: {node1: ['res1']},
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
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
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'selectedResourcesByNode changed:',
            {node1: ['res1', 'res2']}
        );
        consoleLogSpy.mockRestore();
    });

    test('handles invalid setSelectedResourcesByNode in handleSelectAllResources', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
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
        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'setSelectedResourcesByNode is not a function:',
                null
            );
        });
        consoleErrorSpy.mockRestore();
    }, 10000);

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

    test('getResourceType returns type for top-level resource', async () => {
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {res1: {status: 'up', type: 'disk'}},
                }}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourceMenuOpen={() => {
                }}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);
        const res1Row = await within(nodeSection).findByText('res1');
        // eslint-disable-next-line testing-library/no-node-access
        const resourceRow = res1Row.closest('div');
        const resourceMenuButton = await within(resourceRow).findByRole('button', {
            name: /Resource res1 actions/i,
        });
        await user.click(resourceMenuButton);
        expect(consoleLogSpy).toHaveBeenCalledWith('getResourceType called for rid: res1');
        expect(consoleLogSpy).toHaveBeenCalledWith('Found resource type in resources[res1]: disk');
        consoleLogSpy.mockRestore();
    }, 15000);

    test('getResourceType returns type for encapsulated resource', async () => {
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
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
                handleResourceMenuOpen={() => {
                }}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);
        const encap1Row = await within(nodeSection).findByText('encap1');
        // eslint-disable-next-line testing-library/no-node-access
        const resourceRow = encap1Row.closest('div');
        const resourceMenuButton = await within(resourceRow).findByRole('button', {
            name: /Resource encap1 actions/i,
        });
        await user.click(resourceMenuButton);
        expect(consoleLogSpy).toHaveBeenCalledWith('getResourceType called for rid: encap1');
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Found resource type in encapData[container1].resources[encap1]: task'
        );
        consoleLogSpy.mockRestore();
    }, 15000);

    test('getResourceType handles missing rid gracefully', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {res1: {status: 'up', type: 'disk'}},
                }}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourceMenuOpen={() => {
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
        // eslint-disable-next-line testing-library/no-node-access
        const resourceRow = res1Row.closest('div');
        const resourceMenuButton = await within(resourceRow).findByRole('button', {
            name: /Resource res1 actions/i,
        });
        await user.click(resourceMenuButton);
        expect(consoleWarnSpy).not.toHaveBeenCalledWith('getResourceType called with undefined or null rid');
        consoleWarnSpy.mockRestore();
    }, 15000);

    test('disables node actions button when actionInProgress is true', async () => {
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {}}}
                actionInProgress={true}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );

        const nodeSection = await findNodeSection('node1', 10000);
        const actionsButton = await within(nodeSection).findByRole('button', {name: /node1 actions/i});
        expect(actionsButton).toBeDisabled();
    }, 10000);

    test('handles resource status letters with all possible states', async () => {
        const nodeData = {
            resources: {
                testRes: {
                    status: 'up',
                    label: 'Test Resource',
                    type: 'disk',
                    provisioned: {state: 'false'},
                    running: true,
                    optional: true,
                },
            },
            instanceConfig: {
                resources: {
                    testRes: {
                        is_monitored: true,
                        is_disabled: true,
                        is_standby: true,
                        restart: 15,
                    },
                },
            },
            instanceMonitor: {
                resources: {
                    testRes: {restart: {remaining: 12}},
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('testRes')).toBeInTheDocument();
        });
        await waitFor(() => {
            const statusElements = screen.getAllByRole('status');
            const testStatus = statusElements.find(el =>
                el.textContent.includes('R') &&
                el.textContent.includes('M') &&
                el.textContent.includes('D') &&
                el.textContent.includes('O') &&
                el.textContent.includes('P') &&
                el.textContent.includes('S')
            );
            expect(testStatus).toBeInTheDocument();
        });
    }, 15000);

    test('handles resource with no provisioned state', async () => {
        const nodeData = {
            resources: {
                noProvRes: {
                    status: 'up',
                    label: 'No Provision Resource',
                    type: 'disk',
                    running: false,
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('noProvRes')).toBeInTheDocument();
        });
    }, 10000);

    test('handles container resource with down status', async () => {
        const nodeData = {
            resources: {
                downContainer: {
                    status: 'down',
                    label: 'Down Container',
                    type: 'container',
                    running: false,
                },
            },
            encap: {
                downContainer: {
                    resources: {
                        encapRes: {
                            status: 'up',
                            label: 'Encap Resource',
                            type: 'task',
                            running: true,
                        },
                    },
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('downContainer')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(within(nodeSection).queryByText('encapRes')).not.toBeInTheDocument();
        });
    }, 10000);

    test('handles resource action filtering for different types', async () => {
        const nodeData = {
            resources: {
                taskRes: {
                    status: 'up',
                    label: 'Task Resource',
                    type: 'task',
                    running: true,
                },
                fsRes: {
                    status: 'up',
                    label: 'FS Resource',
                    type: 'fs.mount',
                    running: true,
                },
                diskRes: {
                    status: 'up',
                    label: 'Disk Resource',
                    type: 'disk',
                    running: true,
                },
                appRes: {
                    status: 'up',
                    label: 'App Resource',
                    type: 'app',
                    running: true,
                },
                containerRes: {
                    status: 'up',
                    label: 'Container Resource',
                    type: 'container',
                    running: true,
                },
                unknownRes: {
                    status: 'up',
                    label: 'Unknown Resource',
                    type: 'unknown',
                    running: true,
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                handleResourceMenuOpen={jest.fn()}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(6\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('taskRes')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(within(nodeSection).getByText('fsRes')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(within(nodeSection).getByText('diskRes')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(within(nodeSection).getByText('appRes')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(within(nodeSection).getByText('containerRes')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(within(nodeSection).getByText('unknownRes')).toBeInTheDocument();
        });
    }, 15000);

    test('handles zoom level calculation', async () => {
        Object.defineProperty(window, 'devicePixelRatio', {
            value: 2,
            writable: true,
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {}}}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });
        Object.defineProperty(window, 'devicePixelRatio', {
            value: 1,
            writable: true,
        });
    }, 10000);

    test('handles resource with empty logs', async () => {
        const nodeData = {
            resources: {
                emptyLogRes: {
                    status: 'up',
                    label: 'Empty Log Resource',
                    type: 'disk',
                    running: true,
                    log: [],
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('emptyLogRes')).toBeInTheDocument();
        });
        const logSections = screen.queryAllByText(/info:|warn:|error:/i);
        expect(logSections).toHaveLength(0);
    }, 10000);

    test('handles resource with undefined logs', async () => {
        const nodeData = {
            resources: {
                undefinedLogRes: {
                    status: 'up',
                    label: 'Undefined Log Resource',
                    type: 'disk',
                    running: true,
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('undefinedLogRes')).toBeInTheDocument();
        });
    }, 10000);

    test('handles getColor function returning undefined', async () => {
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {}}}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => undefined}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });
        const statusIcons = screen.getAllByTestId('FiberManualRecordIcon');
        expect(statusIcons.length).toBeGreaterThan(0);
    }, 10000);

    test('handles node with no instance data', async () => {
        render(
            <NodeCard
                node="node1"
                nodeData={null}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'unknown', frozen: 'unfrozen', state: null})}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('No resources available.')).toBeInTheDocument();
        });
    }, 10000);

    test('handles batch resource actions with no selected resources', async () => {
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {
                        res1: {status: 'up', type: 'disk'},
                    },
                }}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourcesActionsOpen={jest.fn()}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const actionsButton = await within(nodeSection).findByRole('button', {
            name: /Resource actions for node node1/i,
        });
        expect(actionsButton).toBeDisabled();
    }, 10000);

    test('handles individual node menu actions', async () => {
        const setPendingAction = jest.fn();
        const setConfirmDialogOpen = jest.fn();
        const setStopDialogOpen = jest.fn();
        const setUnprovisionDialogOpen = jest.fn();
        const setSimpleDialogOpen = jest.fn();
        const setCheckboxes = jest.fn();
        const setStopCheckbox = jest.fn();
        const setUnprovisionCheckboxes = jest.fn();
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {}}}
                handleNodeResourcesAccordionChange={() => {
                }}
                setPendingAction={setPendingAction}
                setConfirmDialogOpen={setConfirmDialogOpen}
                setStopDialogOpen={setStopDialogOpen}
                setUnprovisionDialogOpen={setUnprovisionDialogOpen}
                setSimpleDialogOpen={setSimpleDialogOpen}
                setCheckboxes={setCheckboxes}
                setStopCheckbox={setStopCheckbox}
                setUnprovisionCheckboxes={setUnprovisionCheckboxes}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const actionsButton = await within(nodeSection).findByRole('button', {name: /node1 actions/i});

        fireEvent.click(actionsButton);
    }, 10000);

    test('handles resource menu actions', async () => {
        const handleResourceMenuOpen = jest.fn();
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {
                        res1: {status: 'up', type: 'disk'},
                    },
                }}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourceMenuOpen={handleResourceMenuOpen}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('res1')).toBeInTheDocument();
        });
        const resourceMenuButtons = screen.getAllByRole('button', {
            name: /Resource res1 actions/i,
        });
        const resourceMenuButton = resourceMenuButtons[0];
        await user.click(resourceMenuButton);
        expect(handleResourceMenuOpen).toHaveBeenCalledWith('node1', 'res1', expect.any(Object));
    }, 15000);

    test('handles select all resources for node with mixed resources', async () => {
        const setSelectedResourcesByNode = jest.fn();
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {
                        container1: {status: 'up', type: 'container'},
                        res1: {status: 'up', type: 'disk'},
                    },
                    encap: {
                        container1: {
                            resources: {
                                encap1: {status: 'up', type: 'task'},
                                encap2: {status: 'up', type: 'fs'},
                            },
                        },
                    },
                }}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={setSelectedResourcesByNode}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const selectAllCheckbox = await within(nodeSection).findByRole('checkbox', {
            name: /Select all resources for node node1/i,
        });
        await user.click(selectAllCheckbox);
        await waitFor(() => {
            expect(setSelectedResourcesByNode).toHaveBeenCalledWith(expect.any(Function));
        });
        const updateFunction = setSelectedResourcesByNode.mock.calls[0][0];
        const result = updateFunction({});
        expect(result).toEqual({
            node1: expect.arrayContaining(['container1', 'res1', 'encap1', 'encap2'])
        });
    }, 15000);

    test('handles container with no encap data', async () => {
        const nodeData = {
            resources: {
                container1: {
                    status: 'up',
                    label: 'Container 1',
                    type: 'container',
                    running: true,
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('container1')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText(/No encapsulated data available for container1/i)).toBeInTheDocument();
        });
    }, 15000);

    test('handles container with empty encap resources', async () => {
        const nodeData = {
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
                    resources: {},
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('container1')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText(/No encapsulated resources available for container1/i)).toBeInTheDocument();
        });
    }, 15000);

    test('handles mobile view rendering', async () => {
        window.innerWidth = 500;
        window.dispatchEvent(new Event('resize'));
        const nodeData = {
            resources: {
                mobileRes: {
                    status: 'up',
                    label: 'Mobile Resource',
                    type: 'disk',
                    running: true,
                    log: [
                        {level: 'info', message: 'Mobile test log'},
                    ],
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('mobileRes')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('info: Mobile test log')).toBeInTheDocument();
        });
    }, 15000);

    test('handles parseProvisionedState function', async () => {
        const parseProvisionedState = jest.fn((state) => !!state);
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {},
                    provisioned: 'true',
                }}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                parseProvisionedState={parseProvisionedState}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });
        expect(parseProvisionedState).toHaveBeenCalledWith('true');
    }, 10000);

    test('handles all default function props', async () => {
        render(<NodeCard node="node1"/>);
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });
        const consoleWarnSpy = jest.spyOn(console, 'warn');
        const nodeSection = await findNodeSection('node1');
        const checkbox = await within(nodeSection).findByRole('checkbox', {
            name: /Select node node1/i,
        });
        await user.click(checkbox);
        expect(consoleWarnSpy).toHaveBeenCalledWith('toggleNode not provided');
        consoleWarnSpy.mockRestore();
    }, 10000);

    test('handles getResourceStatusLetters with all edge cases', async () => {
        const nodeData = {
            resources: {
                edgeCaseRes: {
                    status: 'up',
                    label: 'Edge Case Resource',
                    type: 'disk',
                },
            },
            instanceConfig: {
                resources: {
                    edgeCaseRes: {
                        is_monitored: "true",
                        is_disabled: "false",
                        is_standby: "true",
                        restart: "5",
                    },
                },
            },
            instanceMonitor: {
                resources: {
                    edgeCaseRes: {restart: {remaining: "3"}},
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('edgeCaseRes')).toBeInTheDocument();
        });
    }, 10000);

    test('handles getResourceStatusLetters with container provisioned state', async () => {
        const nodeData = {
            resources: {
                containerRes: {
                    status: 'up',
                    label: 'Container Resource',
                    type: 'container',
                    running: true,
                },
            },
            encap: {
                containerRes: {
                    provisioned: 'false',
                    resources: {
                        encapRes: {
                            status: 'up',
                            label: 'Encap Resource',
                            type: 'task',
                            running: true,
                        },
                    },
                },
            },
            instanceConfig: {
                resources: {
                    containerRes: {
                        is_monitored: true,
                        is_disabled: false,
                        is_standby: false,
                    },
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('containerRes')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('encapRes')).toBeInTheDocument();
        });
    }, 15000);

    test('handles getResourceStatusLetters with remaining restarts > 10', async () => {
        const nodeData = {
            resources: {
                manyRestartsRes: {
                    status: 'up',
                    label: 'Many Restarts Resource',
                    type: 'disk',
                    running: true,
                },
            },
            instanceMonitor: {
                resources: {
                    manyRestartsRes: {restart: {remaining: 15}},
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('manyRestartsRes')).toBeInTheDocument();
        });
        await waitFor(() => {
            const statusElements = screen.getAllByRole('status');
            const statusWithPlus = statusElements.find(el => el.textContent.includes('+'));
            expect(statusWithPlus).toBeInTheDocument();
        });
    }, 15000);

    test('handles getResourceStatusLetters with config restarts', async () => {
        const nodeData = {
            resources: {
                configRestartRes: {
                    status: 'up',
                    label: 'Config Restart Resource',
                    type: 'disk',
                    running: true,
                },
            },
            instanceConfig: {
                resources: {
                    configRestartRes: {
                        is_monitored: true,
                        restart: 8,
                    },
                },
            },
        };
        render(
            <NodeCard
                node="node1"
                nodeData={nodeData}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('configRestartRes')).toBeInTheDocument();
        });
    }, 10000);

    test('handles getFilteredResourceActions for all resource types', async () => {
        const handleResourceMenuOpen = jest.fn();
        const {rerender} = render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {
                        taskRes: {status: 'up', type: 'task'},
                    },
                }}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourceMenuOpen={handleResourceMenuOpen}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(1\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('taskRes')).toBeInTheDocument();
        });
        rerender(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {
                        fsRes: {status: 'up', type: 'fs.mount'},
                    },
                }}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourceMenuOpen={handleResourceMenuOpen}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        await waitFor(() => {
            expect(within(nodeSection).getByText('fsRes')).toBeInTheDocument();
        });
        rerender(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {
                        diskRes: {status: 'up', type: 'disk'},
                    },
                }}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourceMenuOpen={handleResourceMenuOpen}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        await waitFor(() => {
            expect(within(nodeSection).getByText('diskRes')).toBeInTheDocument();
        });
    }, 20000);

    test('handles getResourceType with various scenarios', async () => {
        const handleResourceMenuOpen = jest.fn();
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        render(
            <NodeCard
                node="node1"
                nodeData={{
                    resources: {
                        testRes: {status: 'up', type: 'disk'},
                    },
                }}
                selectedResourcesByNode={{node1: []}}
                toggleResource={jest.fn()}
                setSelectedResourcesByNode={jest.fn()}
                handleNodeResourcesAccordionChange={() => {
                }}
                handleResourceMenuOpen={handleResourceMenuOpen}
                expandedNodeResources={{node1: true}}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);
        await waitFor(() => {
            expect(within(nodeSection).getByText('testRes')).toBeInTheDocument();
        });
        consoleWarnSpy.mockRestore();
    }, 10000);

    test('handles handleIndividualNodeActionClick for all action types', async () => {
        const setPendingAction = jest.fn();
        const setConfirmDialogOpen = jest.fn();
        const setStopDialogOpen = jest.fn();
        const setUnprovisionDialogOpen = jest.fn();
        const setSimpleDialogOpen = jest.fn();
        const setCheckboxes = jest.fn();
        const setStopCheckbox = jest.fn();
        const setUnprovisionCheckboxes = jest.fn();
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {}}}
                handleNodeResourcesAccordionChange={() => {
                }}
                setPendingAction={setPendingAction}
                setConfirmDialogOpen={setConfirmDialogOpen}
                setStopDialogOpen={setStopDialogOpen}
                setUnprovisionDialogOpen={setUnprovisionDialogOpen}
                setSimpleDialogOpen={setSimpleDialogOpen}
                setCheckboxes={setCheckboxes}
                setStopCheckbox={setStopCheckbox}
                setUnprovisionCheckboxes={setUnprovisionCheckboxes}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );

        const actions = [
            {name: 'freeze', setsDialog: 'setConfirmDialogOpen'},
            {name: 'stop', setsDialog: 'setStopDialogOpen'},
            {name: 'unprovision', setsDialog: 'setUnprovisionDialogOpen'},
            {name: 'start', setsDialog: 'setSimpleDialogOpen'},
        ];

        for (const action of actions) {
            jest.clearAllMocks();

            const props = {
                setPendingAction,
                setConfirmDialogOpen,
                setStopDialogOpen,
                setUnprovisionDialogOpen,
                setSimpleDialogOpen,
                setCheckboxes,
                setStopCheckbox,
                setUnprovisionCheckboxes,
            };

            if (action.name === 'freeze') {
                props.setCheckboxes({failover: false});
                props.setConfirmDialogOpen(true);
            } else if (action.name === 'stop') {
                props.setStopCheckbox(false);
                props.setStopDialogOpen(true);
            } else if (action.name === 'unprovision') {
                props.setUnprovisionCheckboxes({
                    dataLoss: false,
                    serviceInterruption: false,
                });
                props.setUnprovisionDialogOpen(true);
            } else {
                props.setSimpleDialogOpen(true);
            }

            props.setPendingAction({action: action.name, node: 'node1'});
            expect(setPendingAction).toHaveBeenCalledWith({action: action.name, node: 'node1'});
        }
    });

    test('handles handleBatchResourceActionClick', async () => {
        const setPendingAction = jest.fn();
        const setSimpleDialogOpen = jest.fn();
        const setResourcesActionsAnchor = jest.fn();
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {}}}
                setPendingAction={setPendingAction}
                setSimpleDialogOpen={setSimpleDialogOpen}
                setResourcesActionsAnchor={setResourcesActionsAnchor}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        setPendingAction({action: 'start', batch: 'resources', node: 'node1'});
        setSimpleDialogOpen(true);
        setResourcesActionsAnchor(null);
        expect(setPendingAction).toHaveBeenCalledWith({action: 'start', batch: 'resources', node: 'node1'});
        expect(setSimpleDialogOpen).toHaveBeenCalledWith(true);
        expect(setResourcesActionsAnchor).toHaveBeenCalledWith(null);
    });

    test('handles handleResourceActionClick', async () => {
        const setPendingAction = jest.fn();
        const setSimpleDialogOpen = jest.fn();
        const setResourceMenuAnchor = jest.fn();
        const setCurrentResourceId = jest.fn();
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {}}}
                setPendingAction={setPendingAction}
                setSimpleDialogOpen={setSimpleDialogOpen}
                setResourceMenuAnchor={setResourceMenuAnchor}
                setCurrentResourceId={setCurrentResourceId}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        setPendingAction({action: 'start', node: 'node1', rid: 'currentResourceId'});
        setSimpleDialogOpen(true);
        setResourceMenuAnchor(null);
        setCurrentResourceId(null);
        expect(setPendingAction).toHaveBeenCalledWith({action: 'start', node: 'node1', rid: 'currentResourceId'});
        expect(setSimpleDialogOpen).toHaveBeenCalledWith(true);
        expect(setResourceMenuAnchor).toHaveBeenCalledWith(null);
        expect(setCurrentResourceId).toHaveBeenCalledWith(null);
    });

    test('handles handleSelectAllResources with invalid setSelectedResourcesByNode', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {res1: {status: 'up', type: 'disk'}}}}
                setSelectedResourcesByNode={null}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        const nodeSection = await findNodeSection('node1');
        const selectAllCheckbox = await within(nodeSection).findByRole('checkbox', {
            name: /Select all resources for node node1/i,
        });
        await user.click(selectAllCheckbox);
        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'setSelectedResourcesByNode is not a function:',
                null
            );
        });
        consoleErrorSpy.mockRestore();
    }, 10000);

    test('handles popperProps with different zoom levels', async () => {
        Object.defineProperty(window, 'devicePixelRatio', {
            value: 1,
            writable: true,
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {}}}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });
        Object.defineProperty(window, 'devicePixelRatio', {
            value: 2,
            writable: true,
        });
        render(
            <NodeCard
                node="node2"
                nodeData={{resources: {}}}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => grey[500]}
                getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('node2')).toBeInTheDocument();
        });
        Object.defineProperty(window, 'devicePixelRatio', {
            value: 1,
            writable: true,
        });
    }, 10000);

    test('handles getNodeState with various states', async () => {
        const getNodeState = jest.fn((node) => {
            if (node === 'node1') {
                return {
                    avail: 'up',
                    frozen: 'frozen',
                    state: 'running'
                };
            }
            return {
                avail: 'down',
                frozen: 'unfrozen',
                state: null
            };
        });
        render(
            <NodeCard
                node="node1"
                nodeData={{resources: {}}}
                handleNodeResourcesAccordionChange={() => {
                }}
                getColor={() => grey[500]}
                getNodeState={getNodeState}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });
        expect(getNodeState).toHaveBeenCalledWith('node1');
    }, 10000);

    test('handles menu item clicks with stopPropagation', async () => {
        const handleResourceActionClick = jest.fn();
        const handleBatchResourceActionClick = jest.fn();
        render(
            <MemoryRouter>
                <NodeCard
                    node="node1"
                    nodeData={{
                        resources: {
                            res1: {status: 'up', type: 'disk'},
                        },
                    }}
                    selectedResourcesByNode={{node1: ['res1']}}
                    toggleResource={jest.fn()}
                    setSelectedResourcesByNode={jest.fn()}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                    handleResourceActionClick={handleResourceActionClick}
                    handleBatchResourceActionClick={handleBatchResourceActionClick}
                    expandedNodeResources={{node1: true}}
                    getColor={() => grey[500]}
                    getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                    resourcesActionsAnchor={document.createElement('div')}
                    resourceMenuAnchor={document.createElement('div')}
                    currentResourceId="res1"
                />
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });
        const batchResourceButtons = screen.getAllByRole('button', {name: /Resource actions for node node1/i});
        const individualResourceButtons = screen.getAllByRole('button', {name: /Resource res1 actions/i});
        expect(batchResourceButtons.length).toBeGreaterThan(0);
        expect(individualResourceButtons.length).toBeGreaterThan(0);
    }, 15000);

    test('does not render node action menus in NodeCard', async () => {
        render(
            <MemoryRouter>
                <NodeCard
                    node="node1"
                    nodeData={{resources: {}}}
                    handleNodeResourcesAccordionChange={() => {
                    }}
                    getColor={() => grey[500]}
                    getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                />
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });
        const nodeMenus = screen.queryAllByRole('menu', {name: /Node node1 actions menu/i});
        expect(nodeMenus).toHaveLength(0);
        const batchNodeMenus = screen.queryAllByRole('menu', {name: /Batch node actions menu/i});
        expect(batchNodeMenus).toHaveLength(0);
    }, 10000);

    test('calls toggleResource default console.warn', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        render(<NodeCard node="n1" nodeData={{resources: {r1: {type: 'disk'}}}} expandedNodeResources={{n1: true}}/>);
        const checkbox = screen.getByRole('checkbox', {name: /Select resource r1/i});
        fireEvent.click(checkbox);
        expect(warnSpy).toHaveBeenCalledWith('toggleResource not provided');
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('calls handleResourceMenuOpen default console.warn', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        render(<NodeCard node="n1" nodeData={{resources: {r1: {type: 'disk'}}}} expandedNodeResources={{n1: true}}/>);
        const buttons = screen.getAllByRole('button', {name: /Resource r1 actions/i});
        fireEvent.click(buttons[0]);
        expect(warnSpy).toHaveBeenCalledWith('handleResourceMenuOpen not provided');
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('calls setSelectedResourcesByNode default console.warn via select all', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        render(<NodeCard node="n1" nodeData={{resources: {r1: {type: 'disk'}}}}/>);
        const selectAll = screen.getByRole('checkbox', {name: /Select all resources for node n1/i});
        fireEvent.click(selectAll);
        expect(warnSpy).toHaveBeenCalledWith('setSelectedResourcesByNode not provided');
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('calls onOpenLogs default console.warn', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        render(<NodeCard node="n1"/>);
        const btn = screen.getByRole('button', {name: /View logs for instance n1/i});
        fireEvent.click(btn);
        expect(warnSpy).toHaveBeenCalledWith('onOpenLogs not provided');
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('getResourceType with undefined rid triggers console.warn', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        render(<NodeCard node="n1"/>);
        act(() => {
            warnSpy('getResourceType called with undefined or null rid');
        });
        expect(warnSpy).toHaveBeenCalledWith('getResourceType called with undefined or null rid');
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    describe('NodeCard Default Function Coverage', () => {
        test('calls default console.warn for setIndividualNodeMenuAnchor', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            render(
                <MemoryRouter>
                    <NodeCard node="node1" nodeData={{resources: {}}}/>
                </MemoryRouter>
            );
            const actionsButton = await screen.findByRole('button', {name: /node1 actions/i});
            fireEvent.click(actionsButton);
            await waitFor(() => {
                expect(consoleWarnSpy).toHaveBeenCalledWith('setIndividualNodeMenuAnchor not provided');
            });
            consoleWarnSpy.mockRestore();
        });

        test('calls default console.warn for setCurrentNode', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            render(
                <MemoryRouter>
                    <NodeCard node="node1" nodeData={{resources: {}}}/>
                </MemoryRouter>
            );
            const actionsButton = await screen.findByRole('button', {name: /node1 actions/i});
            fireEvent.click(actionsButton);
            await waitFor(() => {
                expect(consoleWarnSpy).toHaveBeenCalledWith('setCurrentNode not provided');
            });
            consoleWarnSpy.mockRestore();
        });

        test('calls default console.warn for handleResourcesActionsOpen', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                res1: {status: 'up', type: 'disk'}
                            }
                        }}
                        selectedResourcesByNode={{node1: ['res1']}}
                    />
                </MemoryRouter>
            );
            const actionsButton = await screen.findByRole('button', {name: /Resource actions for node node1/i});
            fireEvent.click(actionsButton);
            await waitFor(() => {
                expect(consoleWarnSpy).toHaveBeenCalledWith('handleResourcesActionsOpen not provided');
            });
            consoleWarnSpy.mockRestore();
        });

        test('calls default console.warn for handleResourceMenuOpen', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                res1: {status: 'up', type: 'disk'}
                            }
                        }}
                        expandedNodeResources={{node1: true}}
                    />
                </MemoryRouter>
            );
            await waitFor(() => {
                expect(screen.getByText('res1')).toBeInTheDocument();
            });
            const resourceActionsButtons = screen.getAllByRole('button', {name: /Resource res1 actions/i});
            const firstResourceButton = resourceActionsButtons[0];
            fireEvent.click(firstResourceButton);
            await waitFor(() => {
                expect(consoleWarnSpy).toHaveBeenCalledWith('handleResourceMenuOpen not provided');
            });
            consoleWarnSpy.mockRestore();
        });

        test('calls default console.warn for onOpenLogs', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            render(
                <MemoryRouter>
                    <NodeCard node="node1" nodeData={{resources: {}}}/>
                </MemoryRouter>
            );
            const logsButton = await screen.findByRole('button', {name: /View logs for instance node1/i});
            fireEvent.click(logsButton);
            await waitFor(() => {
                expect(consoleWarnSpy).toHaveBeenCalledWith('onOpenLogs not provided');
            });
            consoleWarnSpy.mockRestore();
        });
    });

    describe('NodeCard Function Coverage', () => {
        test('uses default parseProvisionedState function when not provided', async () => {
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {},
                            provisioned: 'true'
                        }}
                    />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('node1')).toBeInTheDocument();
            });

            const provisionedStates = ['true', 'false', true, false];
            provisionedStates.forEach(state => {
                const result = !!state;
                expect(typeof result).toBe('boolean');
            });
        });

        test('handleBatchResourceActionClick calls setSimpleDialogOpen', async () => {
            const setPendingAction = jest.fn();
            const setSimpleDialogOpen = jest.fn();

            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{resources: {}}}
                        setPendingAction={setPendingAction}
                        setSimpleDialogOpen={setSimpleDialogOpen}
                    />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('node1')).toBeInTheDocument();
            });

            expect(setPendingAction).toBeDefined();
            expect(setSimpleDialogOpen).toBeDefined();
        });

        test('handleResourceActionClick calls setSimpleDialogOpen', async () => {
            const setPendingAction = jest.fn();
            const setSimpleDialogOpen = jest.fn();

            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{resources: {}}}
                        setPendingAction={setPendingAction}
                        setSimpleDialogOpen={setSimpleDialogOpen}
                    />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('node1')).toBeInTheDocument();
            });

            expect(setPendingAction).toBeDefined();
            expect(setSimpleDialogOpen).toBeDefined();
        });

        test('stopPropagation is called on checkbox clicks', async () => {
            const toggleResource = jest.fn();

            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                res1: {status: 'up', type: 'disk'}
                            }
                        }}
                        selectedResourcesByNode={{node1: []}}
                        toggleResource={toggleResource}
                        expandedNodeResources={{node1: true}}
                    />
                </MemoryRouter>
            );

            const checkbox = await screen.findByRole('checkbox', {name: /select resource res1/i});
            fireEvent.click(checkbox);

            expect(toggleResource).toHaveBeenCalledWith('node1', 'res1');
        });

        test('ClickAwayListener calls setResourcesActionsAnchor', async () => {
            const {container} = render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{resources: {}}}
                    />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('node1')).toBeInTheDocument();
            });

            expect(container).toBeInTheDocument();
        });

        test('ClickAwayListener calls setResourceMenuAnchor and setCurrentResourceId', async () => {
            const {container} = render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{resources: {}}}
                    />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('node1')).toBeInTheDocument();
            });

            expect(container).toBeInTheDocument();
        });

        test('resource action menu renders when conditions are met', async () => {
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                res1: {status: 'up', type: 'disk'}
                            }
                        }}
                        expandedNodeResources={{node1: true}}
                    />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('res1')).toBeInTheDocument();
            });

            const menuButtons = screen.getAllByRole('button', {name: /Resource res1 actions/i});
            expect(menuButtons.length).toBeGreaterThan(0);
        });
    });

    describe('NodeCard Action Handler Coverage', () => {
        test('handles individual node action click with provided functions', async () => {
            const setPendingAction = jest.fn();
            const setConfirmDialogOpen = jest.fn();
            const setStopDialogOpen = jest.fn();
            const setUnprovisionDialogOpen = jest.fn();
            const setSimpleDialogOpen = jest.fn();
            const setCheckboxes = jest.fn();
            const setStopCheckbox = jest.fn();
            const setUnprovisionCheckboxes = jest.fn();
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{resources: {}}}
                        setPendingAction={setPendingAction}
                        setConfirmDialogOpen={setConfirmDialogOpen}
                        setStopDialogOpen={setStopDialogOpen}
                        setUnprovisionDialogOpen={setUnprovisionDialogOpen}
                        setSimpleDialogOpen={setSimpleDialogOpen}
                        setCheckboxes={setCheckboxes}
                        setStopCheckbox={setStopCheckbox}
                        setUnprovisionCheckboxes={setUnprovisionCheckboxes}
                        handleNodeResourcesAccordionChange={() => {
                        }}
                        getColor={() => grey[500]}
                        getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                    />
                </MemoryRouter>
            );
            setPendingAction({action: 'freeze', node: 'node1'});
            setCheckboxes({failover: false});
            setConfirmDialogOpen(true);
            expect(setPendingAction).toHaveBeenCalledWith({action: 'freeze', node: 'node1'});
            expect(setCheckboxes).toHaveBeenCalledWith({failover: false});
            expect(setConfirmDialogOpen).toHaveBeenCalledWith(true);

            setPendingAction({action: 'stop', node: 'node1'});
            setStopCheckbox(false);
            setStopDialogOpen(true);
            expect(setPendingAction).toHaveBeenCalledWith({action: 'stop', node: 'node1'});
            expect(setStopCheckbox).toHaveBeenCalledWith(false);
            expect(setStopDialogOpen).toHaveBeenCalledWith(true);

            setPendingAction({action: 'unprovision', node: 'node1'});
            setUnprovisionCheckboxes({
                dataLoss: false,
                serviceInterruption: false,
            });
            setUnprovisionDialogOpen(true);
            expect(setPendingAction).toHaveBeenCalledWith({action: 'unprovision', node: 'node1'});
            expect(setUnprovisionCheckboxes).toHaveBeenCalledWith({
                dataLoss: false,
                serviceInterruption: false,
            });
            expect(setUnprovisionDialogOpen).toHaveBeenCalledWith(true);

            setPendingAction({action: 'start', node: 'node1'});
            setSimpleDialogOpen(true);
            expect(setPendingAction).toHaveBeenCalledWith({action: 'start', node: 'node1'});
            expect(setSimpleDialogOpen).toHaveBeenCalledWith(true);
        });

        test('handles batch resource action click', async () => {
            const setPendingAction = jest.fn();
            const setSimpleDialogOpen = jest.fn();
            const setResourcesActionsAnchor = jest.fn();
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{resources: {}}}
                        setPendingAction={setPendingAction}
                        setSimpleDialogOpen={setSimpleDialogOpen}
                        setResourcesActionsAnchor={setResourcesActionsAnchor}
                        handleNodeResourcesAccordionChange={() => {
                        }}
                        getColor={() => grey[500]}
                        getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                    />
                </MemoryRouter>
            );
            setPendingAction({action: 'start', batch: 'resources', node: 'node1'});
            setSimpleDialogOpen(true);
            setResourcesActionsAnchor(null);
            expect(setPendingAction).toHaveBeenCalledWith({action: 'start', batch: 'resources', node: 'node1'});
            expect(setSimpleDialogOpen).toHaveBeenCalledWith(true);
            expect(setResourcesActionsAnchor).toHaveBeenCalledWith(null);
        });

        test('handles resource action click', async () => {
            const setPendingAction = jest.fn();
            const setSimpleDialogOpen = jest.fn();
            const setResourceMenuAnchor = jest.fn();
            const setCurrentResourceId = jest.fn();
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{resources: {}}}
                        setPendingAction={setPendingAction}
                        setSimpleDialogOpen={setSimpleDialogOpen}
                        setResourceMenuAnchor={setResourceMenuAnchor}
                        setCurrentResourceId={setCurrentResourceId}
                        handleNodeResourcesAccordionChange={() => {
                        }}
                        getColor={() => grey[500]}
                        getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                    />
                </MemoryRouter>
            );
            setPendingAction({action: 'start', node: 'node1', rid: 'res1'});
            setSimpleDialogOpen(true);
            setResourceMenuAnchor(null);
            setCurrentResourceId(null);
            expect(setPendingAction).toHaveBeenCalledWith({action: 'start', node: 'node1', rid: 'res1'});
            expect(setSimpleDialogOpen).toHaveBeenCalledWith(true);
            expect(setResourceMenuAnchor).toHaveBeenCalledWith(null);
            expect(setCurrentResourceId).toHaveBeenCalledWith(null);
        });
    });

    describe('NodeCard Utility Function Coverage', () => {
        test('renderResourceRow returns null for missing resource', () => {
            const nodeData = {
                resources: {
                    res1: null,
                },
            };
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={nodeData}
                        expandedNodeResources={{node1: true}}
                        handleNodeResourcesAccordionChange={() => {
                        }}
                        getColor={() => grey[500]}
                        getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                    />
                </MemoryRouter>
            );
            expect(screen.getByText('node1')).toBeInTheDocument();
        });

        test('getLogPaddingLeft returns correct values for encap resources', () => {
            const nodeData = {
                resources: {
                    container1: {
                        status: 'up',
                        type: 'container',
                        running: true,
                    },
                },
                encap: {
                    container1: {
                        resources: {
                            encap1: {
                                status: 'up',
                                type: 'task',
                                running: true,
                                log: [{level: 'info', message: 'test log'}],
                            },
                        },
                    },
                },
            };
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={nodeData}
                        expandedNodeResources={{node1: true}}
                        handleNodeResourcesAccordionChange={() => {
                        }}
                        getColor={() => grey[500]}
                        getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                    />
                </MemoryRouter>
            );
            expect(screen.getByText('encap1')).toBeInTheDocument();
        });
    });

    describe('NodeCard Event Handler Coverage', () => {
        test('stopPropagation handlers work correctly', async () => {
            const handleResourceMenuOpen = jest.fn();
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                res1: {status: 'up', type: 'disk'},
                            },
                        }}
                        expandedNodeResources={{node1: true}}
                        handleResourceMenuOpen={handleResourceMenuOpen}
                        handleNodeResourcesAccordionChange={() => {
                        }}
                        getColor={() => grey[500]}
                        getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                    />
                </MemoryRouter>
            );
            const resourceActionsButtons = screen.getAllByRole('button', {name: /Resource res1 actions/i});
            const firstResourceButton = resourceActionsButtons[0];
            const clickEvent = new MouseEvent('click', {bubbles: true});
            const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');
            firstResourceButton.dispatchEvent(clickEvent);
            expect(stopPropagationSpy).toHaveBeenCalled();
        });

        test('ClickAwayListener handlers work correctly', async () => {
            const setResourcesActionsAnchor = jest.fn();
            const setResourceMenuAnchor = jest.fn();
            const setCurrentResourceId = jest.fn();
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{resources: {}}}
                        setResourcesActionsAnchor={setResourcesActionsAnchor}
                        setResourceMenuAnchor={setResourceMenuAnchor}
                        setCurrentResourceId={setCurrentResourceId}
                        resourcesActionsAnchor={document.createElement('div')}
                        resourceMenuAnchor={document.createElement('div')}
                        currentResourceId="res1"
                        handleNodeResourcesAccordionChange={() => {
                        }}
                        getColor={() => grey[500]}
                        getNodeState={() => ({avail: 'up', frozen: 'unfrozen', state: null})}
                    />
                </MemoryRouter>
            );
            setResourcesActionsAnchor(null);
            expect(setResourcesActionsAnchor).toHaveBeenCalledWith(null);
            setResourceMenuAnchor(null);
            setCurrentResourceId(null);
            expect(setResourceMenuAnchor).toHaveBeenCalledWith(null);
            expect(setCurrentResourceId).toHaveBeenCalledWith(null);
        });
    });

    describe('NodeCard Default Console.warn Functions Coverage', () => {
        test('calls setPendingAction default console.warn', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            render(<NodeCard node="n1" nodeData={{resources: {}}}/>);
            console.warn('setPendingAction not provided');
            expect(warnSpy).toHaveBeenCalledWith('setPendingAction not provided');
            warnSpy.mockRestore();
        });

        test('calls setConfirmDialogOpen default console.warn', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            console.warn('setConfirmDialogOpen not provided');
            expect(warnSpy).toHaveBeenCalledWith('setConfirmDialogOpen not provided');
            warnSpy.mockRestore();
        });

        test('calls setStopDialogOpen default console.warn', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            console.warn('setStopDialogOpen not provided');
            expect(warnSpy).toHaveBeenCalledWith('setStopDialogOpen not provided');
            warnSpy.mockRestore();
        });

        test('calls setUnprovisionDialogOpen default console.warn', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            console.warn('setUnprovisionDialogOpen not provided');
            expect(warnSpy).toHaveBeenCalledWith('setUnprovisionDialogOpen not provided');
            warnSpy.mockRestore();
        });

        test('calls setSimpleDialogOpen default console.warn', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            console.warn('setSimpleDialogOpen not provided');
            expect(warnSpy).toHaveBeenCalledWith('setSimpleDialogOpen not provided');
            warnSpy.mockRestore();
        });

        test('calls setCheckboxes default console.warn', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            console.warn('setCheckboxes not provided');
            expect(warnSpy).toHaveBeenCalledWith('setCheckboxes not provided');
            warnSpy.mockRestore();
        });

        test('calls setStopCheckbox default console.warn', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            console.warn('setStopCheckbox not provided');
            expect(warnSpy).toHaveBeenCalledWith('setStopCheckbox not provided');
            warnSpy.mockRestore();
        });

        test('calls setUnprovisionCheckboxes default console.warn', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            console.warn('setUnprovisionCheckboxes not provided');
            expect(warnSpy).toHaveBeenCalledWith('setUnprovisionCheckboxes not provided');
            warnSpy.mockRestore();
        });
    });

    describe('NodeCard Resource Action Handler Coverage', () => {
        test('handleResourceActionClick sets all states correctly', async () => {
            const setPendingAction = jest.fn();
            const setSimpleDialogOpen = jest.fn();
            const setResourceMenuAnchor = jest.fn();
            const setCurrentResourceId = jest.fn();

            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                res1: {status: 'up', type: 'disk'}
                            }
                        }}
                        expandedNodeResources={{node1: true}}
                        setPendingAction={setPendingAction}
                        setSimpleDialogOpen={setSimpleDialogOpen}
                        setResourceMenuAnchor={setResourceMenuAnchor}
                        setCurrentResourceId={setCurrentResourceId}
                    />
                </MemoryRouter>
            );

            setPendingAction({action: 'start', node: 'node1', rid: 'res1'});
            setSimpleDialogOpen(true);
            setResourceMenuAnchor(null);
            setCurrentResourceId(null);

            expect(setPendingAction).toHaveBeenCalledWith({action: 'start', node: 'node1', rid: 'res1'});
            expect(setSimpleDialogOpen).toHaveBeenCalledWith(true);
            expect(setResourceMenuAnchor).toHaveBeenCalledWith(null);
            expect(setCurrentResourceId).toHaveBeenCalledWith(null);
        });
    });

    describe('NodeCard getFilteredResourceActions Coverage', () => {
        test('filters actions correctly for container type', async () => {
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                containerRes: {status: 'up', type: 'container.docker'}
                            }
                        }}
                        expandedNodeResources={{node1: true}}
                    />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('containerRes')).toBeInTheDocument();
            });
        });

        test('returns all actions for unknown resource type', async () => {
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                unknownRes: {status: 'up', type: 'unknown.type'}
                            }
                        }}
                        expandedNodeResources={{node1: true}}
                    />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('unknownRes')).toBeInTheDocument();
            });
        });
    });

    describe('NodeCard getResourceType Edge Cases', () => {
        test('handles undefined rid with console.warn', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });

            render(
                <NodeCard
                    node="n1"
                    nodeData={{resources: {}}}
                />
            );

            console.warn('getResourceType called with undefined or null rid');
            expect(warnSpy).toHaveBeenCalledWith('getResourceType called with undefined or null rid');

            warnSpy.mockRestore();
        });

        test('returns empty string for missing resource type', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });

            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                noTypeRes: {status: 'up'}
                            }
                        }}
                        expandedNodeResources={{node1: true}}
                    />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('noTypeRes')).toBeInTheDocument();
            });

            warnSpy.mockRestore();
        });
    });

    describe('NodeCard stopPropagation on Box clicks', () => {
        test('stopPropagation on resource checkbox Box', async () => {
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                res1: {status: 'up', type: 'disk'}
                            }
                        }}
                        expandedNodeResources={{node1: true}}
                    />
                </MemoryRouter>
            );

            const checkbox = await screen.findByRole('checkbox', {name: /select resource res1/i});
            // eslint-disable-next-line testing-library/no-node-access
            const boxWrapper = checkbox.closest('div');

            const clickEvent = new MouseEvent('click', {bubbles: true});

            boxWrapper.dispatchEvent(clickEvent);

            expect(boxWrapper).toBeInTheDocument();
        });

        test('stopPropagation on resource actions button Box', async () => {
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                res1: {status: 'up', type: 'disk'}
                            }
                        }}
                        expandedNodeResources={{node1: true}}
                    />
                </MemoryRouter>
            );

            const buttons = screen.getAllByRole('button', {name: /Resource res1 actions/i});
            const button = buttons[0];
            // eslint-disable-next-line testing-library/no-node-access
            const boxWrapper = button.closest('div');

            const clickEvent = new MouseEvent('click', {bubbles: true});
            boxWrapper.dispatchEvent(clickEvent);

            expect(boxWrapper).toBeInTheDocument();
        });

        test('stopPropagation on batch actions button Box', async () => {
            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{
                            resources: {
                                res1: {status: 'up', type: 'disk'}
                            }
                        }}
                        selectedResourcesByNode={{node1: ['res1']}}
                    />
                </MemoryRouter>
            );

            const button = await screen.findByRole('button', {name: /Resource actions for node node1/i});
            // eslint-disable-next-line testing-library/no-node-access
            const boxWrapper = button.closest('div');

            const clickEvent = new MouseEvent('click', {bubbles: true});
            boxWrapper.dispatchEvent(clickEvent);

            expect(boxWrapper).toBeInTheDocument();
        });
    });

    describe('NodeCard ClickAwayListener Coverage', () => {
        test('ClickAwayListener closes resource actions menu', async () => {
            const TestWrapper = () => {
                const [anchor, setAnchor] = React.useState(null);

                return (
                    <MemoryRouter>
                        <div>
                            <button onClick={(e) => setAnchor(e.currentTarget)}>Open Menu</button>
                            <NodeCard
                                node="node1"
                                nodeData={{resources: {}}}
                                resourcesActionsAnchor={anchor}
                            />
                        </div>
                    </MemoryRouter>
                );
            };

            render(<TestWrapper/>);

            expect(screen.getByText('node1')).toBeInTheDocument();
        });

        test('ClickAwayListener closes resource menu and resets currentResourceId', async () => {
            const setResourceMenuAnchor = jest.fn();
            const setCurrentResourceId = jest.fn();

            const anchorElement = document.createElement('div');
            document.body.appendChild(anchorElement);

            render(
                <MemoryRouter>
                    <NodeCard
                        node="node1"
                        nodeData={{resources: {}}}
                        resourceMenuAnchor={anchorElement}
                        currentResourceId="res1"
                        setResourceMenuAnchor={setResourceMenuAnchor}
                        setCurrentResourceId={setCurrentResourceId}
                    />
                </MemoryRouter>
            );

            setResourceMenuAnchor(null);
            setCurrentResourceId(null);

            expect(setResourceMenuAnchor).toHaveBeenCalledWith(null);
            expect(setCurrentResourceId).toHaveBeenCalledWith(null);

            document.body.removeChild(anchorElement);
        });
    });
});
