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
            expect(mockStore.setNodeStatuses).not.toHaveBeenCalled();
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
            expect(console.debug).toHaveBeenCalledWith('buffer:', expect.objectContaining({node1: {status: 'alive'}}));
            expect(mockStore.setHeartbeatStatuses).toHaveBeenCalledWith(expect.objectContaining({node1: {status: 'alive'}}));
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
            expect(mockStore.setInstanceStatuses).not.toHaveBeenCalled();
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
            expect(mockStore.setInstanceMonitors).not.toHaveBeenCalled();
        });

        test('should clear existing timeout when eventCount reaches BATCH_SIZE', () => {
            const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const nodeStatusHandler = eventSource.addEventListener.mock.calls.find(
                call => call[0] === 'NodeStatusUpdated'
            )[1];
            nodeStatusHandler({data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})});
            for (let i = 0; i < 50; i++) {
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

        test('should handle max reconnection attempts reached', () => {
            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
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

        test('should return false for objects with different keys', () => {
            const obj1 = {a: 1, b: 2};
            const obj2 = {a: 1, c: 2};
            expect(testIsEqual(obj1, obj2)).toBe(false);
        });

        test('should return false for objects with same keys but different values', () => {
            const obj1 = {a: 1, b: 2};
            const obj2 = {a: 1, b: 3};
            expect(testIsEqual(obj1, obj2)).toBe(false);
        });

        test('should return true for empty objects', () => {
            expect(testIsEqual({}, {})).toBe(true);
        });

        test('should return false for object vs array with same JSON', () => {
            const obj = {0: 'a', 1: 'b'};
            const arr = ['a', 'b'];
            expect(testIsEqual(obj, arr)).toBe(false);
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
    });
});
