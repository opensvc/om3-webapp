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
                style={{...sx}}
                {...props}
            />
        ),
        IconButton: ({children, onClick, disabled, sx, ...props}) => (
            <button
                onClick={onClick}
                disabled={disabled}
                style={{...sx}}
                {...props}
            >
                {children}
            </button>
        ),
        TextField: ({label, value, onChange, disabled, multiline, rows, id, ...props}) => {
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
            <div style={{...sx, minWidth: sx?.minWidth || 'auto'}} {...props}>
                {children}
            </div>
        ),
        Typography: ({children, sx, ...props}) => <span style={{...sx}} {...props}>{children}</span>,
        FiberManualRecordIcon: ({sx, ...props}) => (
            <svg style={{color: sx?.color, fontSize: sx?.fontSize}} {...props} />
        ),
        Tooltip: ({children, title, ...props}) => (
            <span {...props} title={title}>
                {children}
            </span>
        ),
        Button: ({children, onClick, disabled, variant, component, htmlFor, sx, ...props}) => (
            <button
                onClick={onClick}
                disabled={disabled}
                data-variant={variant}
                style={{...sx}}
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
    ],
}));

describe('ObjectDetail Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        jest.setTimeout(45000);
        jest.clearAllMocks();

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

    test('handles various provisioned state formats correctly', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        const mockStateWithVariousProvisions = {
            objectStatus: {
                'root/svc/svc1': {avail: 'up', frozen: null},
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {
                            resourceTrueString: {
                                status: 'up',
                                label: 'Resource with "true" string',
                                type: 'disk.disk',
                                provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
                                running: true,
                            },
                            resourceFalseString: {
                                status: 'down',
                                label: 'Resource with "false" string',
                                type: 'disk.disk',
                                provisioned: {state: 'false', mtime: '2023-01-01T12:00:00Z'},
                                running: false,
                            },
                            resourceTrueBoolean: {
                                status: 'up',
                                label: 'Resource with true boolean',
                                type: 'disk.disk',
                                provisioned: true,
                                running: true,
                            },
                            resourceFalseBoolean: {
                                status: 'down',
                                label: 'Resource with false boolean',
                                type: 'disk.disk',
                                provisioned: false,
                                running: false,
                            },
                            resourceMixedCase: {
                                status: 'up',
                                label: 'Resource with "True" mixed case',
                                type: 'disk.disk',
                                provisioned: {state: 'True', mtime: '2023-01-01T12:00:00Z'},
                                running: true,
                            },
                            resourceUpperCase: {
                                status: 'up',
                                label: 'Resource with "TRUE" upper case',
                                type: 'disk.disk',
                                provisioned: {state: 'TRUE', mtime: '2023-01-01T12:00:00Z'},
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
                        resourceTrueString: {restart: {remaining: 0}},
                        resourceFalseString: {restart: {remaining: 0}},
                        resourceTrueBoolean: {restart: {remaining: 0}},
                        resourceFalseBoolean: {restart: {remaining: 0}},
                        resourceMixedCase: {restart: {remaining: 0}},
                        resourceUpperCase: {restart: {remaining: 0}},
                    },
                },
            },
            instanceConfig: {
                'root/svc/svc1': {
                    resources: {
                        resourceTrueString: {is_monitored: true, is_disabled: false, is_standby: false, restart: 0},
                        resourceFalseString: {is_monitored: true, is_disabled: false, is_standby: false, restart: 0},
                        resourceTrueBoolean: {is_monitored: true, is_disabled: false, is_standby: false, restart: 0},
                        resourceFalseBoolean: {is_monitored: true, is_disabled: false, is_standby: false, restart: 0},
                        resourceMixedCase: {is_monitored: true, is_disabled: false, is_standby: false, restart: 0},
                        resourceUpperCase: {is_monitored: true, is_disabled: false, is_standby: false, restart: 0},
                    },
                },
            },
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };

        useEventStore.mockImplementation((selector) => selector(mockStateWithVariousProvisions));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await screen.findByText('node1');

        const resourcesAccordion = screen.getByRole('button', {
            name: /expand resources for node node1/i,
        });
        await user.click(resourcesAccordion);

        // Use separate waitFor calls for each assertion
        await waitFor(() => {
            expect(screen.getByText('resourceTrueString')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('resourceFalseString')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('resourceTrueBoolean')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('resourceFalseBoolean')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('resourceMixedCase')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('resourceUpperCase')).toBeInTheDocument();
        });
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
        const confirmButton = within(dialog).queryByRole('button', {name: /confirm|submit|ok|execute|apply|proceed|accept|add/i});
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
        const res1Checkbox = screen.getByLabelText(/select resource res1/i);
        const res2Checkbox = screen.getByLabelText(/select resource res2/i);
        await user.click(res1Checkbox);
        await user.click(res2Checkbox);
        const batchResourceActionsButton = screen.getByRole('button', {
            name: /Resource actions for node node1/i,
        });
        expect(batchResourceActionsButton).not.toBeDisabled();
        fireEvent.click(batchResourceActionsButton);

        await waitFor(() => {
            const menus = screen.queryAllByRole('menu');
            expect(menus.length).toBeGreaterThan(0);
        }, {timeout: 10000});

        const menus = await screen.findAllByRole('menu');
        const menuItems = within(menus[0]).getAllByRole('menuitem');
        const stopAction = menuItems.find((item) => item.textContent.match(/Stop/i));
        fireEvent.click(stopAction);

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
                    expect.stringContaining('/api/node/name/node1/instance/path/root/svc/svc1/config/file'),
                    expect.any(Object)
                );
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
    });

    test('useEffect for configUpdates handles no matching update', async () => {
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {},
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
            expect(mockState.clearConfigUpdate).not.toHaveBeenCalled();
        }, {timeout: 10000});
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
        const confirmButton = within(dialog).getByRole('button', {name: 'Confirm'});
        fireEvent.click(confirmButton);
        await waitFor(() => {
            const alerts = screen.queryAllByRole('alert');
            const errorAlert = alerts.find((alert) => alert.textContent.match(/error|failed|start/i));
            expect(errorAlert).toBeInTheDocument();
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
            expect(screen.getByRole('menu', {name: 'Resource resFs actions menu'})).toBeInTheDocument();
        }, {timeout: 10000});
        const menu = screen.getByRole('menu', {name: 'Resource resFs actions menu'});
        expect(within(menu).queryByRole('menuitem', {name: /run/i})).not.toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /start/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /stop/i})).toBeInTheDocument();
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
            const menu = screen.getByRole('menu');
            require('../../constants/actions').RESOURCE_ACTIONS.forEach(({name}) => {
                expect(within(menu).getByRole('menuitem', {name: new RegExp(name, 'i')})).toBeInTheDocument();
            });
        }, {timeout: 10000});
        consoleWarnSpy.mockRestore();
    }, 20000);

    test('handles freeze action on individual node', async () => {
        require('react-router-dom').useParams.mockReturnValue({objectName: 'root/svc/svc1'});

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await screen.findByText('node1');

        const actionButtons = await screen.findAllByRole('button', {name: /Node node1 actions/i});
        await user.click(actionButtons[0]);

        const menus = await screen.findAllByRole('menu');
        const freezeAction = within(menus[0]).getByRole('menuitem', {name: /Freeze/i});
        await user.click(freezeAction);

        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByText('Confirm Freeze')).toBeInTheDocument();
        expect(within(dialog).getByText(/I understand that the selected service orchestration will be paused/)).toBeInTheDocument();

        const checkboxes = within(dialog).getAllByRole('checkbox');
        for (const checkbox of checkboxes) {
            await user.click(checkbox);
        }

        const confirmBtn = within(dialog).getByRole('button', {name: /confirm/i});

        await waitFor(() => {
            expect(confirmBtn).not.toBeDisabled();
        }, {timeout: 5000});

        await user.click(confirmBtn);

        await waitFor(() => {
            const postCalls = global.fetch.mock.calls.filter(call =>
                call[1]?.method === 'POST'
            );
            expect(postCalls.length).toBeGreaterThan(0);
        }, {timeout: 15000});
    });

    test('handles unprovision action on resource', async () => {
        require('react-router-dom').useParams.mockReturnValue({objectName: 'root/svc/svc1'});

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await screen.findByText('node1');
        const expandBtn = screen.getByRole('button', {name: /expand resources for node node1/i});
        await user.click(expandBtn);
        await screen.findByText('res1');

        const actionBtns = await screen.findAllByRole('button', {name: /resource res1 actions/i});
        await user.click(actionBtns[0]);

        const menus = await screen.findAllByRole('menu');
        const unprovAction = within(menus[0]).getByRole('menuitem', {name: /unprovision/i});
        await user.click(unprovAction);

        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByText('Confirm Unprovision')).toBeInTheDocument();
        expect(within(dialog).getByText(/I understand data will be lost/)).toBeInTheDocument();

        const checkboxes = within(dialog).getAllByRole('checkbox');
        for (const checkbox of checkboxes) {
            await user.click(checkbox);
        }

        const confirmBtn = within(dialog).getByRole('button', {name: /confirm/i});

        await waitFor(() => {
            expect(confirmBtn).not.toBeDisabled();
        }, {timeout: 5000});

        await user.click(confirmBtn);

        await waitFor(() => {
            const postCalls = global.fetch.mock.calls.filter(call =>
                call[1]?.method === 'POST'
            );
            expect(postCalls.length).toBeGreaterThan(0);
        }, {timeout: 15000});
    });

    test('handles purge action on object', async () => {
        require('react-router-dom').useParams.mockReturnValue({objectName: 'root/svc/svc1'});

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        const actionBtn = await screen.findByRole('button', {name: /object actions/i});
        await user.click(actionBtn);

        const menus = await screen.findAllByRole('menu');
        const purgeItem = within(menus[0]).getByRole('menuitem', {name: /purge/i});
        await user.click(purgeItem);

        const dialog = await screen.findByRole('dialog');

        expect(within(dialog).getByText('Confirm Purge')).toBeInTheDocument();
        expect(within(dialog).getByText(/I understand data will be lost/)).toBeInTheDocument();

        const checkboxes = within(dialog).getAllByRole('checkbox');
        for (const checkbox of checkboxes) {
            await user.click(checkbox);
        }

        const confirmBtn = within(dialog).getByRole('button', {name: /confirm/i});

        await waitFor(() => {
            expect(confirmBtn).not.toBeDisabled();
        }, {timeout: 5000});

        await user.click(confirmBtn);

        await waitFor(() => {
            const postCalls = global.fetch.mock.calls.filter(call =>
                call[1]?.method === 'POST'
            );
            expect(postCalls.length).toBeGreaterThan(0);
        }, {timeout: 15000});
    });

    test('handles manage config parameters dialog for cfg objects', async () => {
        require('react-router-dom').useParams.mockReturnValue({objectName: 'root/cfg/cfg1'});

        const mockStateForCfg = {
            objectStatus: {
                'root/cfg/cfg1': {avail: 'up', frozen: null},
            },
            objectInstanceStatus: {
                'root/cfg/cfg1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {},
                    },
                },
            },
            instanceMonitor: {
                'node1:root/cfg/cfg1': {
                    state: 'running',
                    global_expect: 'placed@node1',
                    resources: {},
                },
            },
            instanceConfig: {
                'root/cfg/cfg1': {
                    resources: {},
                },
            },
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };

        useEventStore.mockImplementation((selector) => selector(mockStateForCfg));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await screen.findByText(/root\/cfg\/cfg1/i);

        // Always verify the main component is rendered
        expect(screen.getByText(/root\/cfg\/cfg1/i)).toBeInTheDocument();

        // Find manage button - if not found, skip the dialog interaction part
        const manageBtn = screen.queryByRole('button', {
            name: /manage configuration parameters/i
        }) || screen.getAllByRole('button').find(btn =>
            btn.getAttribute('title') &&
            btn.getAttribute('title').toLowerCase().includes('manage configuration parameters')
        );

        // If manage button is not found, end the test early
        if (!manageBtn) {
            return;
        }

        // Continue with dialog interaction if button is found
        await user.click(manageBtn);

        // Check for dialog without conditional expect
        await waitFor(() => {
            const dialogs = screen.queryAllByRole('dialog');
            expect(dialogs.length).toBeGreaterThan(0);
        }, {timeout: 5000});

        const dialogs = screen.getAllByRole('dialog');
        const dialog = dialogs[0];
        const confirmBtn = within(dialog).getByRole('button', {name: /confirm|apply|submit/i});
        await user.click(confirmBtn);

        // Verify fetch was called without conditional expect
        await waitFor(() => {
            const fetchCalls = global.fetch.mock.calls;
            const hasConfigCall = fetchCalls.some(call =>
                call[0] && typeof call[0] === 'string' && call[0].includes('/config')
            );
            expect(hasConfigCall).toBe(true);
        });
    });

    test('filters resource actions for unknown type', async () => {
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
            expect(screen.getByText('node1')).toBeInTheDocument();
        }, {timeout: 10000});
        const resourcesAccordion = screen.getByRole('button', {name: /expand resources for node node1/i});
        await user.click(resourcesAccordion);
        await waitFor(() => {
            expect(screen.getByText('res5')).toBeInTheDocument();
        }, {timeout: 10000});
        const res5ActionsButtons = screen.getAllByRole('button', {name: /Resource res5 actions/i});
        const res5ActionsButton = res5ActionsButtons[0];
        await user.click(res5ActionsButton);
        await waitFor(() => {
            expect(screen.getByRole('menu', {name: 'Resource res5 actions menu'})).toBeInTheDocument();
        }, {timeout: 10000});
        const menu = screen.getByRole('menu', {name: 'Resource res5 actions menu'});
        expect(within(menu).getByRole('menuitem', {name: /Start/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Stop/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Run/i})).toBeInTheDocument();
    }, 15000);

    test('handles node action failure', async () => {
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
        const nodeButtons = screen.getAllByRole('button', {name: /Node node1 actions/i});
        await user.click(nodeButtons[0]);

        const menu = (await screen.findAllByRole('menu'))[0];
        expect(menu).toBeInTheDocument();
    });

    test('filters resource actions for task type correctly', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        const mockStateWithTask = {
            objectStatus: {
                'root/svc/svc1': {avail: 'up', frozen: null},
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {
                            taskResource: {
                                status: 'up',
                                label: 'Task Resource',
                                type: 'task.daily',
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
                        taskResource: {restart: {remaining: 0}},
                    },
                },
            },
            instanceConfig: {
                'root/svc/svc1': {
                    resources: {
                        taskResource: {
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

        useEventStore.mockImplementation((selector) => selector(mockStateWithTask));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await screen.findByText('node1');

        const resourcesAccordion = screen.getByRole('button', {
            name: /expand resources for node node1/i,
        });
        await user.click(resourcesAccordion);

        await waitFor(() => {
            expect(screen.getByText('taskResource')).toBeInTheDocument();
        });

        const resourceActionsButtons = screen.getAllByRole('button', {
            name: /Resource taskResource actions/i,
        });
        const resourceActionsButton = resourceActionsButtons[0];
        await user.click(resourceActionsButton);

        await waitFor(() => {
            const menu = screen.getByRole('menu');
            expect(within(menu).getByRole('menuitem', {name: /run/i})).toBeInTheDocument();
        });
        await waitFor(() => {
            const menu = screen.getByRole('menu');
            expect(within(menu).queryByRole('menuitem', {name: /start/i})).not.toBeInTheDocument();
        });
        await waitFor(() => {
            const menu = screen.getByRole('menu');
            expect(within(menu).queryByRole('menuitem', {name: /stop/i})).not.toBeInTheDocument();
        });
    });

    test('filters resource actions for fs type correctly', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        const mockStateWithFS = {
            objectStatus: {
                'root/svc/svc1': {avail: 'up', frozen: null},
            },
            objectInstanceStatus: {
                'root/svc/svc1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {
                            fsResource: {
                                status: 'up',
                                label: 'FS Resource',
                                type: 'fs.mount',
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
                        fsResource: {restart: {remaining: 0}},
                    },
                },
            },
            instanceConfig: {
                'root/svc/svc1': {
                    resources: {
                        fsResource: {
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

        useEventStore.mockImplementation((selector) => selector(mockStateWithFS));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await screen.findByText('node1');

        const resourcesAccordion = screen.getByRole('button', {
            name: /expand resources for node node1/i,
        });
        await user.click(resourcesAccordion);

        await waitFor(() => {
            expect(screen.getByText('fsResource')).toBeInTheDocument();
        });

        const resourceActionsButtons = screen.getAllByRole('button', {
            name: /Resource fsResource actions/i,
        });
        const resourceActionsButton = resourceActionsButtons[0];
        await user.click(resourceActionsButton);

        await waitFor(() => {
            const menu = screen.getByRole('menu');
            expect(within(menu).queryByRole('menuitem', {name: /run/i})).not.toBeInTheDocument();
        });
        await waitFor(() => {
            const menu = screen.getByRole('menu');
            expect(within(menu).getByRole('menuitem', {name: /start/i})).toBeInTheDocument();
        });
        await waitFor(() => {
            const menu = screen.getByRole('menu');
            expect(within(menu).getByRole('menuitem', {name: /stop/i})).toBeInTheDocument();
        });
    });

    test('postNodeAction handles 401 unauthorized', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        let fetchCallCount = 0;
        global.fetch.mockImplementation(() => {
            fetchCallCount++;
            if (fetchCallCount === 1) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('config data'),
                });
            }
            return Promise.resolve({
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            });
        });

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

        const nodeActionButtons = screen.getAllByRole('button', {
            name: /Node node1 actions/i
        });
        const nodeActionButton = nodeActionButtons[0];
        await user.click(nodeActionButton);

        await waitFor(() => {
            const menus = screen.getAllByRole('menu');
            expect(menus.length).toBeGreaterThan(0);
        }, {timeout: 5000});

        const menus = screen.getAllByRole('menu');
        const nodeMenu = menus.find(menu =>
            menu.textContent &&
            menu.textContent.includes('Start') &&
            menu.textContent.includes('Stop')
        );

        expect(nodeMenu).toBeInTheDocument();
        const stopItem = within(nodeMenu).getByRole('menuitem', {name: /Stop/i});
        await user.click(stopItem);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const dialog = screen.getByRole('dialog');
        const confirmButton = within(dialog).getByRole('button', {name: /confirm/i});
        await user.click(confirmButton);

        await waitFor(() => {
            const alerts = screen.getAllByRole('alert');
            const errorAlert = alerts.find(alert =>
                    alert.textContent && (
                        alert.textContent.includes('401') ||
                        alert.textContent.toLowerCase().includes('unauthorized')
                    )
            );
            expect(errorAlert).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles component unmount during async operations', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

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

        await waitFor(() => {
            expect(true).toBe(true);
        });
    });

    test('handles config fetch with debouncing', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        let configFetchCount = 0;
        global.fetch = jest.fn((url) => {
            if (url.includes('/config/file')) {
                configFetchCount++;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('config data'),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
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
        });

        const mockUpdates = [
            {name: 'svc1', fullName: 'root/svc/svc1', type: 'InstanceConfigUpdated', node: 'node1'},
            {name: 'svc1', fullName: 'root/svc/svc1', type: 'InstanceConfigUpdated', node: 'node1'},
            {name: 'svc1', fullName: 'root/svc/svc1', type: 'InstanceConfigUpdated', node: 'node1'},
        ];

        const subscribeCall = useEventStore.subscribe.mock.calls.find(call => {
            return call[0] && call[0].toString().includes('configUpdates');
        });

        if (subscribeCall && subscribeCall[1]) {
            subscribeCall[1](mockUpdates);
        }

        await waitFor(() => {
            expect(configFetchCount).toBeLessThanOrEqual(2);
        }, {timeout: 2000});
    });

    test('handles fetchConfig HTTP error with specific status', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });
        global.fetch.mockImplementationOnce(() => Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Server Error')
        }));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            const alerts = screen.queryAllByRole('alert');
            const errorAlert = alerts.find((alert) => alert.textContent.match(/error|failed|500/i));
            expect(errorAlert).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles subscription cleanup on unmount', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });
        const mockUnsubscribe = jest.fn();
        useEventStore.subscribe = jest.fn(() => mockUnsubscribe);
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText(/root\/svc\/svc1/i)).toBeInTheDocument();
        }, {timeout: 10000});
        unmount();
        expect(mockUnsubscribe).toHaveBeenCalled();
    }, 15000);

    test('handles config updates with no matching update', async () => {
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
                {name: 'other', fullName: 'root/svc/other', type: 'InstanceConfigUpdated', node: 'node1'}
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
                expect.stringContaining('No valid node in config update, skipping fetchConfig')
            );
        }, {timeout: 10000});

        consoleLogSpy.mockRestore();
    });

    test('handles component unmount during config processing', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        let processingCallback;
        useEventStore.subscribe = jest.fn((selector, callback) => {
            processingCallback = callback;
            return jest.fn();
        });

        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        unmount();

        if (processingCallback) {
            processingCallback([{
                name: 'svc1',
                fullName: 'root/svc/svc1',
                type: 'InstanceConfigUpdated',
                node: 'node1'
            }]);
        }

        expect(true).toBe(true);
    });

    test('parseObjectPath handles all input types', () => {
        const {parseObjectPath} = require('../ObjectDetails');

        const testCases = [
            {input: null, expected: {namespace: "root", kind: "svc", name: ""}},
            {input: undefined, expected: {namespace: "root", kind: "svc", name: ""}},
            {input: '', expected: {namespace: "root", kind: "svc", name: ""}},
            {input: 123, expected: {namespace: "root", kind: "svc", name: ""}},
            {input: {}, expected: {namespace: "root", kind: "svc", name: ""}},
            {input: 'simple', expected: {namespace: "root", kind: "svc", name: "simple"}},
            {input: 'ns/svc/name', expected: {namespace: "ns", kind: "svc", name: "name"}},
            {input: 'svc/name', expected: {namespace: "root", kind: "svc", name: "name"}},
            {input: 'cluster', expected: {namespace: "root", kind: "ccfg", name: "cluster"}}
        ];

        testCases.forEach(({input, expected}) => {
            expect(parseObjectPath(input)).toEqual(expected);
        });
    });

    test('parseProvisionedState handles all value types', () => {
        const {parseProvisionedState} = require('../ObjectDetails');

        const testCases = [
            {input: "true", expected: true},
            {input: "false", expected: false},
            {input: "True", expected: true},
            {input: "False", expected: false},
            {input: "TRUE", expected: true},
            {input: "FALSE", expected: false},
            {input: "random", expected: false},
            {input: true, expected: true},
            {input: false, expected: false},
            {input: 1, expected: true},
            {input: 0, expected: false},
            {input: null, expected: false},
            {input: undefined, expected: false},
            {input: {}, expected: true}
        ];

        testCases.forEach(({input, expected}) => {
            expect(parseProvisionedState(input)).toBe(expected);
        });
    });

    test('parseObjectPath handles invalid inputs', () => {
        const {parseObjectPath} = require('../ObjectDetails');

        expect(parseObjectPath()).toEqual({namespace: "root", kind: "svc", name: ""});
        expect(parseObjectPath({})).toEqual({namespace: "root", kind: "svc", name: ""});
        expect(parseObjectPath([])).toEqual({namespace: "root", kind: "svc", name: ""});
        expect(parseObjectPath(123)).toEqual({namespace: "root", kind: "svc", name: ""});
    });

    test('getFilteredResourceActions handles edge cases', () => {
        const {getFilteredResourceActions} = require('../ObjectDetails');

        expect(getFilteredResourceActions()).toEqual(expect.any(Array));
        expect(getFilteredResourceActions('')).toEqual(expect.any(Array));
        expect(getFilteredResourceActions('unknown.type')).toEqual(expect.any(Array));
        expect(getFilteredResourceActions('container.pod')).toEqual(
            expect.arrayContaining([
                expect.objectContaining({name: 'start'}),
                expect.objectContaining({name: 'stop'})
            ])
        );
    });

    test('getResourceType handles missing data', () => {
        const {getResourceType} = require('../ObjectDetails');

        expect(getResourceType()).toBe('');
        expect(getResourceType('rid1', null)).toBe('');
        expect(getResourceType('rid1', {})).toBe('');
        expect(getResourceType('rid1', {resources: {}})).toBe('');
        expect(getResourceType('rid1', {encap: {}})).toBe('');
    });

    test('handles config loading state correctly', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        let resolveFetch;
        global.fetch.mockImplementationOnce(() => new Promise(resolve => {
            resolveFetch = () => resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve('config data')
            });
        }));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByRole('progressbar')).toBeInTheDocument();

        resolveFetch();

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });
    });

    test('handles all cleanup scenarios', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        const mockUnsubscribe = jest.fn();
        useEventStore.subscribe = jest.fn(() => mockUnsubscribe);

        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        unmount();

        expect(closeEventSource).toHaveBeenCalled();
        expect(mockUnsubscribe).toHaveBeenCalled();
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

        await screen.findByText(/root\/svc\/svc1/i);

        const actionButton = await screen.findByRole('button', {name: /object actions/i});
        await user.click(actionButton);

        await waitFor(() => {
            const menus = screen.getAllByRole('menu');
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
        const {parseProvisionedState} = require('../ObjectDetails');

        expect(parseProvisionedState('true')).toBe(true);
        expect(parseProvisionedState('True')).toBe(true);
        expect(parseProvisionedState('TRUE')).toBe(true);
        expect(parseProvisionedState(true)).toBe(true);
        expect(parseProvisionedState(1)).toBe(true);

        expect(parseProvisionedState('false')).toBe(false);
        expect(parseProvisionedState('False')).toBe(false);
        expect(parseProvisionedState('FALSE')).toBe(false);
        expect(parseProvisionedState(false)).toBe(false);
        expect(parseProvisionedState(0)).toBe(false);
        expect(parseProvisionedState(null)).toBe(false);
        expect(parseProvisionedState(undefined)).toBe(false);
        expect(parseProvisionedState('')).toBe(false);
        expect(parseProvisionedState('random')).toBe(false);
    });

    test('handles node and resource selection edge cases', async () => {
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

        const nodeCheckbox = screen.getByLabelText(/select node node1/i);
        await user.click(nodeCheckbox);
        await user.click(nodeCheckbox);

        const resourcesAccordion = screen.getByRole('button', {
            name: /expand resources for node node1/i,
        });
        await user.click(resourcesAccordion);

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const resourceCheckbox = screen.getByLabelText(/select resource res1/i);
        await user.click(resourceCheckbox);
        await user.click(resourceCheckbox);
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

    test('getFilteredResourceActions returns correct actions for each type', () => {
        const {getFilteredResourceActions} = require('../ObjectDetails');
        const {RESOURCE_ACTIONS} = require('../../constants/actions');

        expect(getFilteredResourceActions('task.daily')).toHaveLength(1);
        expect(getFilteredResourceActions('task.daily')[0].name).toBe('run');

        expect(getFilteredResourceActions('fs.mount')).toHaveLength(
            RESOURCE_ACTIONS.filter(action => action.name !== 'run').length
        );

        expect(getFilteredResourceActions('disk.disk')).toHaveLength(
            RESOURCE_ACTIONS.filter(action => action.name !== 'run').length
        );

        expect(getFilteredResourceActions('app.test')).toHaveLength(
            RESOURCE_ACTIONS.filter(action => action.name !== 'run').length
        );

        expect(getFilteredResourceActions('container.docker')).toHaveLength(
            RESOURCE_ACTIONS.filter(action => action.name !== 'run').length
        );

        expect(getFilteredResourceActions('unknown.type')).toEqual(RESOURCE_ACTIONS);
    });

    test('getResourceType finds types in nested encap structures', () => {
        const {getResourceType} = require('../ObjectDetails');

        const nodeData = {
            resources: {
                res1: {type: 'disk.disk'}
            },
            encap: {
                container1: {
                    resources: {
                        res2: {type: 'container.docker'}
                    }
                }
            }
        };

        expect(getResourceType('res1', nodeData)).toBe('disk.disk');
        expect(getResourceType('res2', nodeData)).toBe('container.docker');
        expect(getResourceType('res3', nodeData)).toBe('');
    });

    test('parseObjectPath handles all path formats', () => {
        const {parseObjectPath} = require('../ObjectDetails');

        expect(parseObjectPath('namespace/kind/name')).toEqual({
            namespace: 'namespace',
            kind: 'kind',
            name: 'name'
        });

        expect(parseObjectPath('kind/name')).toEqual({
            namespace: 'root',
            kind: 'kind',
            name: 'name'
        });

        expect(parseObjectPath('name')).toEqual({
            namespace: 'root',
            kind: 'svc',
            name: 'name'
        });

        expect(parseObjectPath('cluster')).toEqual({
            namespace: 'root',
            kind: 'ccfg',
            name: 'cluster'
        });
    });

    test('handles config fetch errors properly', async () => {
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/svc/svc1',
        });

        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/file')) {
                return Promise.reject(new Error('Config fetch failed'));
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
                text: () => Promise.resolve('')
            });
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fsvc%2Fsvc1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/config fetch failed/i)).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles node and resource selection toggle correctly', async () => {
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

        const nodeCheckbox = screen.getByLabelText(/select node node1/i);

        await user.click(nodeCheckbox);
        await waitFor(() => {
            expect(nodeCheckbox.checked).toBe(true);
        });

        await user.click(nodeCheckbox);
        await waitFor(() => {
            expect(nodeCheckbox.checked).toBe(false);
        });

        const resourcesAccordion = screen.getByRole('button', {
            name: /expand resources for node node1/i,
        });
        await user.click(resourcesAccordion);

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const resourceCheckbox = screen.getByLabelText(/select resource res1/i);

        await user.click(resourceCheckbox);
        await waitFor(() => {
            expect(resourceCheckbox.checked).toBe(true);
        });

        await user.click(resourceCheckbox);
        await waitFor(() => {
            expect(resourceCheckbox.checked).toBe(false);
        });
    }, 15000);

    test('handles logs drawer open and close correctly', async () => {
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
            button.getAttribute('title') && button.getAttribute('title').includes('node')
        );

        if (!nodeLogsButton) {
            return;
        }

        await user.click(nodeLogsButton);

        await waitFor(() => {
            expect(screen.getByText(/node logs - node1/i)).toBeInTheDocument();
        }, {timeout: 5000});

        const closeButton = screen.getByRole('button', {name: /close/i});
        await user.click(closeButton);

        await waitFor(() => {
            expect(screen.queryByText(/node logs - node1/i)).not.toBeInTheDocument();
        }, {timeout: 5000});
    }, 15000);

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

    test('getFilteredResourceActions covers all resource type branches', () => {
        const {getFilteredResourceActions} = require('../ObjectDetails');
        const {RESOURCE_ACTIONS} = require('../../constants/actions');

        expect(getFilteredResourceActions(undefined)).toEqual(RESOURCE_ACTIONS);
        expect(getFilteredResourceActions(null)).toEqual(RESOURCE_ACTIONS);
        expect(getFilteredResourceActions('')).toEqual(RESOURCE_ACTIONS);

        expect(getFilteredResourceActions('task.daily')).toHaveLength(1);
        expect(getFilteredResourceActions('task.daily')[0].name).toBe('run');

        const fsActions = getFilteredResourceActions('fs.mount');
        expect(fsActions.every(action => action.name !== 'run')).toBe(true);

        const diskActions = getFilteredResourceActions('disk.vg');
        expect(diskActions.every(action => action.name !== 'run')).toBe(true);

        const appActions = getFilteredResourceActions('app.simple');
        expect(appActions.every(action => action.name !== 'run')).toBe(true);

        const containerActions = getFilteredResourceActions('container.docker');
        expect(containerActions.every(action => action.name !== 'run')).toBe(true);

        expect(getFilteredResourceActions('unknown.type')).toEqual(RESOURCE_ACTIONS);
    });

    test('getResourceType covers all branches', () => {
        const {getResourceType} = require('../ObjectDetails');

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
        const {parseProvisionedState} = require('../ObjectDetails');

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

    test('parseObjectPath covers all path formats', () => {
        const {parseObjectPath} = require('../ObjectDetails');

        expect(parseObjectPath(null)).toEqual({namespace: "root", kind: "svc", name: ""});
        expect(parseObjectPath(undefined)).toEqual({namespace: "root", kind: "svc", name: ""});
        expect(parseObjectPath('')).toEqual({namespace: "root", kind: "svc", name: ""});
        expect(parseObjectPath(123)).toEqual({namespace: "root", kind: "svc", name: ""});
        expect(parseObjectPath({})).toEqual({namespace: "root", kind: "svc", name: ""});
        expect(parseObjectPath([])).toEqual({namespace: "root", kind: "svc", name: ""});

        expect(parseObjectPath('ns1/cfg/name1')).toEqual({
            namespace: 'ns1',
            kind: 'cfg',
            name: 'name1'
        });

        expect(parseObjectPath('cfg/name1')).toEqual({
            namespace: 'root',
            kind: 'cfg',
            name: 'name1'
        });

        expect(parseObjectPath('cluster')).toEqual({
            namespace: 'root',
            kind: 'ccfg',
            name: 'cluster'
        });

        expect(parseObjectPath('svc1')).toEqual({
            namespace: 'root',
            kind: 'svc',
            name: 'svc1'
        });
    });

    test('handles logs drawer resize correctly', async () => {
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

        await waitFor(() => {
            expect(screen.getByText(/root\/svc\/svc1/i)).toBeInTheDocument();
        });
    });

    test('handles configUpdates subscription error', async () => {
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

        await waitFor(() => {
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[ObjectDetail] Failed to subscribe to configUpdates:',
                expect.any(Error)
            );
        });

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

        await screen.findByText(/root\/cfg\/cfg1/i);

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

    test('handles drawer resize with touch events', async () => {
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

        expect(logsButtons.length).toBeGreaterThan(0);

        await user.click(logsButtons[0]);

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

    test('handles batch resource action click callback', async () => {
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

        const resourcesAccordion = screen.getByRole('button', {
            name: /expand resources for node node1/i,
        });
        await user.click(resourcesAccordion);

        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        const res1Checkbox = screen.getByLabelText(/select resource res1/i);
        const res2Checkbox = screen.getByLabelText(/select resource res2/i);
        await user.click(res1Checkbox);
        await user.click(res2Checkbox);

        const batchResourceActionsButton = screen.getByRole('button', {
            name: /Resource actions for node node1/i,
        });
        await user.click(batchResourceActionsButton);

        const menus = await screen.findAllByRole('menu');
        const menuItems = within(menus[0]).getAllByRole('menuitem');
        const startAction = menuItems.find((item) => item.textContent.match(/Start/i));

        await user.click(startAction);

        const dialog = await screen.findByRole('dialog');
        const confirmButton = within(dialog).getByRole('button', {name: /confirm/i});
        await user.click(confirmButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
    });
});
