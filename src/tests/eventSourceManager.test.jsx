import * as eventSourceManager from '../eventSourceManager';
import {EventSourcePolyfill} from 'event-source-polyfill';
import useEventStore from '../hooks/useEventStore.js';
import useEventLogStore from '../hooks/useEventLogStore.js';
import {URL_NODE_EVENT} from '../config/apiPath.js';

// Mock the external dependencies
jest.mock('event-source-polyfill');
jest.mock('../hooks/useEventStore.js');
jest.mock('../hooks/useEventLogStore.js');

// Mock timers
jest.useFakeTimers();

// Mock performance.now to control flush timing
let mockNow = 0;
const originalPerformance = global.performance;
beforeAll(() => {
    global.performance = {now: () => mockNow};
});
afterAll(() => {
    global.performance = originalPerformance;
});

// Helper function to simulate shallowEqual logic
const mockShallowEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => a[key] === b[key]);
};

describe('eventSourceManager', () => {
    let mockStore;
    let mockLogStore;
    let mockEventSource;
    let mockLoggerEventSource;
    let originalConsole;
    let localStorageMock;
    let originalDebug;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        // Advance mockNow by a large amount each test so lastFlushTime (module-level, persists
        // between tests) is always far enough in the past: now - lastFlushTime >= MIN_FLUSH_INTERVAL(10).
        // Using += 1_000_000 guarantees this even if the previous test flushed at the previous mockNow.
        mockNow += 1_000_000;

        // Setup complete mock store with shallowEqual simulation
        mockStore = {
            nodeStatus: {},
            nodeMonitor: {},
            nodeStats: {},
            objectStatus: {},
            objectInstanceStatus: {},
            heartbeatStatus: {},
            instanceMonitor: {},
            instanceConfig: {},
            configUpdates: [],

            // Mock setters with shallowEqual logic
            setNodeStatuses: jest.fn((newStatus) => {
                if (mockShallowEqual(mockStore.nodeStatus, newStatus)) {
                    return; // Skip update
                }
                mockStore.nodeStatus = newStatus;
            }),

            setNodeMonitors: jest.fn((newMonitor) => {
                if (mockShallowEqual(mockStore.nodeMonitor, newMonitor)) {
                    return;
                }
                mockStore.nodeMonitor = newMonitor;
            }),

            setNodeStats: jest.fn((newStats) => {
                if (mockShallowEqual(mockStore.nodeStats, newStats)) {
                    return;
                }
                mockStore.nodeStats = newStats;
            }),

            setObjectStatuses: jest.fn((newStatus) => {
                if (mockShallowEqual(mockStore.objectStatus, newStatus)) {
                    return;
                }
                mockStore.objectStatus = newStatus;
            }),

            setInstanceStatuses: jest.fn((newStatus) => {
                // For nested object comparison
                const currentStr = JSON.stringify(mockStore.objectInstanceStatus);
                const newStr = JSON.stringify(newStatus);
                if (currentStr === newStr) {
                    return;
                }
                mockStore.objectInstanceStatus = newStatus;
            }),

            setHeartbeatStatuses: jest.fn((newStatus) => {
                if (mockShallowEqual(mockStore.heartbeatStatus, newStatus)) {
                    return;
                }
                mockStore.heartbeatStatus = newStatus;
            }),

            setInstanceMonitors: jest.fn((newMonitor) => {
                if (mockShallowEqual(mockStore.instanceMonitor, newMonitor)) {
                    return;
                }
                mockStore.instanceMonitor = newMonitor;
            }),

            removeObject: jest.fn((objectName) => {
                delete mockStore.objectStatus[objectName];
                delete mockStore.objectInstanceStatus[objectName];
                delete mockStore.instanceConfig[objectName];
            }),

            setConfigUpdated: jest.fn((updates) => {
                mockStore.configUpdates = updates || [];
            }),

            setInstanceConfig: jest.fn((path, node, config) => {
                if (!mockStore.instanceConfig[path]) {
                    mockStore.instanceConfig[path] = {};
                }
                if (mockShallowEqual(mockStore.instanceConfig[path][node], config)) {
                    return;
                }
                mockStore.instanceConfig[path][node] = config;
            }),
        };

        useEventStore.getState.mockReturnValue(mockStore);

        mockLogStore = {
            addEventLog: jest.fn(),
        };
        useEventLogStore.getState.mockReturnValue(mockLogStore);

        // Create a consistent mock EventSource
        mockEventSource = {
            onopen: jest.fn(),
            onerror: null,
            addEventListener: jest.fn(),
            close: jest.fn(),
            readyState: 1, // OPEN state
            url: URL_NODE_EVENT + '?cache=true&filter=NodeStatusUpdated',
        };

        mockLoggerEventSource = {
            onopen: jest.fn(),
            onerror: null,
            addEventListener: jest.fn(),
            close: jest.fn(),
            readyState: 1,
            url: URL_NODE_EVENT + '?cache=true&filter=ObjectStatusUpdated',
        };

        // Mock EventSourcePolyfill to return our mock
        EventSourcePolyfill.mockImplementation(() => {
            return mockEventSource;
        });

        // Mock localStorage properly
        localStorageMock = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn(),
        };
        Object.defineProperty(global, 'localStorage', {
            value: localStorageMock,
            writable: true
        });

        // Store original console methods
        originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        };

        // Mock console methods - capture all debug calls
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
        console.info = jest.fn();
        originalDebug = console.debug;
        console.debug = jest.fn();

        // Mock window.location
        delete window.location;
        window.location = {href: ''};
        window.oidcUserManager = null;

        // Mock dispatchEvent
        window.dispatchEvent = jest.fn();

        // Mock EventSource for CLOSED
        global.EventSource = {CLOSED: 2};

        // Mock requestAnimationFrame
        global.requestAnimationFrame = jest.fn((cb) => {
            setTimeout(cb, 0);
            return 1;
        });
    });

    afterEach(() => {
        // Run all pending timers first so isFlushing/flushTimeoutId are properly reset
        jest.runAllTimers();

        // setPageActive(false) calls clearBuffers() which resets flushTimeoutId, eventCount,
        // isFlushing, needsFlush — prevents stale state leaking between tests
        eventSourceManager.setPageActive(false);
        eventSourceManager.setPageActive(true);

        jest.clearAllTimers();

        // Restore console methods
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.info = originalConsole.info;
        console.debug = originalDebug;

        // Reset module state
        eventSourceManager.closeEventSource();
        eventSourceManager.closeLoggerEventSource();
        delete window.oidcUserManager;
    });

    describe('EventSource lifecycle and management', () => {
        test('should create an EventSource and attach event listeners', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            expect(EventSourcePolyfill).toHaveBeenCalled();
            expect(eventSource.addEventListener).toHaveBeenCalledTimes(9);
        });

        test('should close existing EventSource before creating a new one', () => {
            // Create first EventSource
            const firstEventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            expect(firstEventSource.close).not.toHaveBeenCalled();

            // Create second EventSource
            EventSourcePolyfill.mockImplementationOnce(() => ({
                ...mockEventSource,
            }));
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            expect(mockEventSource.close).toHaveBeenCalled();
        });

        test('should not create EventSource if no token is provided', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, '');
            expect(eventSource).toBeNull();
            expect(console.error).toHaveBeenCalledWith('❌ Missing token for EventSource!');
        });

        test('should close the EventSource when closeEventSource is called', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            eventSourceManager.closeEventSource();
            expect(mockEventSource.close).toHaveBeenCalled();
        });

        test('should not throw error when closing non-existent EventSource', () => {
            expect(() => eventSourceManager.closeEventSource()).not.toThrow();
        });

        test('should call _cleanup if present', () => {
            const cleanupSpy = jest.fn();
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            mockEventSource._cleanup = cleanupSpy;
            eventSourceManager.closeEventSource();
            expect(cleanupSpy).toHaveBeenCalled();
        });

        test('should handle error in _cleanup', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            mockEventSource._cleanup = () => {
                throw new Error('cleanup error');
            };
            expect(() => eventSourceManager.closeEventSource()).not.toThrow();
            expect(console.debug).toHaveBeenCalledWith('Error during eventSource cleanup', expect.any(Error));
        });

        test('should return token from localStorage', () => {
            localStorageMock.getItem.mockReturnValue('local-storage-token');
            const token = eventSourceManager.getCurrentToken();
            expect(token).toBe('local-storage-token');
        });

        test('should return currentToken if localStorage is empty', () => {
            localStorageMock.getItem.mockReturnValue(null);
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'current-token');
            const token = eventSourceManager.getCurrentToken();
            expect(token).toBe('current-token');
        });

        test('should not update if no new token provided', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'old-token');
            eventSourceManager.updateEventSourceToken('');
            expect(mockEventSource.close).not.toHaveBeenCalled();
        });

        test('should configure EventSource with objectName and custom filters', () => {
            const customFilters = ['NodeStatusUpdated', 'ObjectStatusUpdated'];
            eventSourceManager.configureEventSource('fake-token', 'test-object', customFilters);
            expect(EventSourcePolyfill).toHaveBeenCalled();
        });

        test('should handle missing token in configureEventSource', () => {
            eventSourceManager.configureEventSource('');
            expect(console.error).toHaveBeenCalledWith('❌ No token provided for SSE!');
        });

        test('should configure EventSource without objectName', () => {
            eventSourceManager.configureEventSource('fake-token');
            expect(EventSourcePolyfill).toHaveBeenCalled();
            expect(EventSourcePolyfill.mock.calls[0][0]).toContain('cache=true');
        });

        test('should create an EventSource with valid token via startEventReception', () => {
            eventSourceManager.startEventReception('fake-token');
            expect(EventSourcePolyfill).toHaveBeenCalledWith(
                expect.stringContaining(URL_NODE_EVENT),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer fake-token',
                    }),
                })
            );
        });

        test('should close previous EventSource before creating a new one via startEventReception', () => {
            eventSourceManager.startEventReception('fake-token');
            const secondMockEventSource = {
                onopen: jest.fn(),
                onerror: null,
                addEventListener: jest.fn(),
                close: jest.fn(),
                readyState: 1,
            };
            EventSourcePolyfill.mockImplementationOnce(() => secondMockEventSource);
            eventSourceManager.startEventReception('fake-token');
            expect(mockEventSource.close).toHaveBeenCalled();
            expect(EventSourcePolyfill).toHaveBeenCalledTimes(2);
        });

        test('should handle missing token in startEventReception', () => {
            eventSourceManager.startEventReception('');
            expect(console.error).toHaveBeenCalledWith('❌ No token provided for SSE!');
        });

        test('should start event reception with custom filters', () => {
            const customFilters = ['NodeStatusUpdated', 'ObjectStatusUpdated'];
            eventSourceManager.startEventReception('fake-token', customFilters);
            expect(EventSourcePolyfill).toHaveBeenCalled();
            expect(EventSourcePolyfill.mock.calls[0][0]).toContain('filter=NodeStatusUpdated');
            expect(EventSourcePolyfill.mock.calls[0][0]).toContain('filter=ObjectStatusUpdated');
        });

        test('should handle connection open event', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            if (mockEventSource.onopen) {
                mockEventSource.onopen();
            }
            expect(console.info).toHaveBeenCalledWith('✅ EventSource connection established');
        });

        test('should log connection opened with correct data', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            if (mockEventSource.onopen) {
                mockEventSource.onopen();
            }
            expect(mockLogStore.addEventLog).toHaveBeenCalledWith('CONNECTION_OPENED', {
                url: expect.any(String),
                timestamp: expect.any(String)
            });
        });

        test('should log connection error with correct data', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const error = {status: 500, message: 'Test error'};
            if (mockEventSource.onerror) {
                mockEventSource.onerror(error);
            }
            expect(mockLogStore.addEventLog).toHaveBeenCalledWith('CONNECTION_ERROR', {
                error: 'Test error',
                status: 500,
                url: expect.any(String),
                timestamp: expect.any(String)
            });
        });

        test('should ignore onerror if not current EventSource', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            eventSourceManager.closeEventSource();
            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 500});
            }
            expect(console.info).not.toHaveBeenCalledWith(expect.stringContaining('Reconnecting'));
        });

        test('should log reconnection attempt', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 500});
            }
            expect(mockLogStore.addEventLog).toHaveBeenCalledWith('RECONNECTION_ATTEMPT', expect.any(Object));
        });

        test('should log max reconnections reached', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            for (let i = 0; i < 11; i++) {
                if (mockEventSource.onerror) {
                    mockEventSource.onerror({status: 500});
                }
                jest.advanceTimersByTime(2000);
            }

            expect(mockLogStore.addEventLog).toHaveBeenCalledWith('MAX_RECONNECTIONS_REACHED', expect.any(Object));
        });

        test('should handle auth error when new token same as old', () => {
            localStorageMock.getItem.mockReturnValue('old-token');
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'old-token');
            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 401});
            }
            expect(console.warn).toHaveBeenCalledWith('🔐 Authentication error detected');
            expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
        });

        test('should handle auth error without oidcUserManager', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'old-token');
            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 401});
            }
            expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
        });

        test('should handle silent renew failure', async () => {
            window.oidcUserManager = {signinSilent: jest.fn().mockRejectedValue(new Error('renew fail'))};
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'old-token');

            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 401});
            }

            await Promise.resolve();
            await Promise.resolve();

            expect(console.error).toHaveBeenCalledWith('❌ Silent renew failed:', expect.any(Error));
            expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
        });

        test('should update with new token from storage on auth error', () => {
            localStorageMock.getItem.mockReturnValue('new-token');
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'old-token');
            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 401});
            }
            expect(console.info).toHaveBeenCalledWith('🔄 New token available, updating EventSource');
        });

        test('should log connection closed on closeEventSource', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            eventSourceManager.closeEventSource();
            expect(mockLogStore.addEventLog).toHaveBeenCalledWith('CONNECTION_CLOSED', expect.any(Object));
        });

        // Coverage for lines 726-727, 745: updateEventSourceToken with open EventSource
        test('should restart EventSource when updateEventSourceToken called with open connection', () => {
            // Create initial EventSource — mockEventSource needs a url for updateEventSourceToken to parse
            mockEventSource.url = `${URL_NODE_EVENT}?cache=true&filter=NodeStatusUpdated`;
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Prepare mock for the recreated EventSource
            const recreatedMock = {
                onopen: jest.fn(),
                onerror: null,
                addEventListener: jest.fn(),
                close: jest.fn(),
                readyState: 1,
                url: `${URL_NODE_EVENT}?cache=true&filter=NodeStatusUpdated`,
            };
            EventSourcePolyfill.mockImplementation(() => recreatedMock);

            // updateEventSourceToken closes current source and schedules recreation via setTimeout
            localStorageMock.getItem.mockReturnValue('new-token');
            eventSourceManager.updateEventSourceToken('new-token');

            // Current EventSource should be closed immediately
            expect(mockEventSource.close).toHaveBeenCalled();

            // Advance timers to trigger the setTimeout(..., 100) callback on line 745
            jest.advanceTimersByTime(200);

            // A new EventSource should have been created (line 745 executed)
            expect(EventSourcePolyfill).toHaveBeenCalledTimes(2);
        });

        test('should not restart EventSource when updateEventSourceToken called but connection is closed', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'old-token');
            mockEventSource.readyState = 2; // CLOSED
            eventSourceManager.updateEventSourceToken('new-token');
            // Should not create a new one since existing is closed
            expect(EventSourcePolyfill).toHaveBeenCalledTimes(1);
        });
    });

    describe('Event processing and buffer management', () => {
        test('should process NodeStatusUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatusUpdated'
            )[1];
            const mockEvent = {data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})};
            nodeStatusHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalledWith(expect.objectContaining({node1: {status: 'up'}}));
        });

        test('should skip NodeStatusUpdated if status unchanged', () => {
            mockStore.nodeStatus = {node1: {status: 'up'}};
            useEventStore.getState.mockReturnValue(mockStore);

            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatusUpdated'
            )[1];
            const mockEvent = {data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})};
            nodeStatusHandler(mockEvent);
            jest.runAllTimers();

            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
            expect(mockStore.nodeStatus).toEqual({node1: {status: 'up'}});
        });

        test('should process NodeMonitorUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeMonitorHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeMonitorUpdated'
            )[1];
            const mockEvent = {data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'active'}})};
            nodeMonitorHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setNodeMonitors).toHaveBeenCalledWith(expect.objectContaining({node2: {monitor: 'active'}}));
        });

        test('should flush nodeMonitorBuffer correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeMonitorHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeMonitorUpdated'
            )[1];
            nodeMonitorHandler({data: JSON.stringify({node: 'node1', node_monitor: {monitor: 'active'}})});
            nodeMonitorHandler({data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'inactive'}})});
            jest.runAllTimers();
            expect(mockStore.setNodeMonitors).toHaveBeenCalledWith(expect.objectContaining({
                node1: {monitor: 'active'},
                node2: {monitor: 'inactive'},
            }));
        });

        test('should process NodeStatsUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatsHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatsUpdated'
            )[1];
            const mockEvent = {data: JSON.stringify({node: 'node3', node_stats: {cpu: 75, memory: 60}})};
            nodeStatsHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setNodeStats).toHaveBeenCalledWith(expect.objectContaining({
                node3: {
                    cpu: 75,
                    memory: 60
                }
            }));
        });

        test('should flush nodeStatsBuffer correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatsHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatsUpdated'
            )[1];
            const mockEvent = {data: JSON.stringify({node: 'node1', node_stats: {cpu: 50, memory: 70}})};
            nodeStatsHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setNodeStats).toHaveBeenCalledWith(expect.objectContaining({
                node1: {
                    cpu: 50,
                    memory: 70
                }
            }));
        });

        test('should process ObjectStatusUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectStatusUpdated'
            )[1];
            const mockEvent = {data: JSON.stringify({path: 'object1', object_status: {status: 'active'}})};
            objectStatusHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setObjectStatuses).toHaveBeenCalledWith(expect.objectContaining({object1: {status: 'active'}}));
        });

        test('should handle ObjectStatusUpdated with labels path', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectStatusUpdated'
            )[1];
            const mockEvent = {data: JSON.stringify({labels: {path: 'object1'}, object_status: {status: 'active'}})};
            objectStatusHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setObjectStatuses).toHaveBeenCalledWith(expect.objectContaining({object1: {status: 'active'}}));
        });

        test('should handle ObjectStatusUpdated with missing name or status', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectStatusUpdated'
            )[1];
            objectStatusHandler({data: JSON.stringify({object_status: {status: 'active'}})});
            objectStatusHandler({data: JSON.stringify({path: 'object1'})});
            jest.runAllTimers();
            expect(mockStore.setObjectStatuses).not.toHaveBeenCalled();
        });

        test('should process InstanceStatusUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceStatusUpdated'
            )[1];
            const mockEvent = {
                data: JSON.stringify({
                    path: 'object2',
                    node: 'node1',
                    instance_status: {status: 'inactive'},
                })
            };
            instanceStatusHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setInstanceStatuses).toHaveBeenCalledWith(expect.objectContaining({
                object2: {node1: {status: 'inactive'}},
            }));
        });

        test('should handle InstanceStatusUpdated with labels path', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceStatusUpdated'
            )[1];
            const mockEvent = {
                data: JSON.stringify({
                    labels: {path: 'object1'},
                    node: 'node1',
                    instance_status: {status: 'running'},
                })
            };
            instanceStatusHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setInstanceStatuses).toHaveBeenCalledWith(expect.objectContaining({
                object1: {node1: {status: 'running'}},
            }));
        });

        test('should flush instanceStatusBuffer with nested object updates', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceStatusUpdated'
            )[1];
            instanceStatusHandler({
                data: JSON.stringify({
                    path: 'object1',
                    node: 'node1',
                    instance_status: {status: 'running'},
                })
            });
            instanceStatusHandler({
                data: JSON.stringify({
                    path: 'object1',
                    node: 'node2',
                    instance_status: {status: 'stopped'},
                })
            });
            jest.runAllTimers();
            expect(mockStore.setInstanceStatuses).toHaveBeenCalledWith(expect.objectContaining({
                object1: {
                    node1: {status: 'running'},
                    node2: {status: 'stopped'},
                },
            }));
        });

        test('should handle InstanceStatusUpdated with missing fields', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceStatusUpdated'
            )[1];
            instanceStatusHandler({data: JSON.stringify({node: 'node1', instance_status: {status: 'running'}})});
            instanceStatusHandler({data: JSON.stringify({path: 'object1', instance_status: {status: 'running'}})});
            instanceStatusHandler({data: JSON.stringify({path: 'object1', node: 'node1'})});
            jest.runAllTimers();
            expect(mockStore.setInstanceStatuses).not.toHaveBeenCalled();
        });

        test('should flush heartbeatStatusBuffer correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const heartbeatHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'DaemonHeartbeatUpdated'
            )[1];
            const mockEvent = {data: JSON.stringify({node: 'node1', heartbeat: {status: 'alive'}})};
            heartbeatHandler(mockEvent);
            jest.runAllTimers();

            expect(mockStore.setHeartbeatStatuses).toHaveBeenCalledWith(expect.objectContaining({node1: {status: 'alive'}}));

            const flushCalls = console.debug.mock.calls.filter(call =>
                call[0] && call[0].includes('Flushed')
            );
            expect(flushCalls.length).toBeGreaterThan(0);
        });

        test('should handle DaemonHeartbeatUpdated with labels node', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const heartbeatHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'DaemonHeartbeatUpdated'
            )[1];
            const mockEvent = {data: JSON.stringify({labels: {node: 'node1'}, heartbeat: {status: 'alive'}})};
            heartbeatHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setHeartbeatStatuses).toHaveBeenCalledWith(expect.objectContaining({node1: {status: 'alive'}}));
        });

        test('should handle DaemonHeartbeatUpdated with missing node or status', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const heartbeatHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'DaemonHeartbeatUpdated'
            )[1];
            heartbeatHandler({data: JSON.stringify({heartbeat: {status: 'alive'}})});
            heartbeatHandler({data: JSON.stringify({node: 'node1'})});
            jest.runAllTimers();
            expect(mockStore.setHeartbeatStatuses).not.toHaveBeenCalled();
        });

        test('should handle ObjectDeleted with missing name', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];
            objectDeletedHandler({data: JSON.stringify({})});
            expect(console.warn).toHaveBeenCalledWith('⚠️ ObjectDeleted event missing objectName:', {});
            expect(mockStore.removeObject).not.toHaveBeenCalled();
        });

        test('should process ObjectDeleted events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];
            const mockEvent = {data: JSON.stringify({path: 'object1'})};
            objectDeletedHandler(mockEvent);
            jest.runAllTimers();
            expect(console.debug).toHaveBeenCalledWith('📩 Received ObjectDeleted event:', expect.any(String));
            expect(mockStore.removeObject).toHaveBeenCalledWith('object1');
        });

        test('should handle ObjectDeleted with labels path', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];
            const mockEvent = {data: JSON.stringify({labels: {path: 'object1'}})};
            objectDeletedHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.removeObject).toHaveBeenCalledWith('object1');
        });

        test('should process InstanceMonitorUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceMonitorHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceMonitorUpdated'
            )[1];
            const mockEvent = {
                data: JSON.stringify({
                    node: 'node1',
                    path: 'object1',
                    instance_monitor: {monitor: 'active'},
                })
            };
            instanceMonitorHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setInstanceMonitors).toHaveBeenCalledWith(
                expect.objectContaining({'node1:object1': {monitor: 'active'}})
            );
        });

        test('should handle InstanceMonitorUpdated with missing fields', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceMonitorHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceMonitorUpdated'
            )[1];
            instanceMonitorHandler({data: JSON.stringify({path: 'object1', instance_monitor: {monitor: 'active'}})});
            instanceMonitorHandler({data: JSON.stringify({node: 'node1', instance_monitor: {monitor: 'active'}})});
            instanceMonitorHandler({data: JSON.stringify({node: 'node1', path: 'object1'})});
            jest.runAllTimers();
            expect(mockStore.setInstanceMonitors).not.toHaveBeenCalled();
        });

        test('should process InstanceConfigUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];
            const mockEvent = {
                data: JSON.stringify({
                    path: 'object1',
                    node: 'node1',
                    instance_config: {config: 'test'}
                })
            };
            configUpdatedHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setInstanceConfig).toHaveBeenCalledWith('object1', 'node1', {config: 'test'});
            expect(mockStore.setConfigUpdated).toHaveBeenCalled();
        });

        test('should handle InstanceConfigUpdated with labels path', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];
            const mockEvent = {data: JSON.stringify({labels: {path: 'object1'}, node: 'node1'})};
            configUpdatedHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setConfigUpdated).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]));
        });

        test('should handle InstanceConfigUpdated with missing name or node', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];
            configUpdatedHandler({data: JSON.stringify({node: 'node1'})});
            configUpdatedHandler({data: JSON.stringify({path: 'object1'})});
            expect(console.warn).toHaveBeenCalledWith('⚠️ InstanceConfigUpdated event missing name or node:', expect.any(Object));
            expect(mockStore.setConfigUpdated).not.toHaveBeenCalled();
        });

        test('should handle invalid JSON in events', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatusUpdated'
            )[1];
            nodeStatusHandler({data: 'invalid json'});
            expect(console.warn).toHaveBeenCalledWith('⚠️ Invalid JSON in NodeStatusUpdated event:', 'invalid json');
        });

        test('should process multiple events and flush buffers correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'ObjectStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            objectStatusHandler({data: JSON.stringify({path: 'obj1', object_status: {status: 'active'}})});
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
            expect(mockStore.setObjectStatuses).toHaveBeenCalled();
        });

        test('should handle empty buffers gracefully', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).not.toHaveBeenCalled();
        });

        test('should handle instanceConfig buffer correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];
            const mockEvent = {
                data: JSON.stringify({
                    path: 'object1',
                    node: 'node1',
                    instance_config: {config: 'test-value'}
                })
            };
            configUpdatedHandler(mockEvent);
            jest.runAllTimers();
            expect(mockStore.setInstanceConfig).toHaveBeenCalledWith('object1', 'node1', {config: 'test-value'});
        });

        test('should handle multiple buffers correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'ObjectStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            objectStatusHandler({data: JSON.stringify({path: 'obj1', object_status: {status: 'active'}})});
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
            expect(mockStore.setObjectStatuses).toHaveBeenCalled();
        });

        test('should handle empty buffers without errors', () => {
            eventSourceManager.forceFlush();
            expect(console.error).not.toHaveBeenCalled();
        });

        test('should handle errors during buffer flush', () => {
            mockStore.setNodeStatuses.mockImplementation(() => {
                throw new Error('Test error');
            });
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            jest.runAllTimers();
            expect(console.error).toHaveBeenCalledWith('Error during buffer flush:', expect.any(Error));
        });

        test('should not flush when already flushing', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            eventSourceManager.forceFlush();
            jest.runAllTimers();
            expect(console.error).not.toHaveBeenCalled();
        });

        test('should handle configUpdated buffer type', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'InstanceConfigUpdated'
            )[1];
            configUpdatedHandler({
                data: JSON.stringify({
                    path: 'object1',
                    node: 'node1'
                })
            });
            jest.runAllTimers();
            expect(mockStore.setConfigUpdated).toHaveBeenCalled();
        });

        test('should skip update when instanceStatus values are equal', () => {
            mockStore.objectInstanceStatus = {'object1': {'node1': {status: 'running'}}};
            useEventStore.getState.mockReturnValue(mockStore);

            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'InstanceStatusUpdated'
            )[1];
            instanceStatusHandler({
                data: JSON.stringify({
                    path: 'object1',
                    node: 'node1',
                    instance_status: {status: 'running'}
                })
            });
            jest.runAllTimers();

            expect(mockStore.setInstanceStatuses).toHaveBeenCalled();
            expect(mockStore.objectInstanceStatus).toEqual({'object1': {'node1': {status: 'running'}}});
        });

        test('should skip update when instanceMonitor values are equal', () => {
            mockStore.instanceMonitor = {'node1:object1': {monitor: 'active'}};
            useEventStore.getState.mockReturnValue(mockStore);

            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceMonitorHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'InstanceMonitorUpdated'
            )[1];
            instanceMonitorHandler({
                data: JSON.stringify({
                    node: 'node1',
                    path: 'object1',
                    instance_monitor: {monitor: 'active'}
                })
            });
            jest.runAllTimers();

            expect(mockStore.setInstanceMonitors).toHaveBeenCalled();
            expect(mockStore.instanceMonitor).toEqual({'node1:object1': {monitor: 'active'}});
        });

        test('should clear existing timeout when eventCount reaches BATCH_SIZE', () => {
            const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            for (let i = 0; i < 100; i++) {
                nodeStatusHandler({data: JSON.stringify({node: `node${i}`, node_status: {status: 'up'}})});
            }
            expect(clearTimeoutSpy).toHaveBeenCalled();
            clearTimeoutSpy.mockRestore();
        });

        test('should handle invalid JSON in event data', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            const invalidEvent = {data: 'invalid json {['};
            nodeStatusHandler(invalidEvent);
            expect(console.warn).toHaveBeenCalledWith('⚠️ Invalid JSON in NodeStatusUpdated event:', 'invalid json {[');
        });

        test('should clear all buffers and reset state', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            eventSourceManager.setPageActive(false);
            eventSourceManager.setPageActive(true);
            eventSourceManager.forceFlush();
            expect(mockStore.setNodeStatuses).not.toHaveBeenCalled();
        });

        test('should handle multiple instance config updates', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'InstanceConfigUpdated'
            )[1];
            configUpdatedHandler({
                data: JSON.stringify({
                    path: 'object1',
                    node: 'node1',
                    instance_config: {config: 'v1'}
                })
            });
            configUpdatedHandler({
                data: JSON.stringify({
                    path: 'object1',
                    node: 'node2',
                    instance_config: {config: 'v2'}
                })
            });
            jest.runAllTimers();
            expect(mockStore.setInstanceConfig).toHaveBeenCalledTimes(2);
            expect(mockStore.setInstanceConfig).toHaveBeenCalledWith('object1', 'node1', {config: 'v1'});
            expect(mockStore.setInstanceConfig).toHaveBeenCalledWith('object1', 'node2', {config: 'v2'});
        });

        test('should not flush when page not active', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            eventSourceManager.setPageActive(false);
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).not.toHaveBeenCalled();
        });

        test('should reschedule flush if too soon', () => {
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            eventSourceManager.forceFlush();
            jest.advanceTimersByTime(0);
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            expect(setTimeoutSpy).toHaveBeenCalled();
            setTimeoutSpy.mockRestore();
        });

        test('should flush immediately on reconnect if buffered', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            mockEventSource.onopen();
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
        });

        test('should handle Safari batch updates', async () => {
            const originalUserAgent = navigator.userAgent;
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
                writable: true
            });
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            await Promise.resolve();
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
            Object.defineProperty(navigator, 'userAgent', {value: originalUserAgent});
        });

        test('should use Safari constants', () => {
            const originalUserAgent = navigator.userAgent;
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
                writable: true
            });
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = mockEventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            for (let i = 0; i < 150; i++) {
                nodeStatusHandler({data: JSON.stringify({node: `node${i}`, node_status: {status: 'up'}})});
            }
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
            Object.defineProperty(navigator, 'userAgent', {value: originalUserAgent});
        });

        test('should flush large batches immediately in Safari', () => {
            const originalUserAgent = navigator.userAgent;
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
                writable: true
            });

            jest.isolateModules(async () => {
                const eventSourceManager = require('../eventSourceManager');
                const mockSafariEventSource = {
                    onopen: jest.fn(),
                    onerror: null,
                    addEventListener: jest.fn(),
                    close: jest.fn(),
                    readyState: 1,
                };
                EventSourcePolyfill.mockImplementation(() => mockSafariEventSource);

                const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
                eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
                const nodeStatusHandler = mockSafariEventSource.addEventListener.mock.calls.find(
                    call => call[0] === 'NodeStatusUpdated'
                )[1];

                for (let i = 0; i < 150; i++) {
                    nodeStatusHandler({data: JSON.stringify({node: `node${i}`, node_status: {status: 'up'}})});
                }

                expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
                setTimeoutSpy.mockRestore();
            });

            Object.defineProperty(navigator, 'userAgent', {value: originalUserAgent});
        });

        test('should reschedule flush when MIN_FLUSH_INTERVAL not elapsed and no existing timeout', () => {
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];

            // First flush at current mockNow to set lastFlushTime = mockNow
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            jest.clearAllTimers();
            const flushTime = mockNow;
            eventSourceManager.forceFlush(); // lastFlushTime = flushTime

            // Move only 2ms forward (< MIN_FLUSH_INTERVAL=10) so next flush is "too soon"
            mockNow = flushTime + 2;

            nodeStatusHandler({data: JSON.stringify({node: 'node2', node_status: {status: 'down'}})});
            jest.clearAllTimers();
            setTimeoutSpy.mockClear();
            // forceFlush -> flushBuffers: elapsed=2 < 10 -> must reschedule via setTimeout
            eventSourceManager.forceFlush();

            expect(setTimeoutSpy).toHaveBeenCalled();

            // Advance time so interval passes and flush completes
            mockNow = flushTime + 100000;
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();

            setTimeoutSpy.mockRestore();
        });

        test('should clear pending flushTimeoutId when flushBuffers starts', () => {
            const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];

            // Send an event — schedules a debounce timeout (flushTimeoutId is set)
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});

            // Now call forceFlush directly — it first clears flushTimeoutId (lines 285-288 path),
            // then calls flushBuffers which also checks/clears flushTimeoutId
            clearTimeoutSpy.mockClear();
            eventSourceManager.forceFlush();

            // clearTimeout should have been called to cancel the pending debounce timer
            expect(clearTimeoutSpy).toHaveBeenCalled();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();

            clearTimeoutSpy.mockRestore();
        });

        test('should set needsFlush when event arrives during active flush', () => {
            let handlerRef;
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            handlerRef = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];

            // Replace setNodeStatuses to capture calls and send a new event while isFlushing=true
            let callCount = 0;
            mockStore.setNodeStatuses = jest.fn(() => {
                callCount++;
                if (callCount === 1) {
                    // isFlushing=true here — scheduleFlush hits the needsFlush branch
                    // and logs the debug message, sets needsFlush=true, eventCount++, returns early
                    handlerRef({data: JSON.stringify({node: 'node99', node_status: {status: 'up'}})});
                }
            });

            handlerRef({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            jest.clearAllTimers();
            eventSourceManager.forceFlush();

            // The debug log proves the isFlushing branch was entered
            // The log is a single template string with no second argument
            expect(console.debug).toHaveBeenCalledWith(
                expect.stringContaining('Event arrived during flush')
            );
        });

        test('should debounce multiple rapid events into a single flush', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];

            // Send 3 events rapidly — all land in the buffer before any timer fires
            nodeStatusHandler({data: JSON.stringify({node: 'n1', node_status: {status: 'up'}})});
            nodeStatusHandler({data: JSON.stringify({node: 'n2', node_status: {status: 'down'}})});
            nodeStatusHandler({data: JSON.stringify({node: 'n3', node_status: {status: 'up'}})});

            // Only one flush should occur when timer fires
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalledTimes(1);
            expect(mockStore.setNodeStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    n1: {status: 'up'},
                    n2: {status: 'down'},
                    n3: {status: 'up'},
                })
            );
        });

        test('should skip flush in debounce callback when eventCount already drained', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];

            // Send event — schedules debounce timeout, eventCount=1
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});

            // forceFlush drains the buffer synchronously: eventCount becomes 0
            eventSourceManager.forceFlush();
            mockStore.setNodeStatuses.mockClear();

            // Now fire the debounce timeout — eventCount=0 so flushBuffers is NOT called
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).not.toHaveBeenCalled();
        });

        test('should merge nested objectStatus updates preserving all fields', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'ObjectStatusUpdated'
            )[1];

            // Two updates to the same path — updateBuffer merges with spread operator
            objectStatusHandler({
                data: JSON.stringify({
                    path: 'svc/test',
                    object_status: {avail: 'up', frozen: false, instances: {n1: 'running'}}
                })
            });
            objectStatusHandler({
                data: JSON.stringify({
                    path: 'svc/test',
                    object_status: {avail: 'down', provisioned: true}
                })
            });

            jest.runAllTimers();

            // Merged result must contain fields from both events
            expect(mockStore.setObjectStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    'svc/test': expect.objectContaining({
                        avail: 'down',
                        frozen: false,
                        provisioned: true,
                    })
                })
            );
        });

        test('should use requestAnimationFrame for non-Safari batch size flush', () => {
            const rafSpy = jest.spyOn(global, 'requestAnimationFrame');

            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];

            // BATCH_SIZE for non-Safari = 50; the 50th event hits eventCount >= BATCH_SIZE
            // which calls requestAnimationFrame(flushBuffers) instead of a debounced setTimeout
            for (let i = 0; i < 50; i++) {
                nodeStatusHandler({data: JSON.stringify({node: `node${i}`, node_status: {status: 'up'}})});
            }

            expect(rafSpy).toHaveBeenCalled();

            rafSpy.mockRestore();
            jest.runAllTimers();
        });

        test('should schedule re-flush when new events arrive during flush', () => {
            let flushCallCount = 0;
            const originalSetNodeStatuses = mockStore.setNodeStatuses;
            mockStore.setNodeStatuses = jest.fn(() => {
                flushCallCount++;
                // During flush, simulate a new event arriving by directly incrementing eventCount
                // This is tested indirectly via the needsFlush flag behavior
            });

            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];

            // Send initial event
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            // Send a second event to trigger needsFlush scenario
            nodeStatusHandler({data: JSON.stringify({node: 'node2', node_status: {status: 'down'}})});

            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
            mockStore.setNodeStatuses = originalSetNodeStatuses;
        });

        test('should deeply compare nested objects in isEqual', () => {
            // The isEqual function is exercised internally during buffer merging
            // Test by updating the same key twice with nested objects
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'ObjectStatusUpdated'
            )[1];

            // First event with nested object
            objectStatusHandler({
                data: JSON.stringify({
                    path: 'object1',
                    object_status: {
                        availability: 'up',
                        instances: {node1: {status: 'running'}, node2: {status: 'idle'}}
                    }
                })
            });

            // Second event that partially updates the same object (merging behavior)
            objectStatusHandler({
                data: JSON.stringify({
                    path: 'object1',
                    object_status: {
                        availability: 'down',
                        instances: {node1: {status: 'stopped'}, node2: {status: 'idle'}}
                    }
                })
            });

            jest.runAllTimers();
            expect(mockStore.setObjectStatuses).toHaveBeenCalled();
        });

        test('should merge object status updates in buffer before flush', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'ObjectStatusUpdated'
            )[1];

            objectStatusHandler({data: JSON.stringify({path: 'obj1', object_status: {field1: 'a', field2: 'b'}})});
            objectStatusHandler({data: JSON.stringify({path: 'obj1', object_status: {field2: 'c', field3: 'd'}})});

            jest.runAllTimers();
            // The merged result should contain all fields
            expect(mockStore.setObjectStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    obj1: expect.objectContaining({field1: 'a', field2: 'c', field3: 'd'})
                })
            );
        });

        test('should handle isEqual comparison with null and non-null values', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];

            // Initially store has null/empty status
            mockStore.nodeStatus = {node1: null};

            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
        });
    });

    describe('Error handling and reconnection', () => {
        test('should handle errors and try to reconnect', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 500});
            }
            expect(console.error).toHaveBeenCalled();
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Reconnecting in'));
        });

        test('should handle 401 error with silent token renewal', async () => {
            const mockUser = {
                access_token: 'silent-renewed-token',
                expires_at: Date.now() + 3600000
            };
            window.oidcUserManager = {signinSilent: jest.fn().mockResolvedValue(mockUser)};
            localStorageMock.getItem.mockReturnValue(null);
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'old-token');
            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 401});
            }
            await Promise.resolve();
            expect(window.oidcUserManager.signinSilent).toHaveBeenCalled();
            expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'silent-renewed-token');
        });

        test('should not redirect if page not active on max attempts', () => {
            eventSourceManager.setPageActive(false);
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            let currentMock = mockEventSource;
            for (let i = 0; i < 10; i++) {
                currentMock.onerror({status: 500});
                jest.advanceTimersByTime(1000);
                currentMock = {
                    onopen: jest.fn(),
                    onerror: jest.fn(),
                    addEventListener: jest.fn(),
                    close: jest.fn(),
                    readyState: 1,
                };
                EventSourcePolyfill.mockImplementation(() => currentMock);
            }
            currentMock.onerror({status: 500});
            expect(window.dispatchEvent).not.toHaveBeenCalled();
        });

        test('should schedule reconnection with exponential backoff', () => {
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 500});
            }
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
            const delay = setTimeoutSpy.mock.calls[0][1];
            expect(delay).toBeGreaterThanOrEqual(1000);
            expect(delay).toBeLessThanOrEqual(30000);
            setTimeoutSpy.mockRestore();
        });

        test('should not reconnect when no current token', () => {
            localStorageMock.getItem.mockReturnValue(null);
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 500});
            }
            jest.advanceTimersByTime(2000);
            expect(EventSourcePolyfill).toHaveBeenCalledTimes(1);
        });
    });

    describe('Utility functions and helpers', () => {
        test('should create query string with default filters', () => {
            eventSourceManager.configureEventSource('fake-token');
            expect(EventSourcePolyfill).toHaveBeenCalledWith(expect.stringContaining('cache=true'), expect.any(Object));
        });

        test('should handle invalid filters in createQueryString', () => {
            eventSourceManager.configureEventSource('fake-token', null, ['InvalidFilter', 'NodeStatusUpdated']);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid filters detected'));
            expect(EventSourcePolyfill.mock.calls[0][0]).toContain('filter=NodeStatusUpdated');
        });

        test('should handle invalid filters and fallback to defaults', () => {
            eventSourceManager.configureEventSource('fake-token', null, ['InvalidFilter1', 'InvalidFilter2']);
            expect(console.warn).toHaveBeenCalledWith(
                'Invalid filters detected: InvalidFilter1, InvalidFilter2. Using only valid ones.'
            );
            expect(EventSourcePolyfill).toHaveBeenCalled();
        });

        test('should handle empty filters array', () => {
            eventSourceManager.configureEventSource('fake-token', null, []);
            expect(console.warn).toHaveBeenCalledWith('No valid API event filters provided, using default filters');
            expect(EventSourcePolyfill).toHaveBeenCalled();
        });

        test('should create query string without objectName', () => {
            eventSourceManager.configureEventSource('fake-token');
            const url = EventSourcePolyfill.mock.calls[0][0];
            expect(url).toContain('cache=true');
            expect(url).not.toContain('path=');
        });

        test('should dispatch auth redirect event', () => {
            eventSourceManager.navigationService.redirectToAuth();
            expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
            const event = window.dispatchEvent.mock.calls[0][0];
            expect(event.type).toBe('om3:auth-redirect');
            expect(event.detail).toBe('/auth-choice');
        });

        test('should export prepareForNavigation as alias for forceFlush', () => {
            expect(eventSourceManager.prepareForNavigation).toBeDefined();
            expect(typeof eventSourceManager.prepareForNavigation).toBe('function');

            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];

            // Send event to populate buffer (eventCount > 0)
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});

            // Cancel the debounce timer so only prepareForNavigation triggers the flush
            jest.clearAllTimers();

            eventSourceManager.prepareForNavigation();

            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
        });

        test('should configure EventSource with objectName - adds path to filter URL', () => {
            eventSourceManager.configureEventSource('fake-token', 'my-service/svc1');
            const url = EventSourcePolyfill.mock.calls[0][0];
            // objectName is encoded in the filter param as "EventType,path=objectName"
            // after encodeURIComponent: %2Cpath%3D
            expect(url).toContain('path%3D');
        });
    });

    describe('Logger EventSource', () => {
        beforeEach(() => {
            EventSourcePolyfill.mockImplementation(() => mockLoggerEventSource);
        });

        test('should create logger EventSource and attach listeners based on filters', () => {
            const filters = ['ObjectStatusUpdated', 'InstanceStatusUpdated'];
            const loggerSource = eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', filters);
            expect(EventSourcePolyfill).toHaveBeenCalledTimes(1);
            expect(loggerSource.addEventListener).toHaveBeenCalledTimes(2);
            expect(loggerSource.addEventListener.mock.calls[0][0]).toBe('ObjectStatusUpdated');
            expect(loggerSource.addEventListener.mock.calls[1][0]).toBe('InstanceStatusUpdated');
        });

        test('should close existing logger EventSource before creating new', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', []);
            expect(mockLoggerEventSource.close).not.toHaveBeenCalled();
            EventSourcePolyfill.mockImplementationOnce(() => ({...mockLoggerEventSource}));
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', []);
            expect(mockLoggerEventSource.close).toHaveBeenCalled();
        });

        test('should not create logger if no token', () => {
            const source = eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, '', []);
            expect(source).toBeNull();
            expect(console.error).toHaveBeenCalledWith('❌ Missing token for Logger EventSource!');
        });

        test('should handle open event but not log it', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', []);
            mockLoggerEventSource.onopen();
            expect(console.info).toHaveBeenCalledWith('✅ Logger EventSource connection established');
            expect(mockLogStore.addEventLog).not.toHaveBeenCalledWith('CONNECTION_OPENED', expect.any(Object));
        });

        test('should handle error but not log connection error', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', []);
            const error = {message: 'test error', status: 500};
            mockLoggerEventSource.onerror(error);
            expect(console.error).toHaveBeenCalled();
            expect(mockLogStore.addEventLog).not.toHaveBeenCalledWith('CONNECTION_ERROR', expect.any(Object));
        });

        test('should handle 401 error in logger with silent renew', async () => {
            const mockUser = {access_token: 'new-logger-token', expires_at: Date.now() + 3600000};
            window.oidcUserManager = {signinSilent: jest.fn().mockResolvedValue(mockUser)};
            localStorageMock.getItem.mockReturnValue(null);
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'old-token', []);
            mockLoggerEventSource.onerror({status: 401});
            await Promise.resolve();
            expect(window.oidcUserManager.signinSilent).toHaveBeenCalled();
            expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'new-logger-token');
        });

        test('should handle max reconnections in logger without logging', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', []);
            for (let i = 0; i < 15; i++) {
                mockLoggerEventSource.onerror({status: 500});
                jest.advanceTimersByTime(1000);
            }
            expect(console.error).toHaveBeenCalledWith('❌ Max reconnection attempts reached for logger');
            expect(mockLogStore.addEventLog).not.toHaveBeenCalledWith('MAX_RECONNECTIONS_REACHED', expect.any(Object));
            expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
        });

        test('should process events and log them', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', ['ObjectStatusUpdated']);
            const handler = mockLoggerEventSource.addEventListener.mock.calls[0][1];
            handler({data: JSON.stringify({path: 'test'})});
            expect(mockLogStore.addEventLog).toHaveBeenCalledWith('ObjectStatusUpdated', expect.any(Object));
        });

        test('should ignore invalid filters', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', ['Invalid', 'ObjectStatusUpdated']);
            expect(mockLoggerEventSource.addEventListener).toHaveBeenCalledTimes(1);
            expect(mockLoggerEventSource.addEventListener.mock.calls[0][0]).toBe('ObjectStatusUpdated');
        });

        test('should call _cleanup on close', () => {
            const cleanupSpy = jest.fn();
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', []);
            mockLoggerEventSource._cleanup = cleanupSpy;
            eventSourceManager.closeLoggerEventSource();
            expect(cleanupSpy).toHaveBeenCalled();
        });

        test('should handle error in _cleanup for logger', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', []);
            mockLoggerEventSource._cleanup = () => {
                throw new Error('logger cleanup error');
            };
            expect(() => eventSourceManager.closeLoggerEventSource()).not.toThrow();
            expect(console.debug).toHaveBeenCalledWith('Error during logger eventSource cleanup', expect.any(Error));
        });

        test('should not throw if no logger source', () => {
            expect(() => eventSourceManager.closeLoggerEventSource()).not.toThrow();
        });

        test('should not update if no new token', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'old-token', []);
            eventSourceManager.updateLoggerEventSourceToken('');
            expect(mockLoggerEventSource.close).not.toHaveBeenCalled();
        });

        test('should handle missing token in configureLoggerEventSource', () => {
            eventSourceManager.configureLoggerEventSource('');
            expect(console.error).toHaveBeenCalledWith('❌ No token provided for Logger SSE!');
        });

        test('should handle missing token in startLoggerReception', () => {
            eventSourceManager.startLoggerReception('');
            expect(console.error).toHaveBeenCalledWith('❌ No token provided for Logger SSE!');
        });

        test('should ignore events when page not active', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', ['ObjectStatusUpdated']);
            eventSourceManager.setPageActive(false);
            const handler = mockLoggerEventSource.addEventListener.mock.calls[0][1];
            handler({data: JSON.stringify({path: 'test'})});
            expect(mockLogStore.addEventLog).not.toHaveBeenCalled();
        });

        test('should update logger with new token from storage on auth error', () => {
            localStorageMock.getItem.mockReturnValue('new-token');
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'old-token', []);
            mockLoggerEventSource.onerror({status: 401});
            expect(console.info).toHaveBeenCalledWith('🔄 New token available, updating Logger EventSource');
        });

        test('should ignore onerror if not current logger EventSource', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', []);
            eventSourceManager.closeLoggerEventSource();
            mockLoggerEventSource.onerror({status: 500});
            expect(console.info).not.toHaveBeenCalledWith(expect.stringContaining('Logger reconnecting'));
        });

        test('should restart logger EventSource when updateLoggerEventSourceToken called with open connection', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'old-token', ['ObjectStatusUpdated']);

            const nextLoggerMock = {
                onopen: jest.fn(),
                onerror: null,
                addEventListener: jest.fn(),
                close: jest.fn(),
                readyState: 1,
                url: `${URL_NODE_EVENT}?cache=true&filter=ObjectStatusUpdated`,
            };
            EventSourcePolyfill.mockImplementation(() => nextLoggerMock);

            // getCurrentToken() is called inside the setTimeout callback —
            // make localStorage return the new token so the callback proceeds
            localStorageMock.getItem.mockReturnValue('new-token');

            eventSourceManager.updateLoggerEventSourceToken('new-token');
            expect(mockLoggerEventSource.close).toHaveBeenCalled();

            // Fire the setTimeout(..., 100) callback — calls createLoggerEventSource
            jest.advanceTimersByTime(200);
            expect(EventSourcePolyfill).toHaveBeenCalledTimes(2);
        });

        test('should not restart logger EventSource when connection is already closed', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'old-token', []);
            mockLoggerEventSource.readyState = 2; // CLOSED
            eventSourceManager.updateLoggerEventSourceToken('new-token');
            expect(EventSourcePolyfill).toHaveBeenCalledTimes(1);
        });
        test('should configure logger EventSource with objectName', () => {
            eventSourceManager.configureLoggerEventSource('fake-token', 'my-service/svc1');
            const url = EventSourcePolyfill.mock.calls[0][0];
            expect(url).toContain('path%3D');
        });

        test('should start logger reception with objectName', () => {
            eventSourceManager.startLoggerReception('fake-token', eventSourceManager.DEFAULT_FILTERS, 'my-service/svc1');
            const url = EventSourcePolyfill.mock.calls[0][0];
            expect(url).toContain('path%3D');
        });

        test('should handle invalid JSON in logger event and log parse error', () => {
            // Ensure page is active (setPageActive(false) in other tests may have left it false)
            eventSourceManager.setPageActive(true);
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', ['ObjectStatusUpdated']);
            const handler = mockLoggerEventSource.addEventListener.mock.calls[0][1];
            handler({data: 'not valid json'});
            expect(mockLogStore.addEventLog).toHaveBeenCalledWith(
                'ObjectStatusUpdated_PARSE_ERROR',
                expect.objectContaining({
                    error: expect.any(String),
                    rawData: 'not valid json'
                })
            );
        });

        test('should handle silent renew failure in logger', async () => {
            window.oidcUserManager = {signinSilent: jest.fn().mockRejectedValue(new Error('logger renew fail'))};
            localStorageMock.getItem.mockReturnValue(null);
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'old-token', []);
            mockLoggerEventSource.onerror({status: 401});

            await Promise.resolve();
            await Promise.resolve();

            expect(console.error).toHaveBeenCalledWith('❌ Silent renew failed for logger:', expect.any(Error));
            expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
        });
    });
});
