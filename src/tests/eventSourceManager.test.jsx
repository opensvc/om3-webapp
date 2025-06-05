import {createEventSource, closeEventSource} from '../eventSourceManager.jsx';
import {EventSourcePolyfill} from 'event-source-polyfill';
import useEventStore from '../hooks/useEventStore.js';
import {URL_NODE_EVENT} from '../config/apiPath.js'

// Mock the external dependencies
jest.mock('event-source-polyfill');
jest.mock('../hooks/useEventStore.js');

// Mock timers
jest.useFakeTimers();

describe('createEventSource', () => {
    let mockStore;

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
            setNodeStatuses: jest.fn(),
            setNodeMonitors: jest.fn(),
            setNodeStats: jest.fn(),
            setObjectStatuses: jest.fn(),
            setInstanceStatuses: jest.fn(),
            setHeartbeatStatuses: jest.fn(),
            removeObject: jest.fn(),
        };

        useEventStore.getState.mockReturnValue(mockStore);

        // Mock EventSourcePolyfill
        EventSourcePolyfill.mockImplementation(() => ({
            onopen: jest.fn(),
            onerror: jest.fn(),
            addEventListener: jest.fn(),
            close: jest.fn(),
        }));
    });

    it('should create an EventSource and attach event listeners', () => {
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

        expect(EventSourcePolyfill).toHaveBeenCalled();
        expect(eventSource.addEventListener).toHaveBeenCalledTimes(9);
    });

    it('should process NodeStatusUpdated events correctly', () => {
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

        // Get the NodeStatusUpdated handler
        const nodeStatusHandler = eventSource.addEventListener.mock.calls
            .find(call => call[0] === 'NodeStatusUpdated')[1];

        // Simulate event
        nodeStatusHandler({
            data: JSON.stringify({node: 'node1', node_status: {status: 'up'}})
        });

        // Fast-forward timers to flush the buffer
        jest.runAllTimers();

        expect(mockStore.setNodeStatuses).toHaveBeenCalledWith(
            expect.objectContaining({
                node1: {status: 'up'}
            })
        );
    });

    it('should process NodeMonitorUpdated events correctly', () => {
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

        // Get the NodeMonitorUpdated handler
        const nodeMonitorHandler = eventSource.addEventListener.mock.calls
            .find(call => call[0] === 'NodeMonitorUpdated')[1];

        // Simulate event
        nodeMonitorHandler({
            data: JSON.stringify({node: 'node2', node_monitor: {monitor: 'active'}})
        });

        // Fast-forward timers to flush the buffer
        jest.runAllTimers();

        expect(mockStore.setNodeMonitors).toHaveBeenCalledWith(
            expect.objectContaining({
                node2: {monitor: 'active'}
            })
        );
    });

    it('should process NodeStatsUpdated events correctly', () => {
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

        // Get the NodeStatsUpdated handler
        const nodeStatsHandler = eventSource.addEventListener.mock.calls
            .find(call => call[0] === 'NodeStatsUpdated')[1];

        // Simulate event
        nodeStatsHandler({
            data: JSON.stringify({node: 'node3', node_stats: {cpu: 75, memory: 60}})
        });

        // Fast-forward timers to flush the buffer
        jest.runAllTimers();

        expect(mockStore.setNodeStats).toHaveBeenCalledWith(
            expect.objectContaining({
                node3: {cpu: 75, memory: 60}
            })
        );
    });

    it('should process ObjectStatusUpdated events correctly', () => {
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

        // Get the ObjectStatusUpdated handler
        const objectStatusHandler = eventSource.addEventListener.mock.calls
            .find(call => call[0] === 'ObjectStatusUpdated')[1];

        // Simulate event
        objectStatusHandler({
            data: JSON.stringify({path: 'object1', object_status: {status: 'active'}})
        });

        // Fast-forward timers to flush the buffer
        jest.runAllTimers();

        expect(mockStore.setObjectStatuses).toHaveBeenCalledWith(
            expect.objectContaining({
                object1: {status: 'active'}
            })
        );
    });

    it('should process InstanceStatusUpdated events correctly', () => {
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

        // Get the InstanceStatusUpdated handler
        const instanceStatusHandler = eventSource.addEventListener.mock.calls
            .find(call => call[0] === 'InstanceStatusUpdated')[1];

        // Simulate event
        instanceStatusHandler({
            data: JSON.stringify({path: 'object2', node: 'node1', instance_status: {status: 'inactive'}})
        });

        // Fast-forward timers to flush the buffer
        jest.runAllTimers();

        expect(mockStore.setInstanceStatuses).toHaveBeenCalledWith(
            expect.objectContaining({
                object2: {node1: {status: 'inactive'}}
            })
        );
    });

    it('should handle errors and try to reconnect', () => {
        const error = new Error('Test error');
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

        // Mock console.error
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Trigger error
        eventSource.onerror(error);

        // Expectation that error is logged with all arguments
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '🚨 EventSource error:',
            error,
            'URL:',
            expect.stringContaining(URL_NODE_EVENT), // Vérifie que l'URL contient URL_NODE_EVENT
            'readyState:',
            undefined
        );
        expect(eventSource.close).toHaveBeenCalled();

        // Cleanup
        consoleErrorSpy.mockRestore();
    });

    it('should close the EventSource when closeEventSource is called', () => {
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');
        closeEventSource();
        expect(eventSource.close).toHaveBeenCalled();
    });

    it('should not create EventSource if no token is provided', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        const eventSource = createEventSource(URL_NODE_EVENT, '');

        expect(eventSource).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Missing token for EventSource!');

        consoleErrorSpy.mockRestore();
    });

    it('should process multiple events and flush buffers correctly', () => {
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

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
            const handler = eventSource.addEventListener.mock.calls
                .find((call) => call[0] === event.type)[1];
            handler(event);
        });

        // Fast-forward timers to flush the buffer
        jest.runAllTimers();

        expect(mockStore.setNodeStatuses).toHaveBeenCalledWith(expect.objectContaining({
            node1: {status: 'up'},
        }));
        expect(mockStore.setNodeMonitors).toHaveBeenCalledWith(expect.objectContaining({
            node2: {monitor: 'active'},
        }));
    });

    it('should attempt to reconnect after an error', () => {
        const error = new Error('Test error');
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

        // Mocking console.error
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Triggering the error event
        eventSource.onerror(error);

        // Expectation that error is logged with all arguments and EventSource is closed
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '🚨 EventSource error:',
            error,
            'URL:',
            expect.stringContaining(URL_NODE_EVENT),
            'readyState:',
            undefined
        );
        expect(eventSource.close).toHaveBeenCalled();

        // Expectation that reconnection is attempted
        jest.runAllTimers();
        expect(EventSourcePolyfill).toHaveBeenCalledTimes(2); // One for initial connection, one for reconnection attempt

        consoleErrorSpy.mockRestore();
    });

    it('should flush buffers after a delay', () => {
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

        // Simulate an event (e.g., NodeStatusUpdated)
        const nodeStatusUpdatedEvent = {
            data: JSON.stringify({node: 'node1', node_status: {status: 'up'}}),
        };

        // Trigger the NodeStatusUpdated event
        const nodeStatusEventHandler = eventSource.addEventListener.mock.calls
            .find(call => call[0] === 'NodeStatusUpdated')[1];

        nodeStatusEventHandler(nodeStatusUpdatedEvent);

        // Fast-forward timers and check if the flushBuffers method is called
        jest.runAllTimers();

        // Expect the setNodeStatuses function to have been called with the correct data
        expect(mockStore.setNodeStatuses).toHaveBeenCalledWith(expect.objectContaining({
            node1: {status: 'up'},
        }));
    });
});