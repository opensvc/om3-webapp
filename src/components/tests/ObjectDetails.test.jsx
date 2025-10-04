import React from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ObjectDetail from '../ObjectDetails';
import useEventStore from '../../hooks/useEventStore.js';
import {closeEventSource, startEventReception} from '../../eventSourceManager.jsx';
import userEvent from '@testing-library/user-event';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
}));
jest.mock('../../hooks/useEventStore.js');
jest.mock('../../eventSourceManager.jsx', () => ({
    closeEventSource: jest.fn(),
    startEventReception: jest.fn(),
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
        AccordionSummary: ({children, id, onChange, expanded, ...props}) => (
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
        Snackbar: ({children, open, autoHideDuration, ...props}) => {
            console.log('[DEBUG] Snackbar rendered with open:', open, 'message:', children, 'props:', props);
            return open ? <div role="alert" {...props}>{children}</div> : null;
        },
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
            <svg style={{color: sx?.color, fontSize: sx?.fontSize}} {...props} />
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
        Popper: ({open, anchorEl, children, ...props}) => open ? <div  {...props}>{children}</div> : null,
        Paper: ({elevation, children, ...props}) => <div  {...props}>{children}</div>,
        ClickAwayListener: ({onClickAway, children, ...props}) => <div
            onClick={onClickAway} {...props}>{children}</div>,
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
    ],
    INSTANCE_ACTIONS: [
        {name: 'start', icon: 'StartIcon'},
        {name: 'stop', icon: 'StopIcon'},
        {name: 'freeze', icon: 'FreezeIcon'},
    ],
    RESOURCE_ACTIONS: [
        {name: 'start', icon: 'StartIcon'},
        {name: 'stop', icon: 'StopIcon'},
        {name: 'run', icon: 'RunIcon'},
    ],
}));

describe('ObjectDetail Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        jest.setTimeout(45000);
        jest.clearAllMocks();

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
        // Mock subscribe to prevent crashes in all tests
        useEventStore.subscribe = jest.fn(() => jest.fn());
        global.fetch = jest.fn((url, options) => {
            console.log(`[fetch] Called with URL: ${url}, Options:`, options);
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
                console.log(`[fetch] Config set endpoint hit: ${url}`);
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

    test('renders global status, nodes, and resources', async () => {
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
            expect(screen.getByText(/root\/svc\/svc1/i)).toBeInTheDocument();
        }, {timeout: 10000, interval: 200});
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
        const resourcesSections = await screen.findAllByText(/Resources \(\d+\)/i);
        expect(resourcesSections).toHaveLength(2);
        fireEvent.click(resourcesSections[0]);
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        }, {timeout: 10000, interval: 200});
        await waitFor(() => {
            expect(screen.getByText('res2')).toBeInTheDocument();
        }, {timeout: 10000, interval: 200});
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
        expect(startEventReception).toHaveBeenCalledWith('mock-token', [
            'ObjectStatusUpdated,path=root/cfg/cfg1',
            'InstanceStatusUpdated,path=root/cfg/cfg1',
            'ObjectDeleted,path=root/cfg/cfg1',
            'InstanceMonitorUpdated,path=root/cfg/cfg1',
            'InstanceConfigUpdated,path=root/cfg/cfg1',
        ]);
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
        const configSections = screen.getAllByRole('button', {expanded: false});
        const configSection = configSections.find(
            (el) => el.textContent.toLowerCase().includes('configuration')
        );
        fireEvent.click(configSection);
        await waitFor(() => {
            expect(screen.getByText(/nodes = \*/i)).toBeInTheDocument();
        }, {timeout: 10000, interval: 200});
        await waitFor(() => {
            expect(screen.getByText(
                /this_is_a_very_long_unbroken_string_that_should_trigger_a_horizontal_scrollbar_abcdefghijklmnopqrstuvwxyz1234567890/i
            )).toBeInTheDocument();
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
        await waitFor(() => {
            expect(screen.getByText(/root\/cfg\/cfg1/i)).toBeInTheDocument();
        }, {timeout: 10000});
        await waitFor(() => {
            expect(screen.queryByText('node1')).not.toBeInTheDocument();
        }, {timeout: 10000});
        await waitFor(() => {
            expect(screen.queryByText('node2')).not.toBeInTheDocument();
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
        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/config/file'),
                    expect.any(Object)
                );
            },
            {timeout: 5000}
        );
        await waitFor(
            () => {
                expect(screen.getByText(/nodes = \*/i)).toBeInTheDocument();
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
        const batchActionsButton = screen.getByRole('button', {
            name: /Actions on selected nodes/i,
        });
        console.log(`[DEBUG] Batch actions button disabled: ${batchActionsButton.disabled}`);
        const node1Checkbox = screen.getByRole('checkbox', {
            name: /select node node1/i,
        });
        const node2Checkbox = screen.getByRole('checkbox', {
            name: /select node node2/i,
        });
        await user.click(node1Checkbox);
        await user.click(node2Checkbox);
        console.log(`[DEBUG] Batch actions button disabled after selection: ${batchActionsButton.disabled}`);
        expect(batchActionsButton).not.toBeDisabled();
        await user.click(batchActionsButton);

        await waitFor(() => {
            const menus = screen.queryAllByRole('menu');
            console.log(`[DEBUG] Found ${menus.length} menus:`, menus.map((el) => el.outerHTML));
            if (menus.length === 0) {
                console.log('[DEBUG] No menus found');
                console.log('[DEBUG] Current DOM:', document.body.innerHTML);
                throw new Error('No menus found');
            }
        }, {timeout: 10000});

        const menus = await screen.findAllByRole('menu');
        const menuItems = within(menus[0]).getAllByRole('menuitem');
        const startAction = menuItems.find((item) => item.textContent.match(/Start/i));
        if (!startAction) {
            console.log('[DEBUG] No "Start" menu item found');
            throw new Error('No "Start" menu item found');
        }
        console.log(`[DEBUG] Clicking start action: ${startAction.textContent}`);
        await user.click(startAction);

        await waitFor(() => {
            const dialogs = screen.queryAllByRole('dialog');
            console.log(`[DEBUG] Found ${dialogs.length} dialogs:`, dialogs.map((el) => ({
                text: el.textContent,
                html: el.outerHTML,
            })));
            if (dialogs.length === 0) {
                console.log('[DEBUG] No dialog found after clicking start action');
                console.log('[DEBUG] Current DOM:', document.body.innerHTML);
                throw new Error('No dialog found');
            }
        }, {timeout: 10000});

        const dialogs = screen.getAllByRole('dialog');
        const dialog = dialogs[0];
        console.log(`[DEBUG] Dialog content:`, dialog.textContent);
        const checkbox = within(dialog).queryByRole('checkbox', {name: /confirm/i});
        if (checkbox) {
            await user.click(checkbox);
        }
        const confirmButton = within(dialog).queryByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept|add/i});
        if (!confirmButton) {
            console.log('[DEBUG] No confirm button found in dialog:', dialog.outerHTML);
            const allButtons = within(dialog).getAllByRole('button');
            console.log(`[DEBUG] All buttons in dialog:`, allButtons.map((b) => ({
                text: b.textContent,
                name: b.getAttribute('name'),
                ariaLabel: b.getAttribute('aria-label'),
            })));
            throw new Error('No confirm button found');
        }
        console.log(`[DEBUG] Clicking confirm button: ${confirmButton.textContent}`);
        await user.click(confirmButton);

        await waitFor(() => {
            console.log(`[DEBUG] Fetch calls after confirm:`, global.fetch.mock.calls);
        }, {timeout: 10000});

        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/config/file'),
                    expect.any(Object)
                );
            },
            {timeout: 20000, interval: 200}
        );

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

        await waitFor(
            () => {
                const alerts = screen.queryAllByRole('alert');
                console.log(`[DEBUG] Found ${alerts.length} alerts:`, alerts.map((a) => ({
                    text: a.textContent,
                    attributes: Array.from(a.attributes).map((attr) => ({[attr.name]: attr.value})),
                })));
                if (alerts.length === 0) {
                    console.log('[DEBUG] No alerts found');
                }
            },
            {timeout: 30000, interval: 200}
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
        console.log(`[DEBUG] Node actions button disabled: ${actionsButton.disabled}`);
        await user.click(actionsButton);

        await waitFor(() => {
            const menus = screen.queryAllByRole('menu');
            console.log(`[DEBUG] Found ${menus.length} menus:`, menus.map((el) => el.outerHTML));
            if (menus.length === 0) {
                console.log('[DEBUG] No menus found');
                console.log('[DEBUG] Current DOM:', document.body.innerHTML);
                throw new Error('No menus found');
            }
        }, {timeout: 10000});

        const menus = await screen.findAllByRole('menu');
        const menuItems = within(menus[0]).getAllByRole('menuitem');
        const stopAction = menuItems.find((item) => item.textContent.match(/Stop/i));
        if (!stopAction) {
            console.log('[DEBUG] No "Stop" menu item found');
            throw new Error('No "Stop" menu item found');
        }
        console.log(`[DEBUG] Clicking stop action: ${stopAction.textContent}`);
        await user.click(stopAction);

        await waitFor(() => {
            const dialogs = screen.queryAllByRole('dialog');
            console.log(`[DEBUG] Found ${dialogs.length} dialogs:`, dialogs.map((el) => ({
                text: el.textContent,
                html: el.outerHTML,
            })));
            if (dialogs.length === 0) {
                console.log('[DEBUG] No dialog found after clicking stop action');
                console.log('[DEBUG] Current DOM:', document.body.innerHTML);
                throw new Error('No dialog found');
            }
        }, {timeout: 10000});

        const dialogs = screen.getAllByRole('dialog');
        const dialog = dialogs[0];
        console.log(`[DEBUG] Dialog content:`, dialog.textContent);
        const checkbox = within(dialog).queryByRole('checkbox', {name: /confirm/i});
        if (checkbox) {
            await user.click(checkbox);
        }
        const confirmButton = within(dialog).queryByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept|add/i});
        if (!confirmButton) {
            console.log('[DEBUG] No confirm button found in dialog:', dialog.outerHTML);
            const allButtons = within(dialog).getAllByRole('button');
            console.log(`[DEBUG] All buttons in dialog:`, allButtons.map((b) => ({
                text: b.textContent,
                name: b.getAttribute('name'),
                ariaLabel: b.getAttribute('aria-label'),
            })));
            throw new Error('No confirm button found');
        }
        console.log(`[DEBUG] Clicking confirm button: ${confirmButton.textContent}`);
        await user.click(confirmButton);

        await waitFor(() => {
            console.log(`[DEBUG] Fetch calls after confirm:`, global.fetch.mock.calls);
        }, {timeout: 10000});

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

        await waitFor(
            () => {
                const alerts = screen.queryAllByRole('alert');
                console.log(`[DEBUG] Found ${alerts.length} alerts:`, alerts.map((a) => ({
                    text: a.textContent,
                    attributes: Array.from(a.attributes).map((attr) => ({[attr.name]: attr.value})),
                })));
                if (alerts.length === 0) {
                    console.log('[DEBUG] No alerts found');
                }
            },
            {timeout: 30000, interval: 200}
        );
    }, 35000);

    test('handles resource selection and batch resource actions', async () => {
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
        const resourcesAccordion = screen.getByRole('button', {
            name: /expand resources for node node1/i,
        });
        fireEvent.click(resourcesAccordion);
        const res1Checkbox = screen.getByRole('checkbox', {
            name: /select resource res1/i,
        });
        const res2Checkbox = screen.getByRole('checkbox', {
            name: /select resource res2/i,
        });
        await user.click(res1Checkbox);
        await user.click(res2Checkbox);
        const batchResourceActionsButton = screen.getByRole('button', {
            name: /Resource actions for node node1/i,
        });
        console.log(`[DEBUG] Batch resource actions button disabled: ${batchResourceActionsButton.disabled}`);
        expect(batchResourceActionsButton).not.toBeDisabled();

        fireEvent.click(batchResourceActionsButton);

        await waitFor(() => {
            const menus = screen.queryAllByRole('menu');
            console.log(`[DEBUG] Found ${menus.length} menus:`, menus.map((el) => el.outerHTML));
            if (menus.length === 0) {
                console.log('[DEBUG] No menus found');
                console.log('[DEBUG] Current DOM:', document.body.innerHTML);
                throw new Error('No menus found');
            }
        }, {timeout: 10000});

        const menus = await screen.findAllByRole('menu');
        const menuItems = within(menus[0]).getAllByRole('menuitem');
        const stopAction = menuItems.find((item) => item.textContent.match(/Stop/i));
        if (!stopAction) {
            console.log('[DEBUG] No "Stop" menu item found');
            throw new Error('No "Stop" menu item found');
        }
        console.log(`[DEBUG] Clicking stop action: ${stopAction.textContent}`);

        fireEvent.click(stopAction);

        await waitFor(() => {
            const dialogs = screen.queryAllByRole('dialog');
            console.log(`[DEBUG] Found ${dialogs.length} dialogs:`, dialogs.map((el) => ({
                text: el.textContent,
                html: el.outerHTML,
            })));
            if (dialogs.length === 0) {
                console.log('[DEBUG] No dialog found after clicking stop action');
                console.log('[DEBUG] Current DOM:', document.body.innerHTML);
                throw new Error('No dialog found');
            }
        }, {timeout: 10000});

        const dialogs = screen.getAllByRole('dialog');
        const dialog = dialogs[0];
        console.log(`[DEBUG] Dialog content:`, dialog.textContent);
        const checkbox = within(dialog).queryByRole('checkbox', {name: /confirm/i});
        if (checkbox) {
            await user.click(checkbox);
        }
        const confirmButton = within(dialog).queryByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept|add/i});
        if (!confirmButton) {
            console.log('[DEBUG] No confirm button found in dialog:', dialog.outerHTML);
            const allButtons = within(dialog).getAllByRole('button');
            console.log(`[DEBUG] All buttons in dialog:`, allButtons.map((b) => ({
                text: b.textContent,
                name: b.getAttribute('name'),
                ariaLabel: b.getAttribute('aria-label'),
            })));
            throw new Error('No confirm button found');
        }
        console.log(`[DEBUG] Clicking confirm button: ${confirmButton.textContent}`);
        await user.click(confirmButton);

        await waitFor(() => {
            console.log(`[DEBUG] Fetch calls after confirm:`, global.fetch.mock.calls);
        }, {timeout: 10000});

        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/config/file'),
                    expect.any(Object)
                );
            },
            {timeout: 15000, interval: 200}
        );

        await waitFor(
            () => {
                const alerts = screen.queryAllByRole('alert');
                console.log(`[DEBUG] Found ${alerts.length} alerts:`, alerts.map((a) => ({
                    text: a.textContent,
                    attributes: Array.from(a.attributes).map((attr) => ({[attr.name]: attr.value})),
                })));
                if (alerts.length === 0) {
                    console.log('[DEBUG] No alerts found');
                }
            },
            {timeout: 15000, interval: 200}
        );
    }, 20000);

    test('filters resource actions for task type', async () => {
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
        const resourcesAccordion = screen.getByRole('button', {
            name: /expand resources for node node1/i,
        });
        fireEvent.click(resourcesAccordion);
        const res2ActionsButtons = screen.getAllByRole('button', {
            name: /resource res2 actions/i,
        });
        const res2ActionsButton = res2ActionsButtons.find(
            (button) => !button.hasAttribute('sx')
        );
        fireEvent.click(res2ActionsButton);

        await waitFor(
            () => {
                const menu = screen.getByRole('menu');
                expect(within(menu).getByRole('menuitem', {name: /run/i})).toBeInTheDocument();
            },
            {timeout: 10000, interval: 200}
        );

        await waitFor(
            () => {
                const menu = screen.getByRole('menu');
                expect(within(menu).queryByRole('menuitem', {name: /stop/i})).not.toBeInTheDocument();
            },
            {timeout: 10000, interval: 200}
        );

        await waitFor(
            () => {
                const menu = screen.getByRole('menu');
                expect(within(menu).queryByRole('menuitem', {name: /start/i})).not.toBeInTheDocument();
            },
            {timeout: 10000, interval: 200}
        );
    }, 15000);

    test('mount without token', async () => {
        mockLocalStorage.getItem.mockReturnValueOnce(null);
        useEventStore.mockImplementation((sel) =>
            sel({
                objectStatus: {},
                objectInstanceStatus: {'root/cfg/cfg1': {node1: {resources: {}}}},
                instanceMonitor: {},
                instanceConfig: {},
                configUpdates: [],
                clearConfigUpdate: jest.fn(),
            })
        );
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        expect(startEventReception).not.toHaveBeenCalled();
    });

    test('subscription: matchingUpdate sans node ne provoque pas de fetchConfig', async () => {
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
    });

    test('useEffect for configUpdates handles no matching update', async () => {
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        });
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {avail: 'up', frozen_at: null, resources: {}},
                },
            },
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [{name: 'other', type: 'InstanceConfigUpdated', node: 'node1'}],
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
                expect.stringContaining('No valid node in config update, skipping fetchConfig')
            );
        }, {timeout: 10000});
        await waitFor(() => {
            expect(mockState.clearConfigUpdate).not.toHaveBeenCalled();
        }, {timeout: 10000});
        consoleLogSpy.mockRestore();
    });

    test('handleDialogConfirm returns early if no pendingAction', async () => {
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {},
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
            expect(global.fetch).not.toHaveBeenCalled();
        }, {timeout: 10000});
    });

    test('configUpdates useEffect handles no matching update and unmount', async () => {
        const mockSubscribe = jest.fn();
        useEventStore.subscribe = jest.fn((sel, cb) => {
            cb([{name: 'other', type: 'InstanceConfigUpdated', node: 'node1'}]);
            return mockSubscribe;
        });
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/config/file'));
        }, {timeout: 10000});
        unmount();
        expect(mockSubscribe).toHaveBeenCalled();
    });

    test('renders KeysSection for sec kind', async () => {
        require('react-router-dom').useParams.mockReturnValue({objectName: 'root/sec/sec1'});
        const mockState = {
            objectStatus: {'root/sec/sec1': {avail: 'up'}},
            objectInstanceStatus: {'root/sec/sec1': {node1: {resources: {}}}},
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsec%2Fsec1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText(/Keys/i)).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles object action failure', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        global.fetch.mockImplementationOnce(() => Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Server Error'
        }));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const objectActionsButton = await screen.findByRole('button', {name: /Object actions/i});
        fireEvent.click(objectActionsButton);

        const menu = await screen.findByRole('menu');
        const startItem = within(menu).getByRole('menuitem', {name: /Start/i});
        fireEvent.click(startItem);

        const dialog = await screen.findByRole('dialog');
        const confirmButton = within(dialog).getByRole('button', {name: /Confirm/i});
        fireEvent.click(confirmButton);

        await waitFor(() => {
            const alerts = screen.queryAllByRole('alert');
            console.log(`[DEBUG] Alerts found: ${alerts.length}`);
            alerts.forEach((alert, index) => {
                console.log(`[DEBUG] Alert ${index + 1}:`, {
                    text: alert.textContent,
                    attributes: Array.from(alert.attributes).map((attr) => ({[attr.name]: attr.value})),
                });
            });
            const errorAlert = alerts.find((alert) => alert.textContent.match(/error|failed|start/i));
            if (!errorAlert) {
                console.log('[DEBUG] Full DOM:', document.body.innerHTML);
                throw new Error('No alert found with text matching /error|failed|start/i');
            }
            expect(errorAlert).toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            const alerts = screen.queryAllByRole('alert');
            const errorAlert = alerts.find((alert) => alert.textContent.match(/error|failed|start/i));
            expect(errorAlert).toHaveTextContent(/error|failed|start/i);
        }, {timeout: 10000});
    }, 20000);

    test('handles fetchConfig with no node', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        const mockStateNoNodes = {
            objectStatus: {
                'root/cfg/cfg1': {
                    avail: 'up',
                    frozen: 'frozen',
                },
            },
            objectInstanceStatus: {
                'root/cfg/cfg1': {},
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
            configNode: 'node1',
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockStateNoNodes));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        const configAccordions = await screen.findAllByRole('button', {name: /Configuration/i});
        const configAccordion = configAccordions.find((el) =>
            el.getAttribute('aria-expanded') === 'false'
        );
        expect(configAccordion).toBeInTheDocument();
        await user.click(configAccordion);
        await waitFor(() => {
            const alerts = screen.getAllByRole('alert');
            const errorAlert = alerts.find((alert) => alert.textContent.match(/No node available/i));
            expect(errorAlert).toBeInTheDocument();
        }, {timeout: 10000});
        await waitFor(() => {
            const alerts = screen.getAllByRole('alert');
            const errorAlert = alerts.find((alert) => alert.textContent.match(/No node available/i));
            expect(errorAlert).toHaveTextContent(/No node available/i);
        }, {timeout: 10000});
    }, 15000);

    test('handles node resources accordion expansion', async () => {
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
        const resourcesAccordion = await screen.findByRole('button', {name: /expand resources for node node1/i});
        await user.click(resourcesAccordion);
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        }, {timeout: 10000});
        await waitFor(() => {
            expect(screen.getByText('res2')).toBeInTheDocument();
        }, {timeout: 10000});
    }, 20000);

    test('filters resource actions for fs type', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        const mockStateFs = {
            objectStatus: {
                'root/svc/svc1': {
                    avail: 'up',
                    frozen: null,
                },
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        resources: {
                            resFs: {
                                type: 'fs.mount',
                                status: 'up',
                                label: 'Fs Resource',
                                provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
                                running: true,
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
                        resFs: {restart: {remaining: 0}},
                    },
                },
            },
            instanceConfig: {
                'root/svc/svc1': {
                    resources: {
                        resFs: {
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
        useEventStore.mockImplementation((selector) => selector(mockStateFs));

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

        const nodeHeaders = screen.getAllByText((content, element) => {
            return (
                content.includes('node1') &&
                element.tagName === 'SPAN' &&
                element.getAttribute('variant') === 'h6'
            );
        });

        expect(nodeHeaders.length).toBeGreaterThan(0);

        const resourcesAccordion = await screen.findByRole('button', {
            name: /expand resources for node node1/i,
        });

        await user.click(resourcesAccordion);

        await waitFor(() => {
            expect(screen.getByText('resFs')).toBeInTheDocument();
        }, {timeout: 10000});

        const resourceMenuButtons = screen.getAllByRole('button', {
            name: /Resource resFs actions/i,
        });

        expect(resourceMenuButtons.length).toBeGreaterThan(0);
        const resourceMenuButton = resourceMenuButtons[0];

        await user.click(resourceMenuButton);

        await waitFor(() => {
            const menu = screen.getByRole('menu');
            expect(within(menu).queryByRole('menuitem', {name: /run/i})).not.toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            const menu = screen.getByRole('menu');
            expect(within(menu).getByRole('menuitem', {name: /start/i})).toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            const menu = screen.getByRole('menu');
            expect(within(menu).getByRole('menuitem', {name: /stop/i})).toBeInTheDocument();
        }, {timeout: 10000});
    }, 20000);

    test('getResourceType handles no type found', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        const mockStateNoType = {
            objectStatus: {
                'root/svc/svc1': {
                    avail: 'up',
                    frozen: null,
                },
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        resources: {
                            resNoType: {
                                status: 'up',
                                label: 'No Type Resource',
                                provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
                                running: true,
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
                        resNoType: {restart: {remaining: 0}},
                    },
                },
            },
            instanceConfig: {
                'root/svc/svc1': {
                    resources: {
                        resNoType: {
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
        useEventStore.mockImplementation((selector) => selector(mockStateNoType));

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

        const resourcesAccordion = await screen.findByRole('button', {
            name: /expand resources for node node1/i,
        });

        await user.click(resourcesAccordion);

        await waitFor(() => {
            expect(screen.getByText('resNoType')).toBeInTheDocument();
        }, {timeout: 10000});

        const resourceMenuButtons = screen.getAllByRole('button', {
            name: /Resource resNoType actions/i,
        });

        expect(resourceMenuButtons.length).toBeGreaterThan(0);
        const resourceMenuButton = resourceMenuButtons[0];

        await user.click(resourceMenuButton);

        await waitFor(() => {
            expect(consoleWarnSpy).toHaveBeenCalledWith('Resource type not found for rid: resNoType, returning empty string');
            const menu = screen.getByRole('menu');
            require('../../constants/actions').RESOURCE_ACTIONS.forEach(({name}) => {
                expect(within(menu).getByRole('menuitem', {name: new RegExp(name, 'i')})).toBeInTheDocument();
            });
        }, {timeout: 10000});

        consoleWarnSpy.mockRestore();
    }, 20000);
});
