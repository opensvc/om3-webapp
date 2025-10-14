import * as eventSourceManager from '../eventSourceManager';
import {EventSourcePolyfill} from 'event-source-polyfill';
import useEventStore from '../hooks/useEventStore.js';
import {URL_NODE_EVENT} from '../config/apiPath.js';

// Mock the external dependencies
jest.mock('event-source-polyfill');
jest.mock('../hooks/useEventStore.js');

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
    let mockEventSource;
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

        // Create a consistent mock EventSource
        mockEventSource = {
            onopen: jest.fn(),
            onerror: null, // Will be set by createEventSource
            addEventListener: jest.fn(),
            close: jest.fn(),
            readyState: 1, // OPEN state
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
            info: console.info
        };

        // Mock window.location
        delete window.location;
        window.location = { href: '' };
        window.oidcUserManager = null;
    });

    afterEach(() => {
        jest.clearAllTimers();
        // Restore console methods
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.info = originalConsole.info;

        // Reset module state
        eventSourceManager.closeEventSource();
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
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            expect(firstEventSource.close).toHaveBeenCalled();
        });

        test('should process NodeStatusUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            // Get the NodeStatusUpdated handler
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatusUpdated'
            )[1];

            // Simulate event
            const mockEvent = { data: JSON.stringify({node: 'node1', node_status: {status: 'up'}}) };
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

            const mockEvent = { data: JSON.stringify({node: 'node1', node_status: {status: 'up'}}) };
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
            const mockEvent = { data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'active'}}) };
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
            nodeMonitorHandler({ data: JSON.stringify({node: 'node1', node_monitor: {monitor: 'active'}}) });
            nodeMonitorHandler({ data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'inactive'}}) });

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
            const mockEvent = { data: JSON.stringify({node: 'node3', node_stats: {cpu: 75, memory: 60}}) };
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
            const mockEvent = { data: JSON.stringify({node: 'node1', node_stats: {cpu: 50, memory: 70}}) };
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
            const mockEvent = { data: JSON.stringify({path: 'object1', object_status: {status: 'active'}}) };
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
            const mockEvent = { data: JSON.stringify({labels: {path: 'object1'}, object_status: {status: 'active'}}) };
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
            objectStatusHandler({ data: JSON.stringify({object_status: {status: 'active'}}) });

            // Simulate event with missing status
            objectStatusHandler({ data: JSON.stringify({path: 'object1'}) });

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
            instanceStatusHandler({ data: JSON.stringify({node: 'node1', instance_status: {status: 'running'}}) });

            // Simulate event with missing node
            instanceStatusHandler({ data: JSON.stringify({path: 'object1', instance_status: {status: 'running'}}) });

            // Simulate event with missing instance_status
            instanceStatusHandler({ data: JSON.stringify({path: 'object1', node: 'node1'}) });

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setInstanceStatuses).not.toHaveBeenCalled();
        });

        test('should flush heartbeatStatusBuffer correctly', () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const heartbeatHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'DaemonHeartbeatUpdated'
            )[1];

            // Simulate DaemonHeartbeatUpdated event
            const mockEvent = { data: JSON.stringify({node: 'node1', heartbeat: {status: 'alive'}}) };
            heartbeatHandler(mockEvent);

            // Fast-forward timers
            jest.runAllTimers();
            expect(consoleLogSpy).toHaveBeenCalledWith('buffer:', expect.objectContaining({
                node1: {status: 'alive'},
            }));
            expect(mockStore.setHeartbeatStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    node1: {status: 'alive'},
                })
            );
            consoleLogSpy.mockRestore();
        });

        test('should handle DaemonHeartbeatUpdated with labels node', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const heartbeatHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'DaemonHeartbeatUpdated'
            )[1];

            // Simulate event with labels node
            const mockEvent = { data: JSON.stringify({labels: {node: 'node1'}, heartbeat: {status: 'alive'}}) };
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
            heartbeatHandler({ data: JSON.stringify({heartbeat: {status: 'alive'}}) });

            // Simulate event with missing status
            heartbeatHandler({ data: JSON.stringify({node: 'node1'}) });

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setHeartbeatStatuses).not.toHaveBeenCalled();
        });

        test('should handle ObjectDeleted with missing name', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];

            // Simulate event with missing name
            objectDeletedHandler({ data: JSON.stringify({}) });

            expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️ ObjectDeleted event missing objectName:', {});
            expect(mockStore.removeObject).not.toHaveBeenCalled();
            consoleWarnSpy.mockRestore();
        });

        test('should process ObjectDeleted events correctly', () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];

            // Simulate event
            const mockEvent = { data: JSON.stringify({path: 'object1'}) };
            objectDeletedHandler(mockEvent);

            // Fast-forward timers
            jest.runAllTimers();
            expect(consoleLogSpy).toHaveBeenCalledWith('📩 Received ObjectDeleted event:', expect.any(String));
            expect(mockStore.removeObject).toHaveBeenCalledWith('object1');
            consoleLogSpy.mockRestore();
        });

        test('should handle ObjectDeleted with labels path', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];

            // Simulate event with labels path
            const mockEvent = { data: JSON.stringify({labels: {path: 'object1'}}) };
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
            instanceMonitorHandler({ data: JSON.stringify({path: 'object1', instance_monitor: {monitor: 'active'}}) });

            // Simulate event with missing path
            instanceMonitorHandler({ data: JSON.stringify({node: 'node1', instance_monitor: {monitor: 'active'}}) });

            // Simulate event with missing instance_monitor
            instanceMonitorHandler({ data: JSON.stringify({node: 'node1', path: 'object1'}) });

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
            const mockEvent = { data: JSON.stringify({path: 'object1', node: 'node1', instance_config: {config: 'test'}}) };
            configUpdatedHandler(mockEvent);

            // Fast-forward timers
            jest.runAllTimers();
            expect(mockStore.setConfigUpdated).toHaveBeenCalledWith(
                expect.arrayContaining([JSON.stringify({name: 'object1', node: 'node1'})])
            );
        });

        test('should handle InstanceConfigUpdated with labels path', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];

            // Simulate event with labels path
            const mockEvent = { data: JSON.stringify({labels: {path: 'object1'}, node: 'node1'}) };
            configUpdatedHandler(mockEvent);

            jest.runAllTimers();
            expect(mockStore.setConfigUpdated).toHaveBeenCalledWith(
                expect.arrayContaining([JSON.stringify({name: 'object1', node: 'node1'})])
            );
        });

        test('should handle InstanceConfigUpdated with missing name or node', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];

            // Simulate event with missing name
            configUpdatedHandler({ data: JSON.stringify({node: 'node1'}) });

            // Simulate event with missing node
            configUpdatedHandler({ data: JSON.stringify({path: 'object1'}) });

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '⚠️ InstanceConfigUpdated event missing name or node:',
                expect.any(Object)
            );
            expect(mockStore.setConfigUpdated).not.toHaveBeenCalled();
            consoleWarnSpy.mockRestore();
        });

        test('should handle invalid JSON in events', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatusUpdated'
            )[1];

            // Simulate event with invalid JSON
            nodeStatusHandler({ data: 'invalid json' });

            expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️ Invalid JSON in NodeStatusUpdated event:', 'invalid json');
            consoleWarnSpy.mockRestore();
        });

        test('should handle errors and try to reconnect', () => {
            const error = { status: 500 };
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            // Trigger error handler
            if (mockEventSource.onerror) {
                mockEventSource.onerror(error);
            }

            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });

        test('should handle 401 error with silent token renewal', async () => {
            const error = { status: 401 };
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
                mockEventSource.onerror(error);
            }

            // Wait for silent renew to complete
            await Promise.resolve();

            expect(window.oidcUserManager.signinSilent).toHaveBeenCalled();
            expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'silent-renewed-token');
        });

        test('should handle max reconnection attempts reached', () => {
            const error = { status: 500 };
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Trigger error handler multiple times to exceed max attempts
            for (let i = 0; i < 15; i++) {
                if (mockEventSource.onerror) {
                    mockEventSource.onerror(error);
                }
                jest.advanceTimersByTime(1000);
            }

            expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Max reconnection attempts reached');
            consoleErrorSpy.mockRestore();
        });

        test('should schedule reconnection with exponential backoff', () => {
            const error = { status: 500 };
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            if (mockEventSource.onerror) {
                mockEventSource.onerror(error);
            }

            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));

            // Verify the delay is within expected bounds
            const delay = setTimeoutSpy.mock.calls[0][1];
            expect(delay).toBeGreaterThanOrEqual(1000);
            expect(delay).toBeLessThanOrEqual(30000);
        });

        test('should not create EventSource if no token is provided', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, '');

            expect(eventSource).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Missing token for EventSource!');
            consoleErrorSpy.mockRestore();
        });

        test('should process multiple events and flush buffers correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Get handlers for different event types
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            const nodeMonitorHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeMonitorUpdated'
            )[1];

            // Simulate multiple events
            nodeStatusHandler({ data: JSON.stringify({node: 'node1', node_status: {status: 'up'}}) });
            nodeMonitorHandler({ data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'active'}}) });

            // Fast-forward timers to flush the buffer
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    node1: {status: 'up'},
                })
            );
            expect(mockStore.setNodeMonitors).toHaveBeenCalledWith(
                expect.objectContaining({
                    node2: {monitor: 'active'},
                })
            );
        });

        test('should flush buffers after a delay', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Get the NodeStatusUpdated handler
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];

            // Trigger the NodeStatusUpdated event
            nodeStatusHandler({ data: JSON.stringify({node: 'node1', node_status: {status: 'up'}}) });

            // Fast-forward timers to flush the buffer
            jest.runAllTimers();
            expect(mockStore.setNodeStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    node1: {status: 'up'},
                })
            );
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
            const closeSpy = jest.spyOn(mockEventSource, 'close');

            eventSourceManager.updateEventSourceToken('');

            expect(closeSpy).not.toHaveBeenCalled();
        });
    });

    describe('configureEventSource', () => {
        test('should handle missing token in configureEventSource', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            eventSourceManager.configureEventSource('');

            expect(consoleErrorSpy).toHaveBeenCalledWith('❌ No token provided for SSE!');
            consoleErrorSpy.mockRestore();
        });

        test('should configure EventSource with objectName and custom filters', () => {
            const customFilters = ['NodeStatusUpdated', 'ObjectStatusUpdated'];
            eventSourceManager.configureEventSource('fake-token', 'test-object', customFilters);

            expect(EventSourcePolyfill).toHaveBeenCalled();
        });

        test('should configure EventSource without objectName', () => {
            eventSourceManager.configureEventSource('fake-token');

            expect(EventSourcePolyfill).toHaveBeenCalled();
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
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            eventSourceManager.startEventReception('');

            expect(consoleErrorSpy).toHaveBeenCalledWith('❌ No token provided for SSE!');
            consoleErrorSpy.mockRestore();
        });

        test('should start event reception with custom filters', () => {
            const customFilters = ['NodeStatusUpdated', 'ObjectStatusUpdated'];
            eventSourceManager.startEventReception('fake-token', customFilters);

            expect(EventSourcePolyfill).toHaveBeenCalled();
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
            const obj1 = { a: 1, b: 'test' };
            const obj2 = { a: 1, b: 'test' };
            expect(testIsEqual(obj1, obj2)).toBe(true);
        });

        test('should return false for different objects', () => {
            const obj1 = { a: 1, b: 'test' };
            const obj2 = { a: 2, b: 'test' };
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
            nodeStatusHandler({ data: JSON.stringify({node: 'node1', node_status: {status: 'up'}}) });
            objectStatusHandler({ data: JSON.stringify({path: 'obj1', object_status: {status: 'active'}}) });

            // Fast-forward timers
            jest.runAllTimers();

            // Verify all buffers were flushed
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
                call => call[0] === 'InstanceConfigUpdated'
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
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Trigger onopen handler
            if (mockEventSource.onopen) {
                mockEventSource.onopen();
            }

            expect(consoleLogSpy).toHaveBeenCalledWith('✅ EventSource connection established');
            consoleLogSpy.mockRestore();
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
    });
});
