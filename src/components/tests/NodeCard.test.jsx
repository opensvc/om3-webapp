import React from 'react';
import {render, screen, fireEvent, waitFor, act, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ObjectDetail from '../ObjectDetails';
import useEventStore from '../../hooks/useEventStore.js';
import {closeEventSource, startEventReception, configureEventSource} from '../../eventSourceManager.jsx';
import userEvent from '@testing-library/user-event';
import {grey} from '@mui/material/colors';

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
            console.error(`Node section container not found for ${nodeName}`);
            screen.debug();
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
        Menu: ({children, open, anchorEl, onClose, ...props}) =>
            open ? <div role="menu" {...props}>{children}</div> : null,
        MenuItem: ({children, onClick, ...props}) => (
            <div role="menuitem" onClick={onClick} {...props}>
                {children}
            </div>
        ),
        ListItemIcon: ({children, ...props}) => <span {...props}>{children}</span>,
        ListItemText: ({children, ...props}) => <span {...props}>{children}</span>,
        Dialog: ({children, open, maxWidth, fullWidth, ...props}) =>
            open ? <div role="dialog" {...props}>{children}</div> : null,
        DialogTitle: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogContent: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogActions: ({children, ...props}) => <div {...props}>{children}</div>,
        Snackbar: ({children, open, autoHideDuration, ...props}) =>
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
            objectName: 'root/cfg/cfg1',
        });

        const mockState = {
            objectStatus: {
                'root/cfg/cfg1': {
                    avail: 'up',
                    frozen: 'frozen',
                },
            },
            objectInstanceStatus: {
                'root/cfg/cfg1': {
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
                'node1:root/cfg/cfg1': {
                    state: 'running',
                    global_expect: 'placed@node1',
                    resources: {
                        res1: {restart: {remaining: 0}},
                    },
                },
            },
            instanceConfig: {
                'root/cfg/cfg1': {
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
    });

    test('enables batch node actions button when nodes are selected', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
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
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
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
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
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
            const computedStyle = window.getComputedStyle(confirmButton);
            expect(computedStyle.pointerEvents).not.toBe('none');
        }, {timeout: 5000});

        await user.click(confirmButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/cfg/cfg1/action/stop'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'}
                })
            );
        });
    }, 15000);

    test('triggers batch resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 15000);
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(2\)/i);
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

        try {
            const dialog = await screen.findByRole('dialog', {}, {timeout: 15000});
            await waitFor(() => {
                expect(dialog).toHaveTextContent(/Confirm.*Start/i);
            }, {timeout: 15000});

            const dialogCheckbox = within(dialog).queryByRole('checkbox');
            if (dialogCheckbox) {
                await act(async () => {
                    await user.click(dialogCheckbox);
                });
            }

            const confirmButton = await within(dialog).findByRole('button', {name: /Confirm/i});
            await waitFor(() => {
                expect(confirmButton).not.toHaveAttribute('disabled');
                const computedStyle = getComputedStyle(confirmButton);
                expect(computedStyle.pointerEvents).not.toEqual('none');
            }, {timeout: 15000});

            await act(async () => {
                await user.click(confirmButton);
            });

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/node/name/node1/instance/path/root/cfg/cfg1/action/start'),
                    expect.objectContaining({
                        method: 'POST',
                        headers: {Authorization: 'Bearer mock-token'},
                    })
                );
            }, {timeout: 15000});
        } catch (error) {
            console.log('DOM debug after clicking Start:');
            screen.debug();
            throw error;
        }
    }, 45000);

    test('triggers individual resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 15000);
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await act(async () => {
            fireEvent.click(resourcesHeader);
        });

        const res1Row = await within(nodeSection).findByText('res1');
        expect(res1Row).toBeInTheDocument();

        const resourceMenuButton = await within(res1Row.closest('div[style*="display: flex"]')).findByRole('button', {
            name: /Resource res1 actions/i
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
            expect(dialog).toHaveTextContent(/Are you sure you want to restart on object root\/cfg\/cfg1\?/i);
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
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter
            >
        );

        let nodeSection;
        try {
            nodeSection = await findNodeSection('node1', 10000);
        } catch (error) {
            console.error('[Test] Failed to find node1');
            screen.debug();
            throw error;
        }
        expect(nodeSection).toBeInTheDocument();

        const resourcesHeader = await within(nodeSection).findByText(/Resources.*\(/i, {}, {timeout: 5000});
        expect(resourcesHeader).toBeInTheDocument();

        const resourcesHeaderBox = resourcesHeader.closest('div[style*="display: flex"]');
        const resourcesExpandButton = await within(resourcesHeaderBox).findByTestId('ExpandMoreIcon', {}, {timeout: 5000});
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
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
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
            expect(dialog).toHaveTextContent(/I understand that the selected service orchestration will be paused/i);
        }, {timeout: 5000});

        const checkbox = within(screen.getByRole('dialog')).getByRole('checkbox', {name: /Confirm failover pause/i});
        await act(async () => {
            await user.click(checkbox);
        });

        const cancelButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Cancel/i});
        await waitFor(() => {
            expect(cancelButton).not.toBeDisabled();
        }, {timeout: 5000});
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
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
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
                const errorAlert = alerts.find(alert =>
                    /network error/i.test(alert.textContent)
                );
                expect(errorAlert).toBeInTheDocument();
                expect(errorAlert).toHaveAttribute('data-severity', 'error');
            },
            {timeout: 10000}
        );
    }, 30000);

    test('displays node state from instanceMonitor', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
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
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
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
                'root/cfg/cfg1': {
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
            <MemoryRouter initialEntries={['/objects/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/objects/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const nodeSection = await findNodeSection('node1', 15000);
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i, {}, {timeout: 5000});
        await user.click(resourcesHeader);

        const res1Row = await within(nodeSection).findByText('res1', {}, {timeout: 5000});
        const resourceMenuButton = await within(res1Row.closest('div')).findByRole('button', {
            name: /Resource res1 actions/i,
        });
        await user.click(resourceMenuButton);

        const menu = await screen.findByRole('menu', {timeout: 5000});
        const actionItem = await within(menu).findByRole('menuitem', {name: /Restart/i});
        await user.click(actionItem);

        const confirmButton = await screen.findByRole('button', {name: /Confirm/i}, {timeout: 5000});
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
});
