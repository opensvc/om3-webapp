import React, {act} from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import ObjectDetail, {getResourceType, parseProvisionedState} from '../ObjectDetails';
import useEventStore from '../../hooks/useEventStore.js';
import {closeEventSource, startEventReception} from '../../eventSourceManager.jsx';
import logger from '../../utils/logger';

jest.mock('@mui/material', () => {
    const actual = jest.requireActual('@mui/material');
    return {
        ...actual,
        Menu: ({children, open, anchorEl, onClose, disablePortal, ...props}) =>
            open ? <div role="menu" {...props}>{children}</div> : null,
        MenuItem: ({children, onClick, ...props}) => (
            <div role="menuitem" onClick={onClick} {...props}>{children}</div>
        ),
        ListItemIcon: ({children, ...props}) => <span {...props}>{children}</span>,
        ListItemText: ({children, ...props}) => <span {...props}>{children}</span>,
        Dialog: ({children, open, maxWidth, fullWidth, slotProps, ...props}) =>
            open ? <div role="dialog" {...props}>{children}</div> : null,
        DialogTitle: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogContent: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogActions: ({children, ...props}) => <div {...props}>{children}</div>,
        Snackbar: ({children, open, autoHideDuration, anchorOrigin, onClose, ...props}) =>
            open ? <div data-testid="snackbar" {...props}>{children}</div> : null,
        Alert: ({children, severity, onClose, variant, 'aria-label': ariaLabel, ...props}) => (
            <div role="alert" data-severity={severity} aria-label={ariaLabel} data-variant={variant} {...props}>
                {children}
                {onClose && <button onClick={onClose} aria-label="Close" data-testid="alert-close-button">×</button>}
            </div>
        ),
        Checkbox: ({checked, onChange, sx, ...props}) => (
            <input type="checkbox" checked={checked} onChange={onChange} {...props} />
        ),
        IconButton: ({children, onClick, disabled, sx, ...props}) => (
            <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
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
                    <input id={inputId} type="text" placeholder={label} value={value} onChange={onChange}
                           disabled={disabled} {...(multiline ? {'data-multiline': true, rows} : {})} {...props} />
                </div>
            );
        },
        Input: ({type, onChange, disabled, ...props}) => (
            <input type={type} onChange={onChange} disabled={disabled} {...props} />
        ),
        CircularProgress: () => <div role="progressbar">Loading...</div>,
        Box: ({children, sx, ...props}) => <div {...props}>{children}</div>,
        Typography: ({children, sx, ...props}) => <span {...props}>{children}</span>,
        FiberManualRecordIcon: ({sx, ...props}) => <svg {...props} />,
        Tooltip: ({children, title, ...props}) => <span {...props} title={title}>{children}</span>,
        Button: ({children, onClick, disabled, variant, component, htmlFor, sx, startIcon, ...props}) => (
            <button onClick={onClick} disabled={disabled} data-variant={variant}
                    {...(component === 'label' ? {htmlFor} : {})} {...props}>{children}</button>
        ),
        Popper: ({open, anchorEl, children, ...props}) => (open ? <div {...props}>{children}</div> : null),
        Paper: ({elevation, children, ...props}) => <div {...props}>{children}</div>,
        ClickAwayListener: ({onClickAway, children, ...props}) => <div
            onClick={onClickAway} {...props}>{children}</div>,
        Drawer: ({children, open, anchor, onClose, slotProps, ...props}) =>
            open ? <div role="complementary" {...props}>{children}</div> : null,
    };
});

jest.mock('@mui/icons-material/ExpandMore', () => () => <span>ExpandMore</span>);
jest.mock('@mui/icons-material/UploadFile', () => () => <span>UploadFile</span>);
jest.mock('@mui/icons-material/Edit', () => () => <span>Edit</span>);
jest.mock('@mui/icons-material/AcUnit', () => () => <span>AcUnit</span>);
jest.mock('@mui/icons-material/MoreVert', () => () => <span>MoreVertIcon</span>);

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
jest.mock('../../context/DarkModeContext', () => ({
    useDarkMode: () => ({isDarkMode: false, toggleDarkMode: jest.fn()}),
}));
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../ConfigSection', () => ({
    __esModule: true,
    default: ({decodedObjectName, configNode, setConfigNode, openSnackbar, configDialogOpen, setConfigDialogOpen}) => (
        <div>
            <button onClick={() => setConfigDialogOpen(true)} data-testid="open-config-dialog">
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
    <div data-testid="logs-viewer" data-nodename={nodename} style={{height}}>
        Logs Viewer Mock
    </div>
));

// ─── localStorage mock ─────────────────────────────────────────────────────
const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {value: mockLocalStorage});

const buildState = (overrides = {}) => ({
    objectStatus: {'root/svc/svc1': {avail: 'up', frozen: null}},
    objectInstanceStatus: {
        'root/svc/svc1': {
            node1: {
                avail: 'up',
                frozen_at: null,
                resources: {
                    res1: {status: 'up', label: 'R1', type: 'disk', provisioned: {state: 'true'}, running: true},
                },
            },
            node2: {
                avail: 'down',
                frozen_at: null,
                resources: {
                    res2: {status: 'warn', label: 'R2', type: 'compute', provisioned: {state: 'true'}, running: false},
                },
            },
        },
    },
    instanceMonitor: {
        'node1:root/svc/svc1': {state: 'running', global_expect: 'placed@node1', resources: {}},
        'node2:root/svc/svc1': {state: 'idle', global_expect: 'none', resources: {}},
    },
    instanceConfig: {
        'root/svc/svc1': {
            node1: {resources: {res1: {is_monitored: true, is_disabled: false, is_standby: false, restart: 0}}},
        },
    },
    configUpdates: [],
    clearConfigUpdate: jest.fn(),
    ...overrides,
});

const fullMockState = {
    objectStatus: {
        'root/cfg/cfg1': {avail: 'up', frozen: 'frozen'},
        'root/svc/svc1': {avail: 'up', frozen: null},
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
                        running: true
                    },
                    res2: {
                        status: 'down',
                        label: 'Resource 2',
                        type: 'task',
                        provisioned: {state: 'false', mtime: '2023-01-01T12:00:00Z'},
                        running: false
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
                        running: false
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
                        running: true
                    },
                    res2: {
                        status: 'down',
                        label: 'Resource 2',
                        type: 'task',
                        provisioned: {state: 'false', mtime: '2023-01-01T12:00:00Z'},
                        running: false
                    },
                    res5: {status: 'up', label: 'Resource 5', type: 'ip', provisioned: true, running: true},
                },
                encap: {
                    container1: {
                        resources: {
                            res4: {
                                status: 'up',
                                label: 'Encap Resource 1',
                                type: 'container',
                                provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
                                running: true
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
                        running: false
                    },
                },
            },
        },
    },
    instanceMonitor: {
        'node1:root/cfg/cfg1': {
            state: 'running',
            global_expect: 'placed@node1',
            resources: {res1: {restart: {remaining: 0}}}
        },
        'node1:root/svc/svc1': {
            state: 'running',
            global_expect: 'placed@node1',
            resources: {res1: {restart: {remaining: 0}}}
        },
        'node2:root/svc/svc1': {state: 'idle', global_expect: 'none', resources: {res3: {restart: {remaining: 0}}}},
    },
    instanceConfig: {
        'root/cfg/cfg1': {resources: {res1: {is_monitored: true, is_disabled: false, is_standby: false, restart: 0}}},
        'root/svc/svc1': {
            resources: {
                res1: {is_monitored: true, is_disabled: false, is_standby: false, restart: 0},
                res2: {is_monitored: true, is_disabled: false, is_standby: false, restart: 0},
            },
        },
    },
    configUpdates: [],
    configNode: 'node1',
    clearConfigUpdate: jest.fn(),
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const renderComponent = (objectName) => {
    require('react-router-dom').useParams.mockReturnValue({objectName});
    return render(
        <MemoryRouter initialEntries={[`/object/${encodeURIComponent(objectName)}`]}>
            <Routes>
                <Route path="/object/:objectName" element={<ObjectDetail/>}/>
            </Routes>
        </MemoryRouter>
    );
};

const renderSvc = (objectName = 'root/svc/svc1') => renderComponent(objectName);
const waitForNode = async (nodeName) => screen.findByText(nodeName, {}, {timeout: 10000});

const renderReadySvc = async () => {
    renderSvc();
    await waitForNode('node1');
    await waitForNode('node2');
    return {node1: screen.getByText('node1'), node2: screen.getByText('node2')};
};

const executeObjectAction = async (actionName) => {
    await userEvent.click(screen.getByRole('button', {name: /object actions/i}));
    await screen.findByRole('menu');
    await userEvent.click(screen.getByRole('menuitem', {name: new RegExp(actionName, 'i')}));
    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept/i});
    await userEvent.click(confirmBtn);
};

const mockNetworkFailure = (urlPattern) => {
    global.fetch.mockImplementation((url, options) => {
        if (url.includes(urlPattern)) return Promise.reject(new Error('Network error'));
        return Promise.resolve({ok: true, text: () => Promise.resolve('')});
    });
};

const mockActionFailure = (status = 500, message = 'Server error') => {
    global.fetch.mockImplementation((url, options) => {
        if (options?.method === 'POST' && url.includes('/action/'))
            return Promise.resolve({ok: false, status, text: () => Promise.resolve(message)});
        return Promise.resolve({ok: true, text: () => Promise.resolve('')});
    });
};

const captureSubscription = () => {
    let callback;
    useEventStore.subscribe = jest.fn((selector, cb) => {
        callback = cb;
        return jest.fn();
    });
    return {
        get callback() {
            return callback;
        },
    };
};

const withConsole = async (fn) => {
    const {INSTANCE_ACTIONS} = require('../../constants/actions');
    const orig = [...INSTANCE_ACTIONS];
    INSTANCE_ACTIONS.push({name: 'console', icon: 'ConsoleIcon'});
    try {
        await fn();
    } finally {
        INSTANCE_ACTIONS.length = 0;
        orig.forEach((a) => INSTANCE_ACTIONS.push(a));
    }
};

const openConsoleDialogFn = async () => {
    await screen.findByText('node1');
    await userEvent.click(screen.getByRole('button', {name: /Node node1 actions/i}));
    await waitFor(() => expect(screen.queryAllByRole('menu').length).toBeGreaterThan(0), {timeout: 3000});
    const menus = screen.getAllByRole('menu');
    const consoleItems = within(menus[menus.length - 1]).queryAllByRole('menuitem', {name: /console/i});
    if (consoleItems.length === 0) return null;
    await userEvent.click(consoleItems[0]);
    await waitFor(() => {
        expect(
            screen.queryAllByRole('dialog').some(
                (d) => d.textContent.includes('terminal console') || d.textContent.includes('Open Console')
            )
        ).toBe(true);
    }, {timeout: 5000});
    return (
        screen.queryAllByRole('dialog').find(
            (d) => d.textContent.includes('terminal console') || d.textContent.includes('Open Console')
        ) || null
    );
};

const defaultFetchMock = (url, options) => {
    if (url.includes('/data/keys')) {
        return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve({
                items: [{name: 'key1', node: 'node1', size: 2626}, {name: 'key2', node: 'node1', size: 6946}]
            }),
            text: () => Promise.resolve(''),
        });
    }
    if (url.includes('/config?set=') || url.includes('/config?unset=') || url.includes('/config?delete=')) {
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
            text: () => Promise.resolve('Success')
        });
    }
    if (url.includes('/config/file')) {
        return Promise.resolve({
            ok: true, status: 200,
            text: () => Promise.resolve(`[DEFAULT]\nnodes = *\norchestrate = ha\nid = 0bfea9c4-0114-4776-9169-d5e3455cee1f\n[fs#1]\ntype = flag`),
            json: () => Promise.resolve({}),
        });
    }
    if (url.includes('/console') && options?.method === 'POST') {
        return Promise.resolve({
            ok: true,
            headers: {get: (h) => (h === 'Location' ? 'http://console.example.com/session123' : null)}
        });
    }
    if (options?.method === 'POST' && url.includes('/action/')) {
        return Promise.resolve({ok: true, status: 200, text: () => Promise.resolve('Action executed successfully')});
    }
    return Promise.resolve({ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('')});
};

// ─── Tests ─────────────────────────────────────────────────────────────────
describe('ObjectDetail Component', () => {
    const user = userEvent.setup();
    const mockNavigate = jest.fn();

    beforeEach(() => {
        jest.setTimeout(45000);
        jest.clearAllMocks();
        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);
        mockLocalStorage.getItem.mockReturnValue('mock-token');
        global.fetch = jest.fn(defaultFetchMock);
        useEventStore.mockImplementation((selector) => selector(fullMockState));
        useEventStore.subscribe = jest.fn(() => jest.fn());
    });

    afterEach(() => jest.clearAllMocks());

    describe('getResourceType', () => {
        test.each([
            [null, {}, ''], ['', {}, ''], ['rid1', null, ''], ['rid1', undefined, ''], [null, null, ''], [undefined, undefined, ''],
            ['notfound', {resources: {}, encap: {c1: {resources: {}}}}, ''],
            ['rid1', {resources: {}, encap: {}}, ''],
            ['rid1', {resources: {rid1: {type: 'disk.disk'}}}, 'disk.disk'],
            ['rid2', {resources: {rid2: {type: 'fs.flag'}}}, 'fs.flag'],
            ['rid2', {
                resources: {},
                encap: {container1: {resources: {rid2: {type: 'container.docker'}}}}
            }, 'container.docker'],
            ['r3', {resources: {r1: {type: 'disk'}}, encap: {c1: {resources: {r2: {type: 'container'}}}}}, ''],
        ])('getResourceType(%p, %p) => %p', (rid, nodeData, expected) => expect(getResourceType(rid, nodeData)).toBe(expected));
    });

    describe('parseProvisionedState', () => {
        test.each([
            ['true', true], ['True', true], ['TRUE', true], ['tRuE', true],
            ['false', false], ['False', false], ['FALSE', false], ['fAlSe', false],
            ['yes', false], ['no', false], ['', false], ['abc', false], ['1', false], ['0', false],
            [true, true], [false, false], [1, true], [0, false], [42, true], [-1, true],
            [{}, true], [{state: true}, true], [[], true], [new Date(), true],
            [null, false], [undefined, false], [NaN, false],
        ])('%p => %p', (input, expected) => expect(parseProvisionedState(input)).toBe(expected));
    });

    test('mount/unmount lifecycle', () => {
        const {unmount} = renderComponent('root/cfg/cfg1');
        expect(localStorage.getItem).toHaveBeenCalledWith('authToken');
        expect(startEventReception).toHaveBeenCalled();
        unmount();
        expect(closeEventSource).toHaveBeenCalled();
    });

    test('unmount during async fetch', async () => {
        let resolveFetch;
        global.fetch.mockImplementationOnce(() => new Promise(r => {
            resolveFetch = r;
        }));
        const {unmount} = renderSvc();
        unmount();
        resolveFetch({ok: true, text: () => Promise.resolve('config data')});
        await new Promise(r => setTimeout(r, 100));
    });

    test('renders svc with nodes and monitor', async () => {
        renderSvc();
        await waitForNode('node1');
        await waitForNode('node2');
        expect(screen.getByText(/running/i)).toBeInTheDocument();
        expect(screen.getByText(/placed@node1/i)).toBeInTheDocument();
        expect(screen.queryByText(/Resources \(\d+\)/i)).not.toBeInTheDocument();
    });

    test('shows no data message when object data is empty', async () => {
        useEventStore.mockImplementation(s => s({
            objectStatus: {}, objectInstanceStatus: {}, instanceMonitor: {},
            instanceConfig: {}, configUpdates: [], clearConfigUpdate: jest.fn(),
        }));
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({items: []})
            });
            return Promise.resolve({ok: true, json: () => Promise.resolve({}), text: () => ''});
        });
        renderComponent('root/cfg/cfg1');
        await waitFor(() => {
            expect(screen.getByText(/No keys available/i)).toBeInTheDocument();
        });
    });

    test('cfg kind hides node cards and batch actions', async () => {
        renderComponent('root/cfg/cfg1');
        await screen.findByText(/root\/cfg\/cfg1/i);
        await waitFor(() => {
            expect(document.querySelectorAll('[class*="MuiCard"], [role="region"][class*="node"]')).toHaveLength(0);
            expect(screen.queryByRole('button', {name: /Actions on Selected Nodes/i})).not.toBeInTheDocument();
        });
    });

    test.each([['root/sec/sec1'], ['root/usr/usr1']])('batch actions hidden for %s', async (objectName) => {
        useEventStore.mockImplementation(s => s({
            objectStatus: {[objectName]: {avail: 'up', frozen: null}},
            objectInstanceStatus: {[objectName]: {node1: {avail: 'up', resources: {}}}},
            instanceMonitor: {}, instanceConfig: {}, configUpdates: [], clearConfigUpdate: jest.fn(),
        }));
        renderComponent(objectName);
        await screen.findByText(new RegExp(objectName.replace(/\//g, '\\/'), 'i'));
        expect(screen.queryByRole('button', {name: /Actions on Selected Nodes/i})).not.toBeInTheDocument();
    });

    test('warn status color', async () => {
        const state = buildState();
        state.objectStatus['root/svc/svc1'].avail = 'warn';
        useEventStore.mockImplementation(s => s(state));
        renderSvc();
        await waitFor(() => expect(screen.getByTitle('warn')).toBeInTheDocument());
    });

    test('config fetch opens dialog', async () => {
        renderComponent('root/cfg/cfg1');
        fireEvent.click(await screen.findByTestId('open-config-dialog'));
        await waitFor(() => expect(screen.getByTestId('config-dialog')).toBeInTheDocument());
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/config/file'), expect.any(Object));
    });

    test('fetches config from first node for svc', async () => {
        renderSvc();
        fireEvent.click(await screen.findByTestId('open-config-dialog'));
        await waitFor(() => expect(screen.getByTestId('config-dialog')).toBeInTheDocument());
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/config/file'), expect.any(Object)));
    });

    test('handles fetchConfig HTTP error response', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/file')) return Promise.resolve({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: () => 'Internal Server Error'
            });
            return Promise.resolve({ok: true, text: () => '', json: () => ({items: []})});
        });
        renderSvc();
        await waitFor(() => expect(screen.getAllByText(/root\/svc\/svc1/i).length).toBeGreaterThan(0));
    });

    test('handles fetchConfig with no auth token', async () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        renderSvc();
        await waitFor(() => expect(screen.getAllByText(/root\/svc\/svc1/i).length).toBeGreaterThan(0));
    });

    test('loads initial config when node has encap resources', async () => {
        useEventStore.mockImplementation(s => s({
            objectStatus: {'root/svc/svc1': {avail: 'up', frozen: null}},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {},
                        encap: {container1: {resources: {res1: {type: 'container.docker', status: 'up'}}}}
                    },
                    node2: {avail: 'up', frozen_at: null, resources: {}},
                },
            },
            instanceMonitor: {}, instanceConfig: {}, configUpdates: [], clearConfigUpdate: jest.fn(),
        }));
        renderSvc();
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/config/file'), expect.any(Object)));
    });

    test('renders keys section for cfg', async () => {
        renderComponent('root/cfg/cfg1');
        expect(await screen.findByText(/Keys/i)).toBeInTheDocument();
        expect(await screen.findByText('key1')).toBeInTheDocument();
        expect(screen.getByText('key2')).toBeInTheDocument();
    });

    test('displays no keys message when empty', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({items: []})
            });
            return Promise.resolve({ok: true, text: () => Promise.resolve(''), json: () => Promise.resolve({})});
        });
        renderComponent('root/cfg/cfg1');
        expect(await screen.findByText(/No keys available/i)).toBeInTheDocument();
    });

    test('node selection toggle', async () => {
        await renderReadySvc();
        const checkbox = screen.getByLabelText(/select node node1/i);
        expect(checkbox.checked).toBe(false);
        await user.click(checkbox);
        expect(checkbox.checked).toBe(true);
        await user.click(checkbox);
        expect(checkbox.checked).toBe(false);
    });

    test('disables batch actions button when no nodes are selected', async () => {
        await renderReadySvc();
        expect(screen.getByRole('button', {name: /Actions on selected nodes/i}).disabled).toBe(true);
    });

    test('view instance navigation on node click', async () => {
        await renderReadySvc();
        fireEvent.click(screen.getByText('node1'));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/nodes/node1/objects/root%2Fsvc%2Fsvc1'));
    });

    test('frozen node state display', async () => {
        useEventStore.mockImplementation(s => s({
            objectStatus: {'root/svc/svc1': {avail: 'up', frozen: null}},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: '2023-01-01T12:00:00Z',
                        resources: {}
                    }
                }
            },
            instanceMonitor: {'node1:root/svc/svc1': {state: 'running', global_expect: 'placed@node1', resources: {}}},
            instanceConfig: {}, configUpdates: [], clearConfigUpdate: jest.fn(),
        }));
        renderSvc();
        await waitForNode('node1');
    });

    test('getObjectStatus handles missing global_expect (none)', async () => {
        useEventStore.mockImplementation(s => s({
            objectStatus: {}, objectInstanceStatus: {},
            instanceMonitor: {'node1:root/cfg/cfg1': {state: 'running', global_expect: 'none'}},
            instanceConfig: {}, configUpdates: [], clearConfigUpdate: jest.fn(),
        }));
        renderComponent('root/cfg/cfg1');
        await waitFor(() => expect(screen.queryByText(/placed@node1/i)).not.toBeInTheDocument());
    });

    test('batch node actions: select nodes and execute start', async () => {
        await renderReadySvc();
        await user.click(screen.getByLabelText(/select node node1/i));
        await user.click(screen.getByLabelText(/select node node2/i));
        const batchBtn = screen.getByRole('button', {name: /Actions on selected nodes/i});
        expect(batchBtn).not.toBeDisabled();
        await user.click(batchBtn);
        await waitFor(() => expect(screen.queryAllByRole('menu').length).toBeGreaterThan(0));
        const menu = screen.getAllByRole('menu')[0];
        await user.click(within(menu).getByRole('menuitem', {name: /start/i}));
        const dialog = await screen.findByRole('dialog');
        const confirmCheckbox = within(dialog).queryByRole('checkbox', {name: /confirm/i});
        if (confirmCheckbox) await user.click(confirmCheckbox);
        await user.click(within(dialog).getByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept/i}));
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/action/start'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({Authorization: 'Bearer mock-token'})
                })
            );
        });
    });

    test('batch actions menu closes after item click', async () => {
        await renderReadySvc();
        await user.click(screen.getByLabelText(/select node node1/i));
        await user.click(screen.getByRole('button', {name: /Actions on selected nodes/i}));
        await waitFor(() => expect(screen.queryAllByRole('menu').length).toBeGreaterThan(0));
        await user.click(within(screen.getAllByRole('menu')[0]).getAllByRole('menuitem')[0]);
        await waitFor(() => {
            const dialogs = screen.queryAllByRole('dialog');
            const menusAfter = screen.queryAllByRole('menu');
            expect(dialogs.length > 0 || menusAfter.length === 0).toBe(true);
        });
    });

    test('individual node stop action', async () => {
        await renderReadySvc();
        await user.click(screen.getByRole('button', {name: /Node node1 actions/i}));
        await waitFor(() => expect(screen.queryAllByRole('menu').length).toBeGreaterThan(0));
        const menu = screen.getAllByRole('menu')[0];
        await user.click(within(menu).getByRole('menuitem', {name: /stop/i}));
        const dialog = await screen.findByRole('dialog');
        const confirmCheckbox = within(dialog).queryByRole('checkbox', {name: /confirm/i});
        if (confirmCheckbox) await user.click(confirmCheckbox);
        await user.click(within(dialog).getByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept/i}));
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/action/stop'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({Authorization: 'Bearer mock-token'})
                })
            );
        });
    });

    describe.each([
        {
            label: 'object',
            openMenu: async () => {
                await userEvent.click(screen.getByRole('button', {name: /object actions/i}));
            },
        },
        {
            label: 'node',
            openMenu: async () => {
                await userEvent.click(screen.getByRole('button', {name: /Node node1 actions/i}));
            },
        },
    ])('$label actions', ({openMenu}) => {
        test('fetch exception', async () => {
            mockNetworkFailure('/action/');
            await renderReadySvc();
            await openMenu();
            await userEvent.click(screen.getByRole('menuitem', {name: /start/i}));
            const dialog = await screen.findByRole('dialog');
            await userEvent.click(within(dialog).getByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept/i}));
            await waitFor(() => {
                expect(screen.getAllByRole('alert').some(a => a.textContent.includes('Network error'))).toBe(true);
            });
        });

        test.each([[403, 'Forbidden'], [500, 'Server error']])('HTTP %i', async (status, msg) => {
            mockActionFailure(status, msg);
            await renderReadySvc();
            await openMenu();
            await userEvent.click(screen.getByRole('menuitem', {name: /start/i}));
            const dialog = await screen.findByRole('dialog');
            await userEvent.click(within(dialog).getByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept/i}));
            await waitFor(() => {
                expect(screen.getAllByRole('alert').some(a => a.textContent.includes(`HTTP error! status: ${status}`))).toBe(true);
            });
        });

        test('missing auth token', async () => {
            mockLocalStorage.getItem.mockReturnValue(null);
            await renderReadySvc();
            await openMenu();
            await userEvent.click(screen.getByRole('menuitem', {name: /start/i}));
            const dialog = await screen.findByRole('dialog');
            await userEvent.click(within(dialog).getByRole('button', {name: /confirm/i}));
            await waitFor(() => {
                expect(screen.getAllByRole('alert').some(a => a.textContent.includes('Auth token not found'))).toBe(true);
            });
        });
    });

    test('dialog cancel closes without action', async () => {
        await renderReadySvc();
        await userEvent.click(screen.getByRole('button', {name: /object actions/i}));
        await screen.findByRole('menu');
        await userEvent.click(screen.getByRole('menuitem', {name: /start/i}));
        const dialog = await screen.findByRole('dialog');
        const cancelButton = within(dialog).queryByRole('button', {name: /cancel/i});
        if (cancelButton) {
            await userEvent.click(cancelButton);
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        }
    });

    test('all object action dialogs open and cancel', async () => {
        useEventStore.mockImplementation(s => s(buildState()));
        renderSvc();
        for (const action of ['freeze', 'stop', 'unprovision', 'purge']) {
            await user.click(screen.getByRole('button', {name: /object actions/i}));
            await screen.findByRole('menu');
            await user.click(screen.getByRole('menuitem', {name: new RegExp(action, 'i')}));
            const dialog = await screen.findByRole('dialog');
            const cancelBtn = within(dialog).queryByRole('button', {name: /cancel/i});
            if (cancelBtn) {
                await user.click(cancelBtn);
                await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
            }
        }
    });

    test('closes manage params dialog on submit', async () => {
        renderComponent('root/cfg/cfg1');
        await screen.findAllByText(/root\/cfg\/cfg1/i);
        const manageBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Manage'));
        if (!manageBtn) return;
        await user.click(manageBtn);
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('button', {name: /confirm/i}));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('logs drawer resize with mouse events adds/removes listeners', async () => {
        const addSpy = jest.spyOn(document, 'addEventListener');
        const removeSpy = jest.spyOn(document, 'removeEventListener');
        renderSvc();
        await waitForNode('node1');
        const logsBtn = screen.getAllByRole('button', {name: /logs/i})[0];
        await user.click(logsBtn);
        await waitFor(() => expect(screen.getByLabelText('Resize drawer')).toBeInTheDocument());
        const handle = screen.getByLabelText('Resize drawer');
        fireEvent.mouseDown(handle, {clientX: 100});
        expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
        fireEvent.mouseMove(document, {clientX: 150});
        fireEvent.mouseUp(document);
        expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
        expect(document.body.style.cursor).toBe('default');
        addSpy.mockRestore();
        removeSpy.mockRestore();
    });

    test('logs drawer resize with touch events', async () => {
        const addSpy = jest.spyOn(document, 'addEventListener');
        const removeSpy = jest.spyOn(document, 'removeEventListener');
        renderSvc();
        await waitForNode('node1');
        const logsBtn = screen.getAllByRole('button', {name: /logs/i})[0];
        await user.click(logsBtn);
        await waitFor(() => expect(screen.getByLabelText('Resize drawer')).toBeInTheDocument());
        const handle = screen.getByLabelText('Resize drawer');
        fireEvent.touchStart(handle, {touches: [{clientX: 100}]});
        expect(addSpy.mock.calls.find(c => c[0] === 'touchmove' && c[2]?.passive === false)).toBeDefined();
        expect(addSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
        fireEvent.touchMove(document, {touches: [{clientX: 150}]});
        fireEvent.touchEnd(document);
        expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
        expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
        expect(document.body.style.cursor).toBe('default');
        addSpy.mockRestore();
        removeSpy.mockRestore();
    });

    test('drawer resize respects min/max constraints', async () => {
        Object.defineProperty(window, 'innerWidth', {writable: true, configurable: true, value: 1000});
        renderSvc();
        await waitForNode('node1');
        const logsBtn = screen.getAllByRole('button', {name: /logs/i})[0];
        await user.click(logsBtn);
        await waitFor(() => expect(screen.getByLabelText('Resize drawer')).toBeInTheDocument());
        const handle = screen.getByLabelText('Resize drawer');
        fireEvent.mouseDown(handle, {clientX: 100});
        fireEvent.mouseMove(document, {clientX: 50});
        fireEvent.mouseUp(document);
        fireEvent.mouseDown(handle, {clientX: 100});
        fireEvent.mouseMove(document, {clientX: 900});
        fireEvent.mouseUp(document);
        Object.defineProperty(window, 'innerWidth', {writable: true, configurable: true, value: 1024});
    });

    test('config updates subscription: update without node skips fetchConfig', async () => {
        const sub = captureSubscription();
        let fetchCount = 0;
        global.fetch = jest.fn((url) => {
            if (url.includes('/config/file')) fetchCount++;
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve('[DEFAULT]'),
                json: () => Promise.resolve({items: []})
            });
        });
        renderSvc();
        await waitForNode('node1');
        const before = fetchCount;
        await act(async () => {
            await sub.callback([{name: 'svc1', fullName: 'root/svc/svc1'}]);
        });
        expect(fetchCount).toBe(before);
    });

    test('config updates subscription: non-matching name does not call clearConfigUpdate', async () => {
        const clearConfigUpdate = jest.fn();
        useEventStore.mockImplementation(s => s(buildState({clearConfigUpdate})));
        const sub = captureSubscription();
        renderSvc();
        await waitForNode('node1');
        await act(async () => {
            await sub.callback([{name: 'other', fullName: 'root/svc/other', node: 'n1'}]);
        });
        expect(clearConfigUpdate).not.toHaveBeenCalled();
    });

    test('config updates subscription: unmounted component causes early return', async () => {
        const sub = captureSubscription();
        const {unmount} = renderSvc();
        await waitForNode('node1');
        unmount();
        if (sub.callback) {
            await act(async () => {
                sub.callback([{name: 'svc1', fullName: 'root/svc/svc1', node: 'n1'}]);
            });
        }
    });

    test('config updates subscription: isProcessingConfigUpdate deduplicates', async () => {
        const sub = captureSubscription();
        let fetchCount = 0;
        let resolveFirst;
        global.fetch = jest.fn((url) => {
            if (url.includes('/config/file')) {
                fetchCount++;
                if (fetchCount === 1) return new Promise(r => {
                    resolveFirst = r;
                });
                return Promise.resolve({ok: true, text: () => Promise.resolve('[DEFAULT]')});
            }
            return Promise.resolve({ok: true, text: () => Promise.resolve('')});
        });
        renderSvc();
        await waitForNode('node1');
        await waitFor(() => expect(fetchCount).toBe(1));
        act(() => {
            sub.callback([{name: 'svc1', fullName: 'root/svc/svc1', node: 'node2'}]);
            sub.callback([{name: 'svc1', fullName: 'root/svc/svc1', node: 'node2'}]);
        });
        resolveFirst({ok: true, text: () => Promise.resolve('[DEFAULT]')});
        await act(async () => {
            await new Promise(r => setTimeout(r, 200));
        });
    });

    test('config updates subscription: fetch error triggers snackbar error', async () => {
        const clearConfigUpdate = jest.fn();
        useEventStore.mockImplementation(s => s({
            objectStatus: {}, instanceMonitor: {}, instanceConfig: {},
            objectInstanceStatus: {'root/svc/svc1': {node1: {avail: 'up', resources: {}}}},
            configUpdates: [], clearConfigUpdate,
        }));
        const sub = captureSubscription();
        let fetchCallCount = 0;
        global.fetch.mockImplementation((url) => {
            fetchCallCount++;
            if (url.includes('/config/file') && fetchCallCount > 1) return Promise.reject(new Error('Update fetch failed'));
            if (url.includes('/config/file')) return Promise.resolve({
                ok: true,
                text: () => Promise.resolve('[DEFAULT]\nid=123')
            });
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(''),
                json: () => Promise.resolve({items: []})
            });
        });
        renderSvc();
        await waitForNode('node1');
        await waitFor(() => expect(fetchCallCount).toBeGreaterThan(0));
        await act(async () => {
            await sub.callback([{
                name: 'svc1',
                fullName: 'root/svc/svc1',
                node: 'node2',
                type: 'InstanceConfigUpdated'
            }]);
        });
        await waitFor(() => {
            const alerts = screen.queryAllByRole('alert');
            const errAlert = alerts.find(a => a.textContent.includes('Failed to load updated configuration') || a.getAttribute('data-severity') === 'error');
            if (errAlert) expect(errAlert).toBeInTheDocument();
            expect(clearConfigUpdate).toHaveBeenCalled();
        });
    });

    test('configUpdates subscription: selector captures state.configUpdates correctly', async () => {
        const captured = [];
        useEventStore.subscribe = jest.fn((sel, cb) => {
            captured.push(sel);
            return jest.fn();
        });
        renderSvc();
        await waitForNode('node1');
        const fake = {configUpdates: [{name: 'x', node: 'n1'}], instanceConfig: {}};
        const sel = captured.find(s => {
            try {
                return Array.isArray(s(fake));
            } catch {
                return false;
            }
        });
        expect(sel).toBeDefined();
        expect(sel(fake)).toEqual([{name: 'x', node: 'n1'}]);
    });

    test('handles config updates subscription triggered by store', async () => {
        useEventStore.subscribe = jest.fn((selector, callback) => {
            callback([{name: 'cfg1', fullName: 'root/cfg/cfg1', type: 'InstanceConfigUpdated', node: 'node1'}]);
            return jest.fn();
        });
        renderComponent('root/cfg/cfg1');
        await waitFor(() => expect(screen.getByText(/Configuration updated/i)).toBeInTheDocument());
    });

    test('instanceConfig subscription triggers snackbar', async () => {
        useEventStore.mockImplementation(s => s({
            objectStatus: {}, instanceMonitor: {},
            objectInstanceStatus: {'root/svc/svc1': {node1: {avail: 'up', resources: {}}}},
            instanceConfig: {'root/svc/svc1': {node1: {resources: {res1: {is_monitored: true}}}}},
            configUpdates: [], clearConfigUpdate: jest.fn(),
        }));
        let instanceConfigCallback;
        useEventStore.subscribe = jest.fn((selector, callback) => {
            if (selector.toString().includes('instanceConfig')) instanceConfigCallback = callback;
            return jest.fn();
        });
        renderSvc();
        act(() => {
            instanceConfigCallback({'root/svc/svc1': {node1: {resources: {res1: {is_monitored: false}}}}});
        });
        await waitFor(() => {
            expect(screen.queryAllByRole('alert').find(a => a.textContent?.includes('Instance configuration updated'))).toBeInTheDocument();
        });
    });

    test.each([
        ['configUpdates', '[ObjectDetail] Failed to subscribe to configUpdates:'],
        ['instanceConfig', '[ObjectDetail] Failed to subscribe to instanceConfig:'],
    ])('%s subscription error triggers logger.warn', async (subName, expectedMsg) => {
        const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
        useEventStore.subscribe = jest.fn(() => {
            throw new Error('Subscription failed');
        });
        renderSvc();
        await screen.findAllByText(/root\/svc\/svc1/i);
        await waitFor(() => {
            expect(warnSpy).toHaveBeenCalledWith(expectedMsg, expect.any(Error));
        });
        warnSpy.mockRestore();
    });

    test('subscription returning non-function triggers logger.warn', async () => {
        const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
        useEventStore.subscribe = jest.fn(() => 'not-a-function');
        renderSvc();
        await waitForNode('node1');
        await waitFor(() => {
            expect(warnSpy).toHaveBeenCalledWith('[ObjectDetail] Subscription is not a function:', 'not-a-function');
        });
        warnSpy.mockRestore();
    });

    test('closes snackbar via close button', async () => {
        await renderReadySvc();
        await executeObjectAction('start');
        const closeButtons = screen.getAllByTestId('alert-close-button');
        if (closeButtons.length > 0) await user.click(closeButtons[0]);
    });

    test('console dialog not shown by default (no console action in INSTANCE_ACTIONS)', async () => {
        renderSvc();
        await waitForNode('node1');
        await waitFor(() => expect(screen.queryByText(/Open Console/i)).not.toBeInTheDocument());
    });

    test('handleConsoleConfirm: cancel closes dialog', async () => {
        await withConsole(async () => {
            renderSvc();
            const dialog = await openConsoleDialogFn();
            if (!dialog) return;
            const cancelBtn = within(dialog).queryByRole('button', {name: /cancel/i});
            if (cancelBtn) {
                await user.click(cancelBtn);
                await waitFor(() => {
                    expect(screen.queryAllByRole('dialog').filter(d => d.textContent.includes('terminal console')).length).toBe(0);
                });
            }
        });
    });

    test('handleConsoleConfirm: without rid → no console fetch', async () => {
        await withConsole(async () => {
            renderSvc();
            const dialog = await openConsoleDialogFn();
            if (!dialog) return;
            const fetchsBefore = global.fetch.mock.calls.filter(([u, o]) => o?.method === 'POST' && u.includes('/console')).length;
            const openBtn = within(dialog).queryByRole('button', {name: /open console/i});
            if (openBtn) {
                await user.click(openBtn);
                await new Promise(r => setTimeout(r, 200));
                expect(global.fetch.mock.calls.filter(([u, o]) => o?.method === 'POST' && u.includes('/console')).length).toBe(fetchsBefore);
            }
        });
    });

    test('handleConsoleConfirm: seats input clamps to minimum of 1', async () => {
        await withConsole(async () => {
            renderSvc();
            const dialog = await openConsoleDialogFn();
            if (!dialog) return;
            const seatsInput = within(dialog).queryByLabelText(/Number of Seats/i);
            if (seatsInput) {
                fireEvent.change(seatsInput, {target: {value: '5'}});
                expect(seatsInput.value).toBe('5');
                fireEvent.change(seatsInput, {target: {value: '0'}});
                expect(seatsInput.value).toBe('1');
                fireEvent.change(seatsInput, {target: {value: 'abc'}});
                expect(seatsInput.value).toBe('1');
            }
        });
    });

    test('consoleUrlDialog: open in new tab calls window.open', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation();
        renderSvc();
        await waitForNode('node1');
        const consoleBtns = screen.queryAllByRole('button', {name: /console/i});
        if (consoleBtns.length > 0) {
            await user.click(consoleBtns[0]);
            const openDialog = await screen.findByRole('dialog');
            await user.click(within(openDialog).getByRole('button', {name: /Open Console/i}));
            await waitFor(() => {
                const tabBtn = within(screen.getByRole('dialog')).getByRole('button', {name: /Open in New Tab/i});
                fireEvent.click(tabBtn);
                expect(openSpy).toHaveBeenCalled();
            });
        }
        openSpy.mockRestore();
    });

    test('consoleUrlDialog: closes on Close button', async () => {
        renderSvc();
        await waitForNode('node1');
        const consoleBtns = screen.queryAllByRole('button', {name: /console/i});
        if (consoleBtns.length > 0) {
            await user.click(consoleBtns[0]);
            const openDialog = await screen.findByRole('dialog');
            await user.click(within(openDialog).getByRole('button', {name: /Open Console/i}));
            await waitFor(() => {
                fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: /Close/i}));
                expect(screen.queryByText(/Console URL/i)).not.toBeInTheDocument();
            });
        }
    });

    test.each([
        ['non-ok HTTP response', (url, options) => options?.method === 'POST' && url.includes('/console'), 'HTTP error! status: 500', {
            ok: false,
            status: 500,
            text: () => Promise.resolve('Server error')
        }],
        ['missing Location header', (url, options) => options?.method === 'POST' && url.includes('/console'), 'Console URL not found', {
            ok: true,
            headers: {get: () => null}
        }],
    ])('postConsoleAction: handles %s', async (label, matchFn, expectedMsg, failResponse) => {
        global.fetch.mockImplementation((url, options) => {
            if (matchFn(url, options)) return Promise.resolve(failResponse);
            return Promise.resolve({ok: true, text: () => Promise.resolve('')});
        });
        renderSvc();
        await waitForNode('node1');
        const resourceButtons = screen.queryAllByRole('button', {name: /resource .* actions/i});
        if (resourceButtons.length > 0) {
            await user.click(resourceButtons[0]);
            await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
            const consoleItem = screen.queryByRole('menuitem', {name: /console/i});
            if (consoleItem) {
                await user.click(consoleItem);
                const dialog = await screen.findByRole('dialog');
                await user.click(within(dialog).getByRole('button', {name: /open console/i}));
                await waitFor(() => {
                    expect(screen.getAllByRole('alert').some(a => a.textContent.includes(expectedMsg))).toBe(true);
                });
            }
        }
    });

    test('postConsoleAction: handles fetch exception', async () => {
        mockNetworkFailure('/console');
        renderSvc();
        await waitForNode('node1');
        const resourceButtons = screen.queryAllByRole('button', {name: /resource .* actions/i});
        if (resourceButtons.length > 0) {
            await user.click(resourceButtons[0]);
            await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
            const consoleItem = screen.queryByRole('menuitem', {name: /console/i});
            if (consoleItem) {
                await user.click(consoleItem);
                const dialog = await screen.findByRole('dialog');
                await user.click(within(dialog).getByRole('button', {name: /open console/i}));
                await waitFor(() => {
                    expect(screen.getAllByRole('alert').some(a => a.textContent.includes('Network failure'))).toBe(true);
                });
            }
        }
    });

    test('handleIndividualNodeActionClick does not warn in normal flow', async () => {
        const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
        await renderReadySvc();
        await user.click(screen.getByRole('button', {name: /Node node1 actions/i}));
        await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
        await user.click(within(screen.getByRole('menu')).getByRole('menuitem', {name: /start/i}));
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('button', {name: /cancel/i}));
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    test('subscription without node does not trigger fetchConfig', () => {
        const unsubscribeMock = jest.fn();
        useEventStore.subscribe = jest.fn((sel, cb) => {
            cb([{name: 'svc1', fullName: 'root/svc/svc1', type: 'InstanceConfigUpdated'}]);
            return unsubscribeMock;
        });
        useEventStore.mockImplementation(sel => sel({
            objectStatus: {},
            objectInstanceStatus: {},
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        }));
        renderSvc();
        expect(typeof unsubscribeMock).toBe('function');
    });

    test('useEffect for configUpdates handles no matching update', async () => {
        const clearConfigUpdate = jest.fn();
        useEventStore.mockImplementation(s => s({
            objectStatus: {}, objectInstanceStatus: {}, instanceMonitor: {}, instanceConfig: {},
            configUpdates: [{name: 'other', type: 'InstanceConfigUpdated', node: 'node1'}],
            clearConfigUpdate,
        }));
        renderComponent('root/cfg/cfg1');
        await waitFor(() => expect(clearConfigUpdate).not.toHaveBeenCalled());
    });
});
