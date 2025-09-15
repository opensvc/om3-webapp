import * as eventSourceManager from '../eventSourceManager';
import {EventSourcePolyfill} from 'event-source-polyfill';
import useEventStore from '../hooks/useEventStore.js';
import {URL_NODE_EVENT} from '../config/apiPath.js';

// Mock the external dependencies
jest.mock('event-source-polyfill');
jest.mock('../hooks/useEventStore.js');

// Mock timers
jest.useFakeTimers();

describe('eventSourceManager', () => {
    let mockStore;
    let mockEventSource;

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
    });

    afterEach(() => {
        jest.clearAllTimers();
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
            nodeStatusHandler({
                data: JSON.stringify({node: 'node1', node_status: {status: 'up'}}),
            });

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

            nodeStatusHandler({
                data: JSON.stringify({node: 'node1', node_status: {status: 'up'}}),
            });

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
            nodeMonitorHandler({
                data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'active'}}),
            });

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
            nodeMonitorHandler({
                data: JSON.stringify({node: 'node1', node_monitor: {monitor: 'active'}}),
            });
            nodeMonitorHandler({
                data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'inactive'}}),
            });

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
            nodeStatsHandler({
                data: JSON.stringify({node: 'node3', node_stats: {cpu: 75, memory: 60}}),
            });

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
            nodeStatsHandler({
                data: JSON.stringify({node: 'node1', node_stats: {cpu: 50, memory: 70}}),
            });

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
            objectStatusHandler({
                data: JSON.stringify({path: 'object1', object_status: {status: 'active'}}),
            });

            // Fast-forward timers to flush the buffer
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
            objectStatusHandler({
                data: JSON.stringify({object_status: {status: 'active'}}),
            });

            // Simulate event with missing status
            objectStatusHandler({
                data: JSON.stringify({path: 'object1'}),
            });

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
            instanceStatusHandler({
                data: JSON.stringify({
                    path: 'object2',
                    node: 'node1',
                    instance_status: {status: 'inactive'},
                }),
            });

            // Fast-forward timers to flush the buffer
            jest.runAllTimers();

            expect(mockStore.setInstanceStatuses).toHaveBeenCalledWith(
                expect.objectContaining({
                    object2: {node1: {status: 'inactive'}},
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
                }),
            });
            instanceStatusHandler({
                data: JSON.stringify({
                    path: 'object1',
                    node: 'node2',
                    instance_status: {status: 'stopped'},
                }),
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
            instanceStatusHandler({
                data: JSON.stringify({node: 'node1', instance_status: {status: 'running'}}),
            });

            // Simulate event with missing node
            instanceStatusHandler({
                data: JSON.stringify({path: 'object1', instance_status: {status: 'running'}}),
            });

            // Simulate event with missing instance_status
            instanceStatusHandler({
                data: JSON.stringify({path: 'object1', node: 'node1'}),
            });

            // Fast-forward timers
            jest.runAllTimers();

            expect(mockStore.setInstanceStatuses).not.toHaveBeenCalled();
        });

        test('should flush heartbeatStatusBuffer correctly', () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
            });
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const heartbeatHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'DaemonHeartbeatUpdated'
            )[1];

            // Simulate DaemonHeartbeatUpdated event
            heartbeatHandler({
                data: JSON.stringify({node: 'node1', heartbeat: {status: 'alive'}}),
            });

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

        test('should handle DaemonHeartbeatUpdated with missing node or status', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const heartbeatHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'DaemonHeartbeatUpdated'
            )[1];

            // Simulate event with missing node
            heartbeatHandler({
                data: JSON.stringify({heartbeat: {status: 'alive'}}),
            });

            // Simulate event with missing status
            heartbeatHandler({
                data: JSON.stringify({node: 'node1'}),
            });

            // Fast-forward timers
            jest.runAllTimers();

            expect(mockStore.setHeartbeatStatuses).not.toHaveBeenCalled();
        });

        test('should handle ObjectDeleted with missing name', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];

            // Simulate event with missing name
            objectDeletedHandler({
                data: JSON.stringify({}),
            });

            expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️ ObjectDeleted event missing objectName:', {});
            expect(mockStore.removeObject).not.toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });

        test('should process ObjectDeleted events correctly', () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
            });
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const objectDeletedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'ObjectDeleted'
            )[1];

            // Simulate event
            objectDeletedHandler({
                data: JSON.stringify({path: 'object1'}),
            });

            // Fast-forward timers
            jest.runAllTimers();

            expect(consoleLogSpy).toHaveBeenCalledWith('📩 Received ObjectDeleted event:', expect.any(String));
            expect(mockStore.removeObject).toHaveBeenCalledWith('object1');

            consoleLogSpy.mockRestore();
        });

        test('should process InstanceMonitorUpdated events correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const instanceMonitorHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceMonitorUpdated'
            )[1];

            // Simulate event
            instanceMonitorHandler({
                data: JSON.stringify({
                    node: 'node1',
                    path: 'object1',
                    instance_monitor: {monitor: 'active'},
                }),
            });

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
            instanceMonitorHandler({
                data: JSON.stringify({path: 'object1', instance_monitor: {monitor: 'active'}}),
            });

            // Simulate event with missing path
            instanceMonitorHandler({
                data: JSON.stringify({node: 'node1', instance_monitor: {monitor: 'active'}}),
            });

            // Simulate event with missing instance_monitor
            instanceMonitorHandler({
                data: JSON.stringify({node: 'node1', path: 'object1'}),
            });

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
            configUpdatedHandler({
                data: JSON.stringify({path: 'object1', node: 'node1'}),
            });

            // Fast-forward timers
            jest.runAllTimers();

            expect(mockStore.setConfigUpdated).toHaveBeenCalledWith(
                expect.arrayContaining([JSON.stringify({name: 'object1', node: 'node1'})])
            );
        });

        test('should handle InstanceConfigUpdated with missing name or node', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            const configUpdatedHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'InstanceConfigUpdated'
            )[1];

            // Simulate event with missing name
            configUpdatedHandler({
                data: JSON.stringify({node: 'node1'}),
            });

            // Simulate event with missing node
            configUpdatedHandler({
                data: JSON.stringify({path: 'object1'}),
            });

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '⚠️ InstanceConfigUpdated event missing name or node:',
                expect.any(Object)
            );
            expect(mockStore.setConfigUpdated).not.toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });

        test('should handle errors and try to reconnect', () => {
            const error = new Error('Test error');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            mockEventSource.onerror(error);

            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });


        test('should not create EventSource if no token is provided', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, '');

            expect(eventSource).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Missing token for EventSource!');

            consoleErrorSpy.mockRestore();
        });

        test('should process multiple events and flush buffers correctly', () => {
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');

            // Simulate multiple events
            const events = [
                {
                    type: 'NodeStatusUpdated',
                    data: JSON.stringify({node: 'node1', node_status: {status: 'up'}}),
                },
                {
                    type: 'NodeMonitorUpdated',
                    data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'active'}}),
                },
            ];

            events.forEach((event) => {
                const handler = eventSource.addEventListener.mock.calls.find(
                    (call) => call[0] === event.type
                )[1];
                handler(event);
            });

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

            // Simulate an event (e.g., NodeStatusUpdated)
            const nodeStatusUpdatedEvent = {
                data: JSON.stringify({node: 'node1', node_status: {status: 'up'}}),
            };

            // Trigger the NodeStatusUpdated event
            const nodeStatusEventHandler = eventSource.addEventListener.mock.calls.find(
                (call) => call[0] === 'NodeStatusUpdated'
            )[1];

            nodeStatusEventHandler(nodeStatusUpdatedEvent);

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
            const eventSource = eventSourceManager.createEventSource(URL_NODE_EVENT, 'fake-token');
            eventSourceManager.closeEventSource(eventSource);
            expect(eventSource.close).toHaveBeenCalled();
        });

        test('should not throw error when closing non-existent EventSource', () => {
            expect(() => eventSourceManager.closeEventSource()).not.toThrow();
        });
    });

    describe('configureEventSource', () => {
        let createEventSourceSpy;
        let closeEventSourceSpy;

        beforeEach(() => {
            createEventSourceSpy = jest.spyOn(eventSourceManager, 'createEventSource');
            closeEventSourceSpy = jest.spyOn(eventSourceManager, 'closeEventSource');
        });

        afterEach(() => {
            createEventSourceSpy.mockRestore();
            closeEventSourceSpy.mockRestore();
        });

        test('should handle missing token in configureEventSource', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            eventSourceManager.configureEventSource('');

            expect(consoleErrorSpy).toHaveBeenCalledWith('❌ No token provided for SSE!');
            expect(createEventSourceSpy).not.toHaveBeenCalled();
            expect(closeEventSourceSpy).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('startEventReception', () => {
        let createEventSourceSpy;
        let closeEventSourceSpy;

        beforeEach(() => {
            // Ensure spies are set up correctly
            createEventSourceSpy = jest.spyOn(eventSourceManager, 'createEventSource');
            closeEventSourceSpy = jest.spyOn(eventSourceManager, 'closeEventSource');
        });

        afterEach(() => {
            // Restore spies
            createEventSourceSpy.mockRestore();
            closeEventSourceSpy.mockRestore();
        });

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
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });

            eventSourceManager.startEventReception('');

            expect(consoleErrorSpy).toHaveBeenCalledWith('❌ No token provided for SSE!');
            expect(createEventSourceSpy).not.toHaveBeenCalled();
            expect(closeEventSourceSpy).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });
});
