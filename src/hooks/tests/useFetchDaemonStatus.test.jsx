import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import useFetchDaemonStatus from '../useFetchDaemonStatus';
import { fetchDaemonStatus } from '../../services/api';
import { createEventSource, closeEventSource } from '../../eventSourceManager';
import { URL_NODE_EVENT } from '../../config/apiPath.js';

// Mock dependencies
jest.mock('../../services/api');
jest.mock('../../eventSourceManager');
jest.mock('../../config/apiPath.js', () => ({
    URL_NODE_EVENT: '/mock-node-event',
}));

// Test component to use the hook
const TestComponent = ({ token, autoFetch = false }) => {
    const {
        nodes,
        daemon,
        error,
        loading,
        clusterStats,
        fetchNodes,
        startEventReception,
    } = useFetchDaemonStatus();

    // Automatically call fetchNodes if autoFetch is true
    useEffect(() => {
        if (autoFetch && token) {
            fetchNodes(token);
        }
    }, [autoFetch, token, fetchNodes]);

    return (
        <div>
            <div data-testid="nodes">{JSON.stringify(nodes)}</div>
            <div data-testid="daemon">{JSON.stringify(daemon)}</div>
            <div data-testid="error">{error}</div>
            <div data-testid="loading">{loading.toString()}</div>
            <div data-testid="clusterStats">{JSON.stringify(clusterStats)}</div>
            <button onClick={() => fetchNodes(token)} data-testid="fetchNodes">
                Fetch Nodes
            </button>
            <button onClick={() => startEventReception(token)} data-testid="startEventReception">
                Start SSE
            </button>
        </div>
    );
};

describe('useFetchDaemonStatus Hook', () => {
    const mockToken = 'mock-token';
    const mockDaemonStatus = {
        daemon: { status: 'running' },
        cluster: {
            node: {
                node1: { status: 'active' },
                node2: { status: 'inactive' },
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        fetchDaemonStatus.mockReset();
        createEventSource.mockReset();
        closeEventSource.mockReset();
        console.error = jest.fn(); // Mock console.error to capture errors
    });

    test('initializes with correct default states', () => {
        render(<TestComponent token={mockToken} />);

        expect(screen.getByTestId('nodes').textContent).toBe('[]');
        expect(screen.getByTestId('daemon').textContent).toBe('{}');
        expect(screen.getByTestId('error').textContent).toBe('');
        expect(screen.getByTestId('loading').textContent).toBe('false');
        expect(screen.getByTestId('clusterStats').textContent).toBe('{}');
        expect(screen.getByTestId('fetchNodes')).toBeInTheDocument();
        expect(screen.getByTestId('startEventReception')).toBeInTheDocument();
    });

    test('fetchNodes updates states on successful API call', async () => {
        fetchDaemonStatus.mockResolvedValue(mockDaemonStatus);

        render(<TestComponent token={mockToken} />);

        fireEvent.click(screen.getByTestId('fetchNodes'));

        await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('false');
            expect(screen.getByTestId('error').textContent).toBe('');
            expect(screen.getByTestId('daemon').textContent).toBe(JSON.stringify({ status: 'running' }));
            expect(screen.getByTestId('nodes').textContent).toBe(
                JSON.stringify([
                    { nodename: 'node1', status: 'active' },
                    { nodename: 'node2', status: 'inactive' },
                ])
            );
            expect(screen.getByTestId('clusterStats').textContent).toBe(JSON.stringify({ nodeCount: 2 }));
        });

        expect(fetchDaemonStatus).toHaveBeenCalledWith(mockToken);
    });

    test('fetchNodes handles API error correctly', async () => {
        const errorMessage = 'Network error';
        fetchDaemonStatus.mockRejectedValue(new Error(errorMessage));

        render(<TestComponent token={mockToken} />);

        fireEvent.click(screen.getByTestId('fetchNodes'));

        await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('false');
            expect(screen.getByTestId('error').textContent).toBe('Failed to retrieve daemon statuses.');
            expect(screen.getByTestId('nodes').textContent).toBe('[]');
            expect(screen.getByTestId('daemon').textContent).toBe('{}');
            expect(screen.getByTestId('clusterStats').textContent).toBe('{}');
        });

        expect(fetchDaemonStatus).toHaveBeenCalledWith(mockToken);
        expect(console.error).toHaveBeenCalledWith('Error while fetching daemon statuses:', expect.any(Error));
    });

    test('startEventReception creates SSE connection with valid token', () => {
        const mockEventSource = { id: 'mock-event-source' };
        createEventSource.mockReturnValue(mockEventSource);

        render(<TestComponent token={mockToken} />);

        fireEvent.click(screen.getByTestId('startEventReception'));

        expect(createEventSource).toHaveBeenCalledWith(URL_NODE_EVENT, mockToken);
        expect(closeEventSource).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });

    test('startEventReception closes previous SSE connection before creating new one', () => {
        const mockEventSource1 = { id: 'mock-event-source-1' };
        const mockEventSource2 = { id: 'mock-event-source-2' };
        createEventSource
            .mockReturnValueOnce(mockEventSource1)
            .mockReturnValueOnce(mockEventSource2);

        render(<TestComponent token={mockToken} />);

        fireEvent.click(screen.getByTestId('startEventReception'));
        fireEvent.click(screen.getByTestId('startEventReception'));

        expect(closeEventSource).toHaveBeenCalledWith(mockEventSource1);
        expect(createEventSource).toHaveBeenCalledTimes(2);
        expect(createEventSource).toHaveBeenCalledWith(URL_NODE_EVENT, mockToken);
    });

    test('startEventReception handles missing token', () => {
        render(<TestComponent token={null} />);

        fireEvent.click(screen.getByTestId('startEventReception'));

        expect(console.error).toHaveBeenCalledWith('❌ No token provided for SSE!');
        expect(createEventSource).not.toHaveBeenCalled();
        expect(closeEventSource).not.toHaveBeenCalled();
    });

    test('fetchNodes caches nodes correctly', async () => {
        fetchDaemonStatus.mockResolvedValue(mockDaemonStatus);

        render(<TestComponent token={mockToken} autoFetch={true} />);

        await waitFor(() => {
            expect(screen.getByTestId('nodes').textContent).toBe(
                JSON.stringify([
                    { nodename: 'node1', status: 'active' },
                    { nodename: 'node2', status: 'inactive' },
                ])
            );
            expect(screen.getByTestId('clusterStats').textContent).toBe(JSON.stringify({ nodeCount: 2 }));
        });

        expect(fetchDaemonStatus).toHaveBeenCalledWith(mockToken);
    });
});