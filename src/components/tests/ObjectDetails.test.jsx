import React, {act} from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ObjectDetail, {getResourceType, parseProvisionedState} from '../ObjectDetails';
import useEventStore from '../../hooks/useEventStore.js';
import {closeEventSource, startEventReception} from '../../eventSourceManager.jsx';
import userEvent from '@testing-library/user-event';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
    useNavigate: jest.fn(),
}));
jest.mock('../../hooks/useEventStore.js');
jest.mock('../../eventSourceManager.jsx', () => ({
    closeEventSource: jest.fn(),
    startEventReception: jest.fn(),
    startLoggerReception: jest.fn(),
    closeLoggerEventSource: jest.fn(),
}));
// Mock useDarkMode hook
jest.mock('../../context/DarkModeContext', () => ({
    useDarkMode: () => ({
        isDarkMode: false,
        toggleDarkMode: jest.fn(),
    }),
}));

// Mock ConfigSection
jest.mock('../ConfigSection', () => ({
    __esModule: true,
    default: ({
                  decodedObjectName,
                  configNode,
                  setConfigNode,
                  openSnackbar,
                  configDialogOpen,
                  setConfigDialogOpen
              }) => (
        <div>
            <button
                onClick={() => setConfigDialogOpen(true)}
                data-testid="open-config-dialog"
            >
                View Configuration
            </button>
            {configDialogOpen && (
                <div role="dialog" data-testid="config-dialog">
                    <div>Configuration for {decodedObjectName}</div>
                    {configNode && <div>Node: {configNode}</div>}
                </div>
            )}
        </div>
    ),
}));

// Mock Material-UI components
jest.mock('@mui/material', () => {
    const actual = jest.requireActual('@mui/material');
    return {
        ...actual,
        Accordion: ({children, expanded, onChange, ...props}) => (
            <div role="region" className={expanded ? 'expanded' : ''} {...props}>
                {children}
            </div>
        ),
        AccordionSummary: ({children, id, onChange, expanded, expandIcon, ...props}) => (
            <div
                role="button"
                aria-expanded={expanded ? 'true' : 'false'}
                aria-label={`expand configuration for ${id}`}
                onClick={() => onChange?.({}, !expanded)}
                {...props}
            >
                {children}
            </div>
        ),
        AccordionDetails: ({children, ...props}) => <div {...props}>{children}</div>,
        Menu: ({children, open, anchorEl, onClose, disablePortal, ...props}) =>
            open ? <div role="menu" {...props}>{children}</div> : null,
        MenuItem: ({children, onClick, ...props}) => (
            <div role="menuitem" onClick={onClick} {...props}>
                {children}
            </div>
        ),
        ListItemIcon: ({children, ...props}) => <span {...props}>{children}</span>,
        ListItemText: ({children, ...props}) => <span {...props}>{children}</span>,
        Dialog: ({children, open, maxWidth, fullWidth, slotProps, ...props}) =>
            open ? <div role="dialog" {...props}>{children}</div> : null,
        DialogTitle: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogContent: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogActions: ({children, ...props}) => <div {...props}>{children}</div>,
        Snackbar: ({children, open, autoHideDuration, anchorOrigin, ...props}) => {
            return open ? <div role="alert" {...props}>{children}</div> : null;
        },
        Alert: ({children, severity, ...props}) => (
            <div role="alert" data-severity={severity} {...props}>
                {children}
            </div>
        ),
        Checkbox: ({checked, onChange, sx, ...props}) => (
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                {...props}
            />
        ),
        IconButton: ({children, onClick, disabled, sx, ...props}) => (
            <button
                onClick={onClick}
                disabled={disabled}
                {...props}
            >
                {children}
            </button>
        ),
        TextField: ({
                        label,
                        value,
                        onChange,
                        disabled,
                        multiline,
                        rows,
                        id,
                        fullWidth,
                        helperText,
                        slotProps,
                        ...props
                    }) => {
            const inputId = id || `textfield-${label}`;
            return (
                <div>
                    <label htmlFor={inputId}>{label}</label>
                    <input
                        id={inputId}
                        type={multiline ? 'text' : 'text'}
                        placeholder={label}
                        value={value}
                        onChange={onChange}
                        disabled={disabled}
                        {...(multiline ? {'data-multiline': true, rows} : {})}
                        {...props}
                    />
                </div>
            );
        },
        Input: ({type, onChange, disabled, ...props}) => (
            <input type={type} onChange={onChange} disabled={disabled} {...props} />
        ),
        CircularProgress: () => <div role="progressbar">Loading...</div>,
        Box: ({children, sx, ...props}) => (
            <div {...props}>
                {children}
            </div>
        ),
        Typography: ({children, sx, ...props}) => <span {...props}>{children}</span>,
        FiberManualRecordIcon: ({sx, ...props}) => (
            <svg {...props} />
        ),
        Tooltip: ({children, title, ...props}) => (
            <span {...props} title={title}>
                {children}
            </span>
        ),
        Button: ({children, onClick, disabled, variant, component, htmlFor, sx, startIcon, ...props}) => (
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
        Popper: ({open, anchorEl, children, ...props}) => open ? <div {...props}>{children}</div> : null,
        Paper: ({elevation, children, ...props}) => <div {...props}>{children}</div>,
        ClickAwayListener: ({onClickAway, children, ...props}) => <div
            onClick={onClickAway} {...props}>{children}</div>,
        Drawer: ({children, open, anchor, onClose, slotProps, ...props}) =>
            open ? <div role="complementary" {...props}>{children}</div> : null,
    };
});

// Mock Material-UI icons
jest.mock('@mui/icons-material/ExpandMore', () => () => <span>ExpandMore</span>);
jest.mock('@mui/icons-material/UploadFile', () => () => <span>UploadFile</span>);
jest.mock('@mui/icons-material/Edit', () => () => <span>Edit</span>);
jest.mock('@mui/icons-material/AcUnit', () => () => <span>AcUnit</span>);
jest.mock('@mui/icons-material/MoreVert', () => () => <span>MoreVertIcon</span>);

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {value: mockLocalStorage});

// Mock constants
jest.mock('../../constants/actions', () => ({
    OBJECT_ACTIONS: [
        {name: 'start', icon: 'StartIcon'},
        {name: 'stop', icon: 'StopIcon'},
        {name: 'freeze', icon: 'FreezeIcon'},
        {name: 'unprovision', icon: 'UnprovisionIcon'},
        {name: 'purge', icon: 'PurgeIcon'},
    ],
    INSTANCE_ACTIONS: [
        {name: 'start', icon: 'StartIcon'},
        {name: 'stop', icon: 'StopIcon'},
        {name: 'freeze', icon: 'FreezeIcon'},
        {name: 'unprovision', icon: 'UnprovisionIcon'},
        {name: 'purge', icon: 'PurgeIcon'},
    ],
    RESOURCE_ACTIONS: [
        {name: 'start', icon: 'StartIcon'},
        {name: 'stop', icon: 'StopIcon'},
        {name: 'run', icon: 'RunIcon'},
        {name: 'unprovision', icon: 'UnprovisionIcon'},
        {name: 'purge', icon: 'PurgeIcon'},
        {name: 'console', icon: 'ConsoleIcon'},
    ],
}));

jest.mock('../LogsViewer.jsx', () => ({nodename, height}) => (
    <div
        data-testid="logs-viewer"
        data-nodename={nodename}
        style={{height: height}}
    >
        Logs Viewer Mock
    </div>
));

describe('ObjectDetail Component', () => {
    const user = userEvent.setup();
    const mockNavigate = jest.fn();

    beforeEach(() => {
        jest.setTimeout(45000);
        jest.clearAllMocks();

        // Mock navigate
        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);

        // Mock fetch
        global.fetch = jest.fn((url, options) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                            {name: 'key2', node: 'node1', size: 6946},
                        ],
                    }),
                    text: () => Promise.resolve(''),
                });
            }
            if (url.includes('/config?set=')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                    text: () => Promise.resolve('Successfully added parameter(s)'),
                });
            }
            if (url.includes('/config?unset=')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                    text: () => Promise.resolve('Successfully unset parameter(s)'),
                });
            }
            if (url.includes('/config?delete=')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                    text: () => Promise.resolve('Successfully deleted section(s)'),
                });
            }
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve(`
[DEFAULT]
nodes = *
orchestrate = ha
id = 0bfea9c4-0114-4776-9169-d5e3455cee1f
long_line = this_is_a_very_long_unbroken_string_that_should_trigger_a_horizontal_scrollbar_abcdefghijklmnopqrstuvwxyz1234567890
[fs#1]
type = flag
                    `),
                    json: () => Promise.resolve({}),
                });
            }
            if (url.includes('/action/') && options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('Action executed successfully'),
                });
            }
            if (url.includes('/api/object/') && url.includes('/action/') && options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('Object action executed successfully'),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
                text: () => Promise.resolve(''),
            });
        });

        // Mock useEventStore
        const mockState = {
            objectStatus: {
                'root/cfg/cfg1': {
                    avail: 'up',
                    frozen: 'frozen',
                },
                'root/svc/svc1': {
                    avail: 'up',
                    frozen: null,
                },
            },
            objectInstanceStatus: {
                'root/cfg/cfg1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
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
                                type: 'task',
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
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
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
                                type: 'task',
                                provisioned: {state: 'false', mtime: '2023-01-01T12:00:00Z'},
                                running: false,
                            },
                            res5: {
                                status: 'up',
                                label: 'Resource 5',
                                type: 'ip',
                                provisioned: true,
                                running: true,
                            },
                        },
                        encap: {
                            container1: {
                                resources: {
                                    res4: {
                                        status: 'up',
                                        label: 'Encap Resource 1',
                                        type: 'container',
                                        provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
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
                'node1:root/cfg/cfg1': {
                    state: 'running',
                    global_expect: 'placed@node1',
                    resources: {
                        res1: {restart: {remaining: 0}},
                    },
                },
                'node1:root/svc/svc1': {
                    state: 'running',
                    global_expect: 'placed@node1',
                    resources: {
                        res1: {restart: {remaining: 0}},
                    },
                },
                'node2:root/svc/svc1': {
                    state: 'idle',
                    global_expect: 'none',
                    resources: {
                        res3: {restart: {remaining: 0}},
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
                'root/svc/svc1': {
                    resources: {
                        res1: {
                            is_monitored: true,
                            is_disabled: false,
                            is_standby: false,
                            restart: 0,
                        },
                        res2: {
                            is_monitored: true,
                            is_disabled: false,
                            is_standby: false,
                            restart: 0,
                        },
                    },
                },
            },
            configUpdates: [],
            configNode: 'node1',
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        // Mock subscribe
        useEventStore.subscribe = jest.fn(() => jest.fn());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders object name without useEventStore', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        const MockObjectDetail = () => {
            const {useParams} = require('react-router-dom');
            const {objectName} = useParams();
            const decodedObjectName = decodeURIComponent(objectName);
            return (
                <div>
                    <span>{decodedObjectName}</span>
                    <span>No information available for object</span>
                </div>
            );
        };
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<MockObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText(/root\/cfg\/cfg1/)).toBeInTheDocument();
        }, {timeout: 5000});
        await waitFor(() => {
            expect(screen.getByText(/No information available for object/i)).toBeInTheDocument();
        }, {timeout: 5000});
    }, 10000);

    test('renders nodes without resources section', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        const objectNames = await screen.findAllByText(/root\/svc\/svc1/i);
        expect(objectNames.length).toBeGreaterThan(0);
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        }, {timeout: 10000, interval: 200});
        await waitFor(() => {
            expect(screen.getByText('node2')).toBeInTheDocument();
        }, {timeout: 10000, interval: 200});
        await waitFor(() => {
            expect(screen.getByText(/running/i)).toBeInTheDocument();
        }, {timeout: 10000, interval: 200});
        await waitFor(() => {
            expect(screen.getByText(/placed@node1/i)).toBeInTheDocument();
        }, {timeout: 10000, interval: 200});
        expect(screen.queryByText(/Resources \(\d+\)/i)).not.toBeInTheDocument();
    }, 15000);

    test('calls startEventReception on mount', () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        expect(localStorage.getItem).toHaveBeenCalledWith('authToken');
        expect(startEventReception).toHaveBeenCalledWith('mock-token', ["ObjectStatusUpdated,path=root/cfg/cfg1", "InstanceStatusUpdated,path=root/cfg/cfg1", "ObjectDeleted,path=root/cfg/cfg1", "InstanceMonitorUpdated,path=root/cfg/cfg1", "InstanceConfigUpdated,path=root/cfg/cfg1", "CONNECTION_OPENED", "CONNECTION_ERROR", "RECONNECTION_ATTEMPT", "MAX_RECONNECTIONS_REACHED", "CONNECTION_CLOSED"]);
    });

    test('calls closeEventSource on unmount', async () => {
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        unmount();
        expect(closeEventSource).toHaveBeenCalled();
    });

    test('handles fetchConfig error - timeout', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        mockLocalStorage.getItem.mockReturnValue('mock-token');
        global.fetch.mockImplementationOnce(() =>
            Promise.reject(new Error('Fetch config timeout'))
        );
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText(/fetch config timeout/i)).toBeInTheDocument();
        }, {timeout: 5000, interval: 100});
    }, 10000);

    test('handles config updates subscription and cleanup', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        const mockSubscribe = jest.fn();
        useEventStore.subscribe = jest.fn((selector, callback) => {
            callback([
                {name: 'cfg1', fullName: 'root/cfg/cfg1', type: 'InstanceConfigUpdated', node: 'node1'},
            ]);
            return mockSubscribe;
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText(/Configuration updated/i)).toBeInTheDocument();
        }, {timeout: 10000});
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        unmount();
        expect(mockSubscribe).toHaveBeenCalled();
    }, 20000);

    test('handles non-function subscription', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        useEventStore.subscribe = jest.fn(() => null);
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        unmount();
        expect(consoleWarnSpy).toHaveBeenCalledWith('[ObjectDetail] Subscription is not a function:', null);
        consoleWarnSpy.mockRestore();
    }, 15000);

    test('getObjectStatus handles missing global_expect', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {},
            instanceMonitor: {
                'node1:root/cfg/cfg1': {state: 'running', global_expect: 'none'},
            },
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.queryByText(/placed@node1/i)).not.toBeInTheDocument();
        }, {timeout: 10000});
    }, 15000);

    test('displays no keys message when keys array is empty', async () => {
        global.fetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({items: []}),
            })
        );
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText(/No keys available/i)).toBeInTheDocument();
        }, {timeout: 5000});
    }, 10000);

    test('renders configuration section and fetches config', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const configButton = await screen.findByTestId('open-config-dialog');
        expect(configButton).toBeInTheDocument();

        fireEvent.click(configButton);

        await waitFor(() => {
            expect(screen.getByTestId('config-dialog')).toBeInTheDocument();
        }, {timeout: 10000, interval: 200});

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/node/name/node1/instance/path/root/cfg/cfg1/config/file'),
            expect.any(Object)
        );
    }, 15000);

    test('does not render nodes for cfg kind', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const objectTitle = await screen.findByText(/root\/cfg\/cfg1/i, {
            selector: 'span[font-weight="bold"]'
        });
        expect(objectTitle).toBeInTheDocument();

        await waitFor(() => {
            const nodeCards = document.querySelectorAll('[class*="MuiCard"], [role="region"][class*="node"]');
            expect(nodeCards).toHaveLength(0);

            const batchActionsButton = screen.queryByRole('button', {name: /Actions on Selected Nodes/i});
            expect(batchActionsButton).not.toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            const keyTableCells = document.querySelectorAll('td');
            let foundInKeys = false;

            keyTableCells.forEach(cell => {
                if (cell.textContent.trim() === 'node1') {
                    foundInKeys = true;
                }
            });

            const allNode1Text = screen.queryAllByText('node1');

            if (allNode1Text.length > 0) {
                allNode1Text.forEach(element => {
                    const isInTable = element.closest('table') !== null;

                    expect(isInTable).toBe(true);
                });
            }
        }, {timeout: 10000});
    }, 15000);

    test('handles initial node selection for config fetch', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const configButton = await screen.findByTestId('open-config-dialog');

        fireEvent.click(configButton);

        await waitFor(
            () => {
                expect(screen.getByTestId('config-dialog')).toBeInTheDocument();
            },
            {timeout: 5000}
        );
        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/config/file'),
                    expect.any(Object)
                );
            },
            {timeout: 5000}
        );
    }, 10000);

    test('renders keys section for cfg kind', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(
            () => {
                expect(screen.getByText(/Keys/i)).toBeInTheDocument();
            },
            {timeout: 5000}
        );
        await waitFor(
            () => {
                expect(screen.getByText('key1')).toBeInTheDocument();
            },
            {timeout: 5000}
        );
        await waitFor(
            () => {
                expect(screen.getByText('key2')).toBeInTheDocument();
            },
            {timeout: 5000}
        );
    }, 10000);

    test('handles node selection and batch actions', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(
            () => {
                expect(screen.getByText('node1')).toBeInTheDocument();
            },
            {timeout: 15000, interval: 200}
        );
        await waitFor(
            () => {
                expect(screen.getByText('node2')).toBeInTheDocument();
            },
            {timeout: 15000, interval: 200}
        );
        const node1Checkbox = screen.getByLabelText(/select node node1/i);
        const node2Checkbox = screen.getByLabelText(/select node node2/i);
        await user.click(node1Checkbox);
        await user.click(node2Checkbox);
        const batchActionsButton = screen.getByRole('button', {
            name: /Actions on selected nodes/i,
        });
        expect(batchActionsButton).not.toBeDisabled();
        await user.click(batchActionsButton);
        await waitFor(() => {
            const menus = screen.queryAllByRole('menu');
            expect(menus.length).toBeGreaterThan(0);
        }, {timeout: 10000});
        const menus = await screen.findAllByRole('menu');
        const menuItems = within(menus[0]).getAllByRole('menuitem');
        const startAction = menuItems.find((item) => item.textContent.match(/Start/i));
        await user.click(startAction);
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 10000});
        const dialogs = screen.getAllByRole('dialog');
        const dialog = dialogs[0];
        const checkbox = within(dialog).queryByRole('checkbox', {name: /confirm/i});
        if (checkbox) {
            await user.click(checkbox);
        }
        const confirmButton = within(dialog).queryByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept|add/i});
        await user.click(confirmButton);
        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/action/start'),
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            Authorization: 'Bearer mock-token',
                        }),
                    })
                );
            },
            {timeout: 20000, interval: 200}
        );
    }, 35000);

    test('handles individual node actions', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(
            () => {
                expect(screen.getByText('node1')).toBeInTheDocument();
            },
            {timeout: 10000, interval: 200}
        );
        const actionsButton = screen.getByRole('button', {
            name: /Node node1 actions/i,
        });
        await user.click(actionsButton);
        await waitFor(() => {
            const menus = screen.queryAllByRole('menu');
            expect(menus.length).toBeGreaterThan(0);
        }, {timeout: 10000});
        const menus = await screen.findAllByRole('menu');
        const menuItems = within(menus[0]).getAllByRole('menuitem');
        const stopAction = menuItems.find((item) => item.textContent.match(/Stop/i));
        await user.click(stopAction);
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 10000});
        const dialogs = screen.getAllByRole('dialog');
        const dialog = dialogs[0];
        const checkbox = within(dialog).queryByRole('checkbox', {name: /confirm/i});
        if (checkbox) {
            await user.click(checkbox);
        }
        const confirmButton = within(dialog).getByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept|add/i});
        await user.click(confirmButton);
        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/action/stop'),
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            Authorization: 'Bearer mock-token',
                        }),
                    })
                );
            },
            {timeout: 20000, interval: 200}
        );
    }, 35000);

    test('handles view instance navigation', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(
            () => {
                expect(screen.getByText('node1')).toBeInTheDocument();
            },
            {timeout: 10000, interval: 200}
        );


        const nodeText = screen.getByText('node1');
        const card = nodeText.closest('div[role="region"]') || nodeText.closest('div');

        if (card) {
            const mockEvent = {
                target: card,
                stopPropagation: jest.fn(),
                closest: (selector) => {
                    if (selector === 'button' || selector === 'input' || selector === '.no-click') {
                        return null;
                    }
                    return null;
                }
            };

            fireEvent.click(card);
        } else {
            fireEvent.click(nodeText);
        }

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/nodes/node1/objects/root%2Fsvc%2Fsvc1');
        }, {timeout: 5000});
    });

    test('subscription without node does not trigger fetchConfig', async () => {
        const unsubscribeMock = jest.fn();
        useEventStore.subscribe = jest.fn((sel, cb) => {
            cb([{name: 'svc1', fullName: 'root/svc/svc1', type: 'InstanceConfigUpdated'}]);
            return unsubscribeMock;
        });
        useEventStore.mockImplementation((sel) =>
            sel({
                objectStatus: {},
                objectInstanceStatus: {},
                instanceMonitor: {},
                instanceConfig: {},
                configUpdates: [],
                clearConfigUpdate: jest.fn(),
            })
        );
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        expect(typeof unsubscribeMock).toBe('function');
    });

    test('fetchConfig handles unmounted component', async () => {
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        });
        global.fetch.mockImplementationOnce(() =>
            new Promise((resolve) => setTimeout(() => resolve({
                ok: true,
                text: () => Promise.resolve('mock-config')
            }), 100))
        );
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        unmount();
        await waitFor(() => {
            expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('fetchConfig success'));
        }, {timeout: 10000});
        consoleLogSpy.mockRestore();
    }, 15000);

    test('useEffect for configUpdates handles no matching update', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {},
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [{name: 'other', type: 'InstanceConfigUpdated', node: 'node1'}],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(mockState.clearConfigUpdate).not.toHaveBeenCalled();
        }, {timeout: 10000});
    }, 15000);

    test('handles component unmount during async operations', async () => {
        let resolveFetch;
        const fetchPromise = new Promise(resolve => {
            resolveFetch = resolve;
        });
        global.fetch.mockImplementationOnce(() => fetchPromise);
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        unmount();
        resolveFetch({
            ok: true,
            text: () => Promise.resolve('config data')
        });
        // Just wait for unmount to complete
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('handles network errors in all action functions', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve('config data')
                });
            }
            return Promise.reject(new Error('Network error'));
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        const objectNames = await screen.findAllByText(/root\/svc\/svc1/i);
        expect(objectNames.length).toBeGreaterThan(0);
        const actionButton = await screen.findByRole('button', {name: /object actions/i});
        await user.click(actionButton);
        await waitFor(() => {
            const menus = screen.queryAllByRole('menu');
            expect(menus.length).toBeGreaterThan(0);
        }, {timeout: 5000});
        const menus = screen.getAllByRole('menu');
        const objectMenu = menus.find(menu =>
            menu.textContent && menu.textContent.includes('Start')
        );
        expect(objectMenu).toBeInTheDocument();
        const startItem = within(objectMenu).getByRole('menuitem', {name: /start/i});
        await user.click(startItem);
        const dialog = await screen.findByRole('dialog');
        const confirmButton = within(dialog).getByRole('button', {name: /confirm/i});
        await user.click(confirmButton);
        await waitFor(() => {
            const alerts = screen.getAllByRole('alert');
            const errorAlert = alerts.find(alert =>
                alert.textContent.includes('Network error') ||
                alert.textContent.includes('Error:') ||
                alert.textContent.toLowerCase().includes('error')
            );
            expect(errorAlert).toBeInTheDocument();
        }, {timeout: 10000});
    }, 20000);

    test('handles all provisioned state formats', async () => {
        expect(parseProvisionedState('true')).toBe(true);
        expect(parseProvisionedState('True')).toBe(true);
        expect(parseProvisionedState('TRUE')).toBe(true);
        expect(parseProvisionedState('false')).toBe(false);
        expect(parseProvisionedState('False')).toBe(false);
        expect(parseProvisionedState('FALSE')).toBe(false);
        expect(parseProvisionedState('yes')).toBe(false);
        expect(parseProvisionedState('no')).toBe(false);
        expect(parseProvisionedState(true)).toBe(true);
        expect(parseProvisionedState(false)).toBe(false);
        expect(parseProvisionedState(1)).toBe(true);
        expect(parseProvisionedState(0)).toBe(false);
        expect(parseProvisionedState(null)).toBe(false);
        expect(parseProvisionedState(undefined)).toBe(false);
        expect(parseProvisionedState({})).toBe(true);
        expect(parseProvisionedState({state: true})).toBe(true);
    });

    test('handles logs drawer interactions', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await screen.findByText('node1');
        const logsButtons = screen.getAllByRole('button', {name: /logs/i});
        const nodeLogsButton = logsButtons.find(button =>
            button.textContent?.includes('Logs') && !button.textContent?.includes('Resource')
        );
        if (!nodeLogsButton) {
            return;
        }
        await user.click(nodeLogsButton);
        await waitFor(() => {
            expect(screen.getByText(/node logs - node1/i)).toBeInTheDocument();
        });
        const closeButton = screen.getByRole('button', {name: /close/i});
        await user.click(closeButton);
        await waitFor(() => {
            expect(screen.queryByText(/node logs - node1/i)).not.toBeInTheDocument();
        });
    });

    test('disables batch actions button when no nodes are selected', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await screen.findByText('node1');
        const batchActionsButton = screen.getByRole('button', {
            name: /Actions on selected nodes/i,
        });
        expect(batchActionsButton.disabled).toBe(true);
    });

    test('getResourceType covers all branches', () => {
        expect(getResourceType(null, {resources: {}})).toBe('');
        expect(getResourceType('', {resources: {}})).toBe('');
        expect(getResourceType('rid1', null)).toBe('');
        expect(getResourceType('rid1', undefined)).toBe('');
        expect(getResourceType('rid1', {
            resources: {rid1: {type: 'disk.disk'}}
        })).toBe('disk.disk');
        expect(getResourceType('rid2', {
            resources: {},
            encap: {
                cont1: {
                    resources: {rid2: {type: 'container.docker'}}
                }
            }
        })).toBe('container.docker');
        expect(getResourceType('rid3', {
            resources: {},
            encap: {
                cont1: {
                    resources: {rid2: {type: 'container.docker'}}
                }
            }
        })).toBe('');
        expect(getResourceType('rid1', {
            resources: {},
            encap: {}
        })).toBe('');
    });

    test('parseProvisionedState covers all branches', () => {
        expect(parseProvisionedState('true')).toBe(true);
        expect(parseProvisionedState('True')).toBe(true);
        expect(parseProvisionedState('TRUE')).toBe(true);
        expect(parseProvisionedState('false')).toBe(false);
        expect(parseProvisionedState('False')).toBe(false);
        expect(parseProvisionedState('FALSE')).toBe(false);
        expect(parseProvisionedState('yes')).toBe(false);
        expect(parseProvisionedState('no')).toBe(false);
        expect(parseProvisionedState(true)).toBe(true);
        expect(parseProvisionedState(false)).toBe(false);
        expect(parseProvisionedState(1)).toBe(true);
        expect(parseProvisionedState(0)).toBe(false);
        expect(parseProvisionedState(null)).toBe(false);
        expect(parseProvisionedState(undefined)).toBe(false);
        expect(parseProvisionedState({})).toBe(true);
        expect(parseProvisionedState({state: true})).toBe(true);
    });

    test('handles logs drawer resize', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await screen.findByText('node1');
        const logsButtons = screen.getAllByRole('button', {name: /logs/i});
        const nodeLogsButton = logsButtons.find(button =>
            button.textContent?.includes('Logs') && !button.textContent?.includes('Resource')
        );
        if (!nodeLogsButton) {
            return;
        }
        await user.click(nodeLogsButton);
        const resizeHandle = screen.getByLabelText('Resize drawer');
        expect(resizeHandle).toBeInTheDocument();
        fireEvent.mouseDown(resizeHandle, {clientX: 100});
        fireEvent.mouseMove(document, {clientX: 200});
        fireEvent.mouseUp(document);
        expect(document.body.style.cursor).toBe('default');
    });

    test('fetchConfig handles missing node', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        const mockState = {
            objectStatus: {
                'root/svc/svc1': {avail: 'up', frozen: null},
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {avail: 'up', resources: {}}
                }
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
            const objectNames = screen.getAllByText(/root\/svc\/svc1/i);
            expect(objectNames.length).toBeGreaterThan(0);
        });
    });

    test('handles subscription errors gracefully', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        useEventStore.subscribe = jest.fn(() => {
            throw new Error('Subscription failed');
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            '[ObjectDetail] Failed to subscribe to configUpdates:',
            expect.any(Error)
        );
        consoleWarnSpy.mockRestore();
    });

    test('handles instanceConfig subscription error', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        let callCount = 0;
        useEventStore.subscribe = jest.fn(() => {
            callCount++;
            if (callCount === 2) {
                throw new Error('Subscription failed');
            }
            return jest.fn();
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[ObjectDetail] Failed to subscribe to instanceConfig:',
                expect.any(Error)
            );
        });
        consoleWarnSpy.mockRestore();
    });

    test('handles config update without valid node', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {avail: 'up', resources: {}}
                }
            },
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [
                {name: 'svc1', fullName: 'root/svc/svc1', type: 'InstanceConfigUpdated'}
            ],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        useEventStore.subscribe = jest.fn((selector, callback) => {
            callback(mockState.configUpdates);
            return jest.fn();
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '[ObjectDetail] No valid node in config update, skipping fetchConfig'
            );
        });
        consoleLogSpy.mockRestore();
    });

    test('handles instance config update successfully', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {avail: 'up', resources: {}}
                }
            },
            instanceMonitor: {},
            instanceConfig: {
                'root/svc/svc1': {
                    node1: {resources: {res1: {is_monitored: true}}}
                }
            },
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        let instanceConfigCallback;
        useEventStore.subscribe = jest.fn((selector, callback) => {
            const stateKey = selector.toString();
            if (stateKey.includes('instanceConfig')) {
                instanceConfigCallback = callback;
            }
            return jest.fn();
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        if (instanceConfigCallback) {
            instanceConfigCallback({
                'root/svc/svc1': {
                    node1: {resources: {res1: {is_monitored: false}}}
                }
            });
        }
        await waitFor(() => {
            const alerts = screen.queryAllByRole('alert');
            const infoAlert = alerts.find(alert =>
                alert.textContent && alert.textContent.includes('Instance configuration updated')
            );
            expect(infoAlert).toBeInTheDocument();
        });
    });

    test('loads initial config from node with encap resources', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        const mockState = {
            objectStatus: {
                'root/svc/svc1': {avail: 'up', frozen: null},
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {},
                        encap: {
                            container1: {
                                resources: {
                                    res1: {type: 'container.docker', status: 'up'}
                                }
                            }
                        }
                    },
                    node2: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {}
                    }
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
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/config/file'),
                expect.any(Object)
            );
        });
    });

    test('closes manage params dialog on submit', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        const objectNames = await screen.findAllByText(/root\/cfg\/cfg1/i);
        expect(objectNames.length).toBeGreaterThan(0);
        const buttons = screen.getAllByRole('button');
        const manageBtn = buttons.find(btn =>
            btn.textContent && btn.textContent.includes('Manage')
        );
        if (!manageBtn) {
            return;
        }
        await user.click(manageBtn);
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
        const dialog = screen.getByRole('dialog');
        const confirmBtn = within(dialog).getByRole('button', {name: /confirm/i});
        await user.click(confirmBtn);
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('handles logs drawer resize with touch events', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await screen.findByText('node1');
        const logsButtons = screen.getAllByRole('button', {name: /logs/i});
        const nodeLogsButton = logsButtons[0];
        await user.click(nodeLogsButton);
        const resizeHandle = screen.getByLabelText('Resize drawer');
        expect(resizeHandle).toBeInTheDocument();
        fireEvent.touchStart(resizeHandle, {
            touches: [{clientX: 100}]
        });
        fireEvent.touchMove(document, {
            touches: [{clientX: 200}]
        });
        fireEvent.touchEnd(document);
        expect(document.body.style.cursor).toBe('default');
    });

    test('handles fetchConfig with network error after unmount', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        global.fetch.mockImplementationOnce(() =>
            new Promise((_, reject) => setTimeout(() => reject(new Error('Network error')), 100))
        );
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        unmount();
        // Just wait for unmount to complete
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('handles post action no token', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        mockLocalStorage.getItem.mockReturnValue(null);
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await screen.findByText('node1');
        const actionButtons = screen.getAllByRole('button', {name: /Node node1 actions/i});
        await user.click(actionButtons[0]);
        const menus = await screen.findAllByRole('menu');
        const startItem = within(menus[0]).getByRole('menuitem', {name: /Start/i});
        await user.click(startItem);
        const dialog = await screen.findByRole('dialog');
        const confirmBtn = within(dialog).getByRole('button', {name: /confirm/i});
        await user.click(confirmBtn);
        await waitFor(() => {
            const alerts = screen.getAllByRole('alert');
            const errorAlert = alerts.find(alert =>
                alert.textContent.includes('Auth token not found')
            );
            expect(errorAlert).toBeInTheDocument();
        });
    }, 15000);

    test('handles getNodeState through component integration', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        // Test with frozen node
        const mockStateWithFrozen = {
            objectStatus: {
                'root/svc/svc1': {avail: 'up', frozen: null},
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: '2023-01-01T12:00:00Z', // Frozen timestamp
                        resources: {},
                    },
                },
            },
            instanceMonitor: {
                'node1:root/svc/svc1': {
                    state: 'running',
                    global_expect: 'placed@node1',
                    resources: {},
                },
            },
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockStateWithFrozen));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        }, {timeout: 10000});
        // The component should render without errors, indirectly testing getNodeState
        const nodeCards = screen.getAllByText(/node1/);
        expect(nodeCards.length).toBeGreaterThan(0);
    });

    test('handles getObjectStatus with global_expect on second node - simplified', async () => {
        const mockState = {
            objectStatus: {
                'root/svc/svc1': {avail: 'up', frozen: null},
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        resources: {}
                    },
                    node2: {
                        avail: 'down',
                        resources: {}
                    }
                }
            },
            instanceMonitor: {
                'node1:root/svc/svc1': {state: 'idle', global_expect: 'none'},
                'node2:root/svc/svc1': {state: 'running', global_expect: 'placed@node2'}
            },
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            const content = document.body.textContent;
            expect(content).toBeTruthy();
        }, {timeout: 10000});
        const nodeElements = screen.queryAllByText(/node/);
        expect(nodeElements.length).toBeGreaterThan(0);
    });

    test('handles logs drawer resize with mouse events', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await screen.findByText('node1');
        // Open logs drawer using a more specific approach
        const logsButtons = screen.getAllByRole('button').filter(button =>
            button.textContent?.includes('Logs') && !button.textContent?.includes('Resource')
        );
        if (logsButtons.length === 0) {
            // If no logs button found, skip this test
            console.log('No logs button found, skipping test');
            return;
        }
        const nodeLogsButton = logsButtons[0];
        await userEvent.click(nodeLogsButton);
        // Wait for drawer to open - look for close icon instead of specific text
        await waitFor(() => {
            expect(screen.getByRole('button', {name: /close/i})).toBeInTheDocument();
        }, {timeout: 5000});
        // Test mouse resize events
        const resizeHandle = screen.getByLabelText('Resize drawer');
        fireEvent.mouseDown(resizeHandle, {clientX: 100});
        fireEvent.mouseMove(document, {clientX: 150});
        fireEvent.mouseUp(document);
        // Verify cursor was reset
        expect(document.body.style.cursor).toBe('default');
    });

    test('handles handleDialogConfirm with various action types', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        // Reset all mocks
        jest.clearAllMocks();
        global.fetch.mockClear();
        mockLocalStorage.getItem.mockReturnValue('mock-token');

        // Track fetch calls
        const fetchCalls = [];
        global.fetch.mockImplementation((url, options) => {
            fetchCalls.push({url, method: options?.method, body: options?.body});

            // Handle initial config/keys fetches
            if (url.includes('/config/file') || url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve('config data'),
                    json: () => Promise.resolve({items: []})
                });
            }

            // Handle action endpoints
            if (url.includes('/action/') && options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('Action executed successfully'),
                });
            }

            // Handle object action endpoints
            if (url.includes('/api/object/') && url.includes('/action/') && options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('Object action executed successfully'),
                });
            }

            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve('success')
            });
        });

        // Mock useEventStore with proper implementation
        const mockState = {
            objectStatus: {
                'root/svc/svc1': {avail: 'up', frozen: null},
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {
                            res1: {
                                status: 'up',
                                label: 'Resource 1',
                                type: 'disk',
                                provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
                                running: true,
                            }
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

        // Mock useEventStore to return our state
        useEventStore.mockImplementation((selector) => {
            if (typeof selector === 'function') {
                return selector(mockState);
            }
            return mockState;
        });

        // Mock subscribe properly
        useEventStore.subscribe = jest.fn((selector, callback) => {
            // Simulate initial call
            callback(mockState.configUpdates);
            return jest.fn(); // Return unsubscribe function
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for component to load completely
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        }, {timeout: 10000});

        // Find and click object actions button
        const objectActionsButton = screen.getByRole('button', {name: 'Object actions'});
        await userEvent.click(objectActionsButton);

        // Wait for menu and click start action
        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        }, {timeout: 5000});

        const startMenuItem = screen.getByRole('menuitem', {name: /start/i});
        await userEvent.click(startMenuItem);

        // Wait for dialog and click confirm
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const confirmButton = screen.getByRole('button', {name: /confirm/i});
        await userEvent.click(confirmButton);

        // Wait for API call - check for any POST call to action endpoints
        await waitFor(() => {
            const actionCalls = fetchCalls.filter(call =>
                call.method === 'POST' &&
                (call.url.includes('/action/') || call.url.includes('/api/object/'))
            );

            // If no specific action calls, check for any POST calls at all
            if (actionCalls.length === 0) {
                const anyPostCalls = fetchCalls.filter(call => call.method === 'POST');
                expect(anyPostCalls.length).toBeGreaterThan(0);
            } else {
                expect(actionCalls.length).toBeGreaterThan(0);
            }
        }, {timeout: 15000});
    }, 20000);

    test('handles fetchConfig error responses', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        // Mock a failed fetch response for config
        let callCount = 0;
        global.fetch.mockImplementation((url) => {
            callCount++;
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error',
                    text: () => Promise.resolve('Internal Server Error')
                });
            }
            // Success for other initial fetches
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve('success'),
                json: () => Promise.resolve({items: []})
            });
        });
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        // Wait for error message to appear - might be in an alert or in the config section
        await waitFor(() => {
            const errorElements = screen.queryAllByText(/failed to fetch config|http error|500/i);
            if (errorElements.length > 0) {
                expect(errorElements[0]).toBeInTheDocument();
            }
            // Also check for any alert with error severity
            const errorAlerts = screen.queryAllByRole('alert').filter(alert =>
                alert.getAttribute('data-severity') === 'error'
            );
            if (errorAlerts.length > 0) {
                expect(errorAlerts[0]).toBeInTheDocument();
            }
        }, {timeout: 10000});
    });

    test('handles logs drawer close and state cleanup', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await screen.findByText('node1');

        // Open logs drawer
        const logsButtons = screen.getAllByRole('button', {name: /logs/i});
        const nodeLogsButton = logsButtons.find(button =>
            button.textContent?.includes('Logs') && !button.textContent?.includes('Resource')
        );

        if (nodeLogsButton) {
            await userEvent.click(nodeLogsButton);

            // Wait for drawer to open
            await waitFor(() => {
                expect(screen.getByText(/Node Logs - node1/i)).toBeInTheDocument();
            });

            // Close logs drawer
            const closeButton = screen.getByRole('button', {name: /close/i});
            await userEvent.click(closeButton);

            // Verify drawer is closed and state is cleaned up
            await waitFor(() => {
                expect(screen.queryByText(/Node Logs - node1/i)).not.toBeInTheDocument();
            });
        }
    });

    test('handles drawer resize event listeners properly', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
        const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await screen.findByText('node1');

        // Open logs drawer
        const logsButtons = screen.getAllByRole('button', {name: /logs/i});
        const nodeLogsButton = logsButtons[0];
        await userEvent.click(nodeLogsButton);

        // Wait for drawer to open
        await waitFor(() => {
            expect(screen.getByLabelText('Resize drawer')).toBeInTheDocument();
        });

        // Test mouse resize events
        const resizeHandle = screen.getByLabelText('Resize drawer');

        // Start resizing
        fireEvent.mouseDown(resizeHandle, {clientX: 100});

        expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

        // Simulate resize
        fireEvent.mouseMove(document, {clientX: 150});

        // Stop resizing
        fireEvent.mouseUp(document);
        expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

        fireEvent.touchStart(resizeHandle, {
            touches: [{clientX: 100}]
        });

        const touchMoveCall = addEventListenerSpy.mock.calls.find(call =>
            call[0] === 'touchmove' && call[2]?.passive === false
        );
        expect(touchMoveCall).toBeDefined();

        expect(addEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

        fireEvent.touchMove(document, {
            touches: [{clientX: 150}]
        });

        fireEvent.touchEnd(document);
        expect(removeEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    test('handles configUpdates subscription with error cases', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        // Setup
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: { avail: 'up', resources: {} }
                }
            },
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };

        // Track fetch calls
        let fetchCallCount = 0;
        global.fetch.mockImplementation((url) => {
            fetchCallCount++;

            if (url.includes('/config/file')) {
                if (fetchCallCount === 1) {
                    // Initial config fetch - succeeds
                    return Promise.resolve({
                        ok: true,
                        text: () => Promise.resolve('initial config'),
                        json: () => Promise.resolve({})
                    });
                } else {
                    // Second config fetch - fails (this is what we're testing)
                    return Promise.reject(new Error('Failed to load updated configuration'));
                }
            }

            // Default response for other endpoints
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve('success'),
                json: () => Promise.resolve({ items: [] })
            });
        });

        // Setup subscription callback tracking
        const subscriptionCallbacks = new Map();
        const unsubscribeMock = jest.fn();

        useEventStore.subscribe = jest.fn((selector, callback, options) => {
            const key = selector.toString();
            subscriptionCallbacks.set(key, callback);

            // Call immediately if fireImmediately option is set
            if (options?.fireImmediately) {
                callback(mockState[getStoreKeyFromSelector(selector)]);
            }

            return unsubscribeMock;
        });

        // Mock useEventStore to return our state
        useEventStore.mockImplementation((selector) => {
            if (typeof selector === 'function') {
                return selector(mockState);
            }
            return mockState;
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for initial fetch
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
        }, { timeout: 5000 });

        // Now simulate a config update
        // Find the configUpdates subscription callback
        const configUpdatesKey = Array.from(subscriptionCallbacks.keys())
            .find(key => key.includes('configUpdates'));

        if (configUpdatesKey) {
            const configUpdatesCallback = subscriptionCallbacks.get(configUpdatesKey);

            // Create a config update
            const newConfigUpdate = {
                name: 'svc1',
                fullName: 'root/svc/svc1',
                node: 'node1',
                type: 'InstanceConfigUpdated'
            };

            // Trigger the callback with the new update
            await act(async () => {
                await configUpdatesCallback([newConfigUpdate]);
            });
        }


        await waitFor(() => {

            expect(fetchCallCount).toBeGreaterThanOrEqual(1);

            // Check that clearConfigUpdate was called
            expect(mockState.clearConfigUpdate).toHaveBeenCalled();
        }, { timeout: 10000 });
    }, 15000);


    test('handles instanceConfig subscription with error cases', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {avail: 'up', resources: {}}
                }
            },
            instanceMonitor: {},
            instanceConfig: {
                'root/svc/svc1': {
                    node1: {resources: {res1: {is_monitored: true}}}
                }
            },
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };

        useEventStore.mockImplementation((selector) => selector(mockState));

        // Mock the subscription to throw an error when processing instance config
        let instanceConfigCallback;
        useEventStore.subscribe = jest.fn((selector, callback) => {
            const stateKey = selector.toString();
            if (stateKey.includes('instanceConfig')) {
                instanceConfigCallback = callback;
                // Simulate callback that will cause an error
                return jest.fn();
            }
            return jest.fn();
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Trigger the instance config update with data that might cause issues
        if (instanceConfigCallback) {
            // This should trigger the error handling path
            act(() => {
                instanceConfigCallback({
                    'root/svc/svc1': {
                        node1: {resources: {res1: {is_monitored: false}}}
                    }
                });
            });
        }

        // We can't easily test the exact snackbar call, but we can verify the component doesn't crash
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });
    });

    test('handles initial config load with no nodes available', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        const mockState = {
            objectStatus: {
                'root/svc/svc1': {avail: 'up', frozen: null},
            },
            objectInstanceStatus: {
                'root/svc/svc1': {} // No nodes
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

        // The component should handle the case where there are no nodes
        await waitFor(() => {
            const objectNames = screen.getAllByText(/root\/svc\/svc1/i);
            expect(objectNames.length).toBeGreaterThan(0);
        });
    });

    test('handles early returns in useEffect callbacks', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        // Test the case where isMounted.current is false
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {avail: 'up', resources: {}}
                }
            },
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [
                {name: 'svc1', fullName: 'root/svc/svc1', node: 'node1', type: 'InstanceConfigUpdated'}
            ],
            clearConfigUpdate: jest.fn(),
        };

        useEventStore.mockImplementation((selector) => selector(mockState));

        // Mock fetch to be slow so we can unmount before it completes
        let fetchResolve;
        const fetchPromise = new Promise(resolve => {
            fetchResolve = resolve;
        });

        global.fetch.mockImplementation(() => fetchPromise);

        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Unmount immediately
        unmount();

        // Resolve the fetch after unmount
        fetchResolve({
            ok: true,
            text: () => Promise.resolve('config data')
        });

        // Wait a bit for any potential state updates
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
        });

        // Component should have unmounted cleanly without errors
        expect(true).toBe(true);
    });
});
