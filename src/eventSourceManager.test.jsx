import {createEventSource, closeEventSource} from './eventSourceManager';
import {EventSourcePolyfill} from 'event-source-polyfill';
import useEventStore from './hooks/useEventStore.js';
import {
    URL_AUTH_INFO,
    URL_CLUSTER_STATUS, URL_NODE,
    URL_NODE_EVENT,
    URL_OBJECT,
    URL_POOL,
    URL_TOKEN
} from './config/apiPath.js'

// Mock the external dependencies
jest.mock('event-source-polyfill');
jest.mock('./hooks/useEventStore.js');

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
        expect(eventSource.addEventListener).toHaveBeenCalledTimes(7);
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

    it('should handle errors and try to reconnect', () => {
        const error = new Error('Test error');
        const eventSource = createEventSource(URL_NODE_EVENT, 'fake-token');

        // Mock console.error
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });

        // Trigger error
        eventSource.onerror(error);

        expect(consoleErrorSpy).toHaveBeenCalledWith('🚨 EventSource error:', error);
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
});