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

// Helper function to test isEqual since it's not exported
const testIsEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    return JSON.stringify(a) === JSON.stringify(b);
};

describe('eventSourceManager', () => {
    let mockStore;
    let mockLogStore;
    let mockEventSource;
    let mockLoggerEventSource;
    let originalConsole;
    let localStorageMock;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup complete mock store
        mockStore = {
            nodeStatus: {},
            nodeMonitor: {},
            nodeStats: {},
            objectStatus: {},
            objectInstanceStatus: {},
            heartbeatStatus: {},
            instanceMonitor: {},
            configUpdates: [],
            setNodeStatuses: jest.fn(),
            setNodeMonitors: jest.fn(),
            setNodeStats: jest.fn(),
            setObjectStatuses: jest.fn(),
            setInstanceStatuses: jest.fn(),
            setHeartbeatStatuses: jest.fn(),
            setInstanceMonitors: jest.fn(),
            removeObject: jest.fn(),
            setConfigUpdated: jest.fn(),
            setInstanceConfig: jest.fn(),
        };

        useEventStore.getState.mockReturnValue(mockStore);

        mockLogStore = {
            addEventLog: jest.fn(),
        };

        useEventLogStore.getState.mockReturnValue(mockLogStore);

        // Create a consistent mock EventSource
        mockEventSource = {
            onopen: jest.fn(),
            onerror: null, // Will be set by createEventSource
            addEventListener: jest.fn(),
            close: jest.fn(),
            readyState: 1, // OPEN state
        };

        mockLoggerEventSource = {
            onopen: jest.fn(),
            onerror: null,
            addEventListener: jest.fn(),
            close: jest.fn(),
            readyState: 1,
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

        // Mock console methods
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
        console.info = jest.fn();
        console.debug = jest.fn();

        // Mock window.location
        delete window.location;
        window.location = {href: ''};
        window.oidcUserManager = null;

        // Mock dispatchEvent
        window.dispatchEvent = jest.fn();
    });

    afterEach(() => {
        jest.clearAllTimers();
        // Restore console methods
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.info = originalConsole.info;
        console.debug = originalConsole.debug;

        // Reset module state
        eventSourceManager.closeEventSource();
        eventSourceManager.closeLoggerEventSource();
        delete window.oidcUserManager;
    });

    describe('createEventSource', () => {
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

        test('should process NodeStatusUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            // Get the NodeStatusUpdated handler
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatusUpdated'
            )[1];

            // Simulate event
            const mockEvent = {data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})};
            nodeStatusHandler(mockEvent);

            // Fast-forward timers to flush the buffer
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    node1: {status: 'up'},
                })
            );
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
            expect(mockStore.setNodeStatuses).not.toHaveBeenCalled();
        });

        test('should process NodeMonitorUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            // Get the NodeMonitorUpdated handler
            const nodeMonitorHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeMonitorUpdated'
            )[1];

            // Simulate event
            const mockEvent = {data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'active'}})};
            nodeMonitorHandler(mockEvent);

            // Fast-forward timers to flush the buffer
            jest.runAllTimers();
            expect(mockStore.setNodeMonitors).toHaveBeenCalledWith(
                expect.objectContaining({
                    node2: {monitor: 'active'},
                })
            );
        });

        test('should flush nodeMonitorBuffer correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeMonitorHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeMonitorUpdated'
            )[1];

            // Simulate multiple NodeMonitorUpdated events
            nodeMonitorHandler({data: JSON.stringify({node: 'node1', node_monitor: {monitor: 'active'}})});
            nodeMonitorHandler({data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'inactive'}})});

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setNodeMonitors).toHaveBeenCalledWith(
                expect.objectContaining({
                    node1: {monitor: 'active'},
                    node2: {monitor: 'inactive'},
                })
            );
        });

        test('should process NodeStatsUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            // Get the NodeStatsUpdated handler
            const nodeStatsHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatsUpdated'
            )[1];

            // Simulate event
            const mockEvent = {data: JSON.stringify({node: 'node3', node_stats: {cpu: 75, memory: 60}})};
            nodeStatsHandler(mockEvent);

            // Fast-forward timers to flush the buffer
            jest.runAllTimers();
            expect(mockStore.setNodeStats).toHaveBeenCalledWith(
                expect.objectContaining({
                    node3: {cpu: 75, memory: 60},
                })
            );
        });

        test('should flush nodeStatsBuffer correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatsHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatsUpdated'
            )[1];

            // Simulate NodeStatsUpdated events
            const mockEvent = {data: JSON.stringify({node: 'node1', node_stats: {cpu: 50, memory: 70}})};
            nodeStatsHandler(mockEvent);

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setNodeStats).toHaveBeenCalledWith(
                expect.objectContaining({
                    node1: {cpu: 50, memory: 70},
                })
            );
        });

        test('should process ObjectStatusUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            // Get the ObjectStatusUpdated handler
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectStatusUpdated'
            )[1];

            // Simulate event
            const mockEvent = {data: JSON.stringify({path: 'object1', object_status: {status: 'active'}})};
            objectStatusHandler(mockEvent);

            // Fast-forward timers to flush the buffer
            jest.runAllTimers();
            expect(mockStore.setObjectStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    object1: {status: 'active'},
                })
            );
        });

        test('should handle ObjectStatusUpdated with labels path', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectStatusUpdated'
            )[1];

            // Simulate event with labels path
            const mockEvent = {data: JSON.stringify({labels: {path: 'object1'}, object_status: {status: 'active'}})};
            objectStatusHandler(mockEvent);

            jest.runAllTimers();
            expect(mockStore.setObjectStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    object1: {status: 'active'},
                })
            );
        });

        test('should handle ObjectStatusUpdated with missing name or status', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectStatusUpdated'
            )[1];

            // Simulate event with missing name
            objectStatusHandler({data: JSON.stringify({object_status: {status: 'active'}})});

            // Simulate event with missing status
            objectStatusHandler({data: JSON.stringify({path: 'object1'})});

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setObjectStatuses).not.toHaveBeenCalled();
        });

        test('should process InstanceStatusUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            // Get the InstanceStatusUpdated handler
            const instanceStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceStatusUpdated'
            )[1];

            // Simulate event
            const mockEvent = {
                data: JSON.stringify({
                    path: 'object2',
                    node: 'node1',
                    instance_status: {status: 'inactive'},
                })
            };
            instanceStatusHandler(mockEvent);

            // Fast-forward timers to flush the buffer
            jest.runAllTimers();
            expect(mockStore.setInstanceStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    object2: {node1: {status: 'inactive'}},
                })
            );
        });

        test('should handle InstanceStatusUpdated with labels path', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceStatusUpdated'
            )[1];

            // Simulate event with labels path
            const mockEvent = {
                data: JSON.stringify({
                    labels: {path: 'object1'},
                    node: 'node1',
                    instance_status: {status: 'running'},
                })
            };
            instanceStatusHandler(mockEvent);

            jest.runAllTimers();
            expect(mockStore.setInstanceStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    object1: {node1: {status: 'running'}},
                })
            );
        });

        test('should flush instanceStatusBuffer with nested object updates', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceStatusUpdated'
            )[1];

            // Simulate multiple InstanceStatusUpdated events
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

            // Fast-forward timers to flush the buffer
            jest.runAllTimers();
            expect(mockStore.setInstanceStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    object1: {
                        node1: {status: 'running'},
                        node2: {status: 'stopped'},
                    },
                })
            );
        });

        test('should handle InstanceStatusUpdated with missing fields', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceStatusUpdated'
            )[1];

            // Simulate event with missing name
            instanceStatusHandler({data: JSON.stringify({node: 'node1', instance_status: {status: 'running'}})});

            // Simulate event with missing node
            instanceStatusHandler({data: JSON.stringify({path: 'object1', instance_status: {status: 'running'}})});

            // Simulate event with missing instance_status
            instanceStatusHandler({data: JSON.stringify({path: 'object1', node: 'node1'})});

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setInstanceStatuses).not.toHaveBeenCalled();
        });

        test('should flush heartbeatStatusBuffer correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const heartbeatHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'DaemonHeartbeatUpdated'
            )[1];

            // Simulate DaemonHeartbeatUpdated event
            const mockEvent = {data: JSON.stringify({node: 'node1', heartbeat: {status: 'alive'}})};
            heartbeatHandler(mockEvent);

            // Fast-forward timers
            jest.runAllTimers();
            expect(console.debug).toHaveBeenCalledWith('buffer:', expect.objectContaining({
                node1: {status: 'alive'},
            }));
            expect(mockStore.setHeartbeatStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    node1: {status: 'alive'},
                })
            );
        });

        test('should handle DaemonHeartbeatUpdated with labels node', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const heartbeatHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'DaemonHeartbeatUpdated'
            )[1];

            // Simulate event with labels node
            const mockEvent = {data: JSON.stringify({labels: {node: 'node1'}, heartbeat: {status: 'alive'}})};
            heartbeatHandler(mockEvent);

            jest.runAllTimers();
            expect(mockStore.setHeartbeatStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    node1: {status: 'alive'},
                })
            );
        });

        test('should handle DaemonHeartbeatUpdated with missing node or status', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const heartbeatHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'DaemonHeartbeatUpdated'
            )[1];

            // Simulate event with missing node
            heartbeatHandler({data: JSON.stringify({heartbeat: {status: 'alive'}})});

            // Simulate event with missing status
            heartbeatHandler({data: JSON.stringify({node: 'node1'})});

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setHeartbeatStatuses).not.toHaveBeenCalled();
        });

        test('should handle ObjectDeleted with missing name', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];

            // Simulate event with missing name
            objectDeletedHandler({data: JSON.stringify({})});

            expect(console.warn).toHaveBeenCalledWith('⚠️ ObjectDeleted event missing objectName:', {});
            expect(mockStore.removeObject).not.toHaveBeenCalled();
        });

        test('should process ObjectDeleted events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];

            // Simulate event
            const mockEvent = {data: JSON.stringify({path: 'object1'})};
            objectDeletedHandler(mockEvent);

            // Fast-forward timers
            jest.runAllTimers();
            expect(console.debug).toHaveBeenCalledWith('📩 Received ObjectDeleted event:', expect.any(String));
            expect(mockStore.removeObject).toHaveBeenCalledWith('object1');
        });

        test('should handle ObjectDeleted with labels path', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];

            // Simulate event with labels path
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

            // Simulate event
            const mockEvent = {
                data: JSON.stringify({
                    node: 'node1',
                    path: 'object1',
                    instance_monitor: {monitor: 'active'},
                })
            };
            instanceMonitorHandler(mockEvent);

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setInstanceMonitors).toHaveBeenCalledWith(
                expect.objectContaining({
                    'node1:object1': {monitor: 'active'},
                })
            );
        });

        test('should handle InstanceMonitorUpdated with missing fields', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceMonitorHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceMonitorUpdated'
            )[1];

            // Simulate event with missing node
            instanceMonitorHandler({data: JSON.stringify({path: 'object1', instance_monitor: {monitor: 'active'}})});

            // Simulate event with missing path
            instanceMonitorHandler({data: JSON.stringify({node: 'node1', instance_monitor: {monitor: 'active'}})});

            // Simulate event with missing instance_monitor
            instanceMonitorHandler({data: JSON.stringify({node: 'node1', path: 'object1'})});

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setInstanceMonitors).not.toHaveBeenCalled();
        });

        test('should process InstanceConfigUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];

            // Simulate event
            const mockEvent = {
                data: JSON.stringify({
                    path: 'object1',
                    node: 'node1',
                    instance_config: {config: 'test'}
                })
            };
            configUpdatedHandler(mockEvent);

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setInstanceConfig).toHaveBeenCalledWith('object1', 'node1', {config: 'test'});
            expect(mockStore.setConfigUpdated).toHaveBeenCalled();
        });

        test('should handle InstanceConfigUpdated with labels path', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];

            // Simulate event with labels path
            const mockEvent = {data: JSON.stringify({labels: {path: 'object1'}, node: 'node1'})};
            configUpdatedHandler(mockEvent);

            jest.runAllTimers();
            expect(mockStore.setConfigUpdated).toHaveBeenCalledWith(
                expect.arrayContaining([expect.any(String)])
            );
        });

        test('should handle InstanceConfigUpdated with missing name or node', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];

            // Simulate event with missing name
            configUpdatedHandler({data: JSON.stringify({node: 'node1'})});

            // Simulate event with missing node
            configUpdatedHandler({data: JSON.stringify({path: 'object1'})});

            expect(console.warn).toHaveBeenCalledWith(
                '⚠️ InstanceConfigUpdated event missing name or node:',
                expect.any(Object)
            );
            expect(mockStore.setConfigUpdated).not.toHaveBeenCalled();
        });

        test('should handle invalid JSON in events', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatusUpdated'
            )[1];

            // Simulate event with invalid JSON
            nodeStatusHandler({data: 'invalid json'});

            expect(console.warn).toHaveBeenCalledWith('⚠️ Invalid JSON in NodeStatusUpdated event:', 'invalid json');
        });

        test('should handle errors and try to reconnect', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            // Trigger error handler
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

            window.oidcUserManager = {
                signinSilent: jest.fn().mockResolvedValue(mockUser)
            };

            localStorageMock.getItem.mockReturnValue(null);

            eventSourceManager.createEventSource(URL_NODE_EVENT, 'old-token');

            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 401});
            }

            // Wait for silent renew to complete
            await Promise.resolve();

            expect(window.oidcUserManager.signinSilent).toHaveBeenCalled();
            expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'silent-renewed-token');
        });

        test('should handle max reconnection attempts reached', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Trigger error handler multiple times to exceed max attempts
            for (let i = 0; i < 15; i++) {
                if (mockEventSource.onerror) {
                    mockEventSource.onerror({status: 500});
                }
                jest.advanceTimersByTime(1000);
            }

            expect(console.error).toHaveBeenCalledWith('❌ Max reconnection attempts reached');
            expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
        });

        test('should schedule reconnection with exponential backoff', () => {
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            if (mockEventSource.onerror) {
                mockEventSource.onerror({status: 500});
            }

            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));

            // Verify the delay is within expected bounds
            const delay = setTimeoutSpy.mock.calls[0][1];
            expect(delay).toBeGreaterThanOrEqual(1000);
            expect(delay).toBeLessThanOrEqual(30000);

            setTimeoutSpy.mockRestore();
        });

        test('should not create EventSource if no token is provided', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, '');

            expect(eventSource).toBeNull();
            expect(console.error).toHaveBeenCalledWith('❌ Missing token for EventSource!');
        });

        test('should process multiple events and flush buffers correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Get handlers for different event types
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'ObjectStatusUpdated'
            )[1];

            // Trigger multiple events
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            objectStatusHandler({data: JSON.stringify({path: 'obj1', object_status: {status: 'active'}})});

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
            expect(mockStore.setObjectStatuses).toHaveBeenCalled();
        });

        test('should handle empty buffers gracefully', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Fast-forward timers without any events
            jest.runAllTimers();

            // Verify no errors occurred and store methods weren't called unnecessarily
            expect(mockStore.setNodeStatuses).not.toHaveBeenCalled();
        });

        test('should handle instanceConfig buffer correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];

            // Simulate InstanceConfigUpdated event with instance_config
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
    });

    describe('closeEventSource', () => {
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
    });

    describe('getCurrentToken', () => {
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
    });

    describe('updateEventSourceToken', () => {
        test('should not update if no new token provided', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'old-token');
            eventSourceManager.updateEventSourceToken('');
            expect(mockEventSource.close).not.toHaveBeenCalled();
        });
    });

    describe('configureEventSource', () => {
        test('should handle missing token in configureEventSource', () => {
            eventSourceManager.configureEventSource('');
            expect(console.error).toHaveBeenCalledWith('❌ No token provided for SSE!');
        });

        test('should configure EventSource with objectName and custom filters', () => {
            const customFilters = ['NodeStatusUpdated', 'ObjectStatusUpdated'];
            eventSourceManager.configureEventSource('fake-token', 'test-object', customFilters);

            expect(EventSourcePolyfill).toHaveBeenCalled();
        });

        test('should configure EventSource without objectName', () => {
            eventSourceManager.configureEventSource('fake-token');

            expect(EventSourcePolyfill).toHaveBeenCalled();
            expect(EventSourcePolyfill.mock.calls[0][0]).toContain('cache=true');
        });
    });

    describe('startEventReception', () => {
        test('should confirm startEventReception is defined', () => {
            expect(eventSourceManager.startEventReception).toBeDefined();
        });

        test('should create an EventSource with valid token', () => {
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

        test('should close previous EventSource before creating a new one', () => {
            // First call
            eventSourceManager.startEventReception('fake-token');

            // Create a new mock for the second EventSource
            const secondMockEventSource = {
                onopen: jest.fn(),
                onerror: null,
                addEventListener: jest.fn(),
                close: jest.fn(),
                readyState: 1,
            };
            EventSourcePolyfill.mockImplementationOnce(() => secondMockEventSource);

            // Second call
            eventSourceManager.startEventReception('fake-token');

            // Verify the first EventSource was closed
            expect(mockEventSource.close).toHaveBeenCalled();
            // Verify a new EventSource was created
            expect(EventSourcePolyfill).toHaveBeenCalledTimes(2);
        });

        test('should handle missing token', () => {
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
    });

    describe('isEqual function', () => {
        test('should return true for identical primitives', () => {
            expect(testIsEqual('test', 'test')).toBe(true);
            expect(testIsEqual(123, 123)).toBe(true);
            expect(testIsEqual(null, null)).toBe(true);
        });

        test('should return false for different primitives', () => {
            expect(testIsEqual('test', 'different')).toBe(false);
            expect(testIsEqual(123, 456)).toBe(false);
        });

        test('should return true for identical objects', () => {
            const obj1 = {a: 1, b: 'test'};
            const obj2 = {a: 1, b: 'test'};
            expect(testIsEqual(obj1, obj2)).toBe(true);
        });

        test('should return false for different objects', () => {
            const obj1 = {a: 1, b: 'test'};
            const obj2 = {a: 2, b: 'test'};
            expect(testIsEqual(obj1, obj2)).toBe(false);
        });

        test('should handle null/undefined values', () => {
            expect(testIsEqual(null, undefined)).toBe(false);
            expect(testIsEqual(null, {})).toBe(false);
            expect(testIsEqual(undefined, {})).toBe(false);
        });
    });

    describe('buffer management', () => {
        test('should handle multiple buffers correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Get handlers for different event types
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            const objectStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'ObjectStatusUpdated'
            )[1];

            // Trigger multiple events
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            objectStatusHandler({data: JSON.stringify({path: 'obj1', object_status: {status: 'active'}})});

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalled();
            expect(mockStore.setObjectStatuses).toHaveBeenCalled();
        });

        test('should handle empty buffers gracefully', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Fast-forward timers without any events
            jest.runAllTimers();

            // Verify no errors occurred and store methods weren't called unnecessarily
            expect(mockStore.setNodeStatuses).not.toHaveBeenCalled();
        });

        test('should handle instanceConfig buffer correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];

            // Simulate InstanceConfigUpdated event with instance_config
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
    });

    describe('connection lifecycle', () => {

        test('should handle connection open event', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Trigger onopen handler
            if (mockEventSource.onopen) {
                mockEventSource.onopen();
            }

            expect(console.info).toHaveBeenCalledWith('✅ EventSource connection established');
        });
    });

    describe('query string creation', () => {
        test('should create query string with default filters', () => {
            // This tests the internal createQueryString function through public API
            eventSourceManager.configureEventSource('fake-token');

            expect(EventSourcePolyfill).toHaveBeenCalledWith(
                expect.stringContaining('cache=true'),
                expect.any(Object)
            );
        });

        test('should handle invalid filters in createQueryString', () => {
            eventSourceManager.configureEventSource('fake-token', null, ['InvalidFilter', 'NodeStatusUpdated']);

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid filters detected'));
            expect(EventSourcePolyfill.mock.calls[0][0]).toContain('filter=NodeStatusUpdated');
        });
    });

    describe('navigationService', () => {
        test('should dispatch auth redirect event', () => {
            eventSourceManager.navigationService.redirectToAuth();
            expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
            const event = window.dispatchEvent.mock.calls[0][0];
            expect(event.type).toBe('om3:auth-redirect');
            expect(event.detail).toBe('/auth-choice');
        });
    });

    describe('createLoggerEventSource', () => {
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

            EventSourcePolyfill.mockImplementationOnce(() => ({
                ...mockLoggerEventSource,
            }));
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

        test('should not log open if not subscribed', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', []);
            mockLoggerEventSource.onopen();
            expect(mockLogStore.addEventLog).not.toHaveBeenCalled();
        });

        test('should handle error but not log connection error', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'fake-token', []);
            const error = {message: 'test error', status: 500};
            mockLoggerEventSource.onerror(error);
            expect(console.error).toHaveBeenCalled();
            expect(mockLogStore.addEventLog).not.toHaveBeenCalledWith('CONNECTION_ERROR', expect.any(Object));
        });

        test('should handle 401 error in logger with silent renew', async () => {
            const mockUser = {
                access_token: 'new-logger-token',
                expires_at: Date.now() + 3600000
            };

            window.oidcUserManager = {
                signinSilent: jest.fn().mockResolvedValue(mockUser)
            };

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
    });

    describe('closeLoggerEventSource', () => {

        test('should not throw if no logger source', () => {
            expect(() => eventSourceManager.closeLoggerEventSource()).not.toThrow();
        });
    });

    describe('updateLoggerEventSourceToken', () => {

        test('should not update if no new token', () => {
            eventSourceManager.createLoggerEventSource(URL_NODE_EVENT, 'old-token', []);
            eventSourceManager.updateLoggerEventSourceToken('');
            expect(mockLoggerEventSource.close).not.toHaveBeenCalled();
        });
    });

    describe('configureLoggerEventSource', () => {
        test('should handle missing token', () => {
            eventSourceManager.configureLoggerEventSource('');
            expect(console.error).toHaveBeenCalledWith('❌ No token provided for Logger SSE!');
        });
    });

    describe('startLoggerReception', () => {

        test('should handle missing token', () => {
            eventSourceManager.startLoggerReception('');
            expect(console.error).toHaveBeenCalledWith('❌ No token provided for Logger SSE!');
        });
    });
});
