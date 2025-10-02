import React, {useEffect} from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import useFetchDaemonStatus from '../useFetchDaemonStatus';
import {fetchDaemonStatus} from '../../services/api';

// Mock dependencies
jest.mock('../../services/api');
jest.mock('../../config/apiPath.js', () => ({
    URL_NODE_EVENT: '/mock-node-event',
}));

// Test component to use the hook
const TestComponent = ({token, autoFetch = false}) => {
    const {nodes, daemon, error, loading, clusterStats, fetchNodes, clusterName} =
        useFetchDaemonStatus();

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
            <div data-testid="clusterName">{clusterName}</div>
            <button onClick={() => fetchNodes(token)} data-testid="fetchNodes">
                Fetch Nodes
            </button>
        </div>
    );
};

describe('useFetchDaemonStatus Hook', () => {
    const mockToken = 'mock-token';
    const mockDaemonStatus = {
        daemon: {status: 'running'},
        cluster: {
            config: {name: 'test-cluster'},
            node: {
                node1: {status: 'active'},
                node2: {status: 'inactive'},
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        fetchDaemonStatus.mockReset();
        console.error = jest.fn(); // Mock console.error for error logging
    });

    test('initializes with correct default states', () => {
        render(<TestComponent token={mockToken}/>);

        expect(screen.getByTestId('nodes').textContent).toBe('[]');
        expect(screen.getByTestId('daemon').textContent).toBe('{}');
        expect(screen.getByTestId('error').textContent).toBe('');
        expect(screen.getByTestId('loading').textContent).toBe('false');
        expect(screen.getByTestId('clusterStats').textContent).toBe('{}');
        expect(screen.getByTestId('clusterName').textContent).toBe('');
        expect(screen.getByTestId('fetchNodes')).toBeInTheDocument();
    });

    test('fetchNodes updates states on successful API call', async () => {
        fetchDaemonStatus.mockResolvedValue(mockDaemonStatus);

        render(<TestComponent token={mockToken}/>);

        fireEvent.click(screen.getByTestId('fetchNodes'));

        await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('false');
        });

        expect(screen.getByTestId('error').textContent).toBe('');
        expect(screen.getByTestId('daemon').textContent).toBe(
            JSON.stringify({status: 'running'})
        );
        expect(screen.getByTestId('nodes').textContent).toBe(
            JSON.stringify([
                {nodename: 'node1', status: 'active'},
                {nodename: 'node2', status: 'inactive'},
            ])
        );
        expect(screen.getByTestId('clusterStats').textContent).toBe(
            JSON.stringify({nodeCount: 2})
        );
        expect(screen.getByTestId('clusterName').textContent).toBe('test-cluster');

        expect(fetchDaemonStatus).toHaveBeenCalledWith(mockToken);
    });

    test('fetchNodes handles API error correctly', async () => {
        const errorMessage = 'Network error';
        fetchDaemonStatus.mockRejectedValue(new Error(errorMessage));

        render(<TestComponent token={mockToken}/>);

        fireEvent.click(screen.getByTestId('fetchNodes'));

        await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('false');
        });

        expect(screen.getByTestId('error').textContent).toBe(
            'Failed to retrieve daemon statuses.'
        );
        expect(screen.getByTestId('nodes').textContent).toBe('[]');
        expect(screen.getByTestId('daemon').textContent).toBe('{}');
        expect(screen.getByTestId('clusterStats').textContent).toBe('{}');
        expect(screen.getByTestId('clusterName').textContent).toBe('');

        expect(fetchDaemonStatus).toHaveBeenCalledWith(mockToken);
        expect(console.error).toHaveBeenCalledWith(
            'Error while fetching daemon statuses:',
            expect.any(Error)
        );
    });

    test('fetchNodes caches nodes correctly with autoFetch', async () => {
        fetchDaemonStatus.mockResolvedValue(mockDaemonStatus);

        render(<TestComponent token={mockToken} autoFetch={true}/>);

        await waitFor(() => {
            expect(screen.getByTestId('nodes').textContent).toBe(
                JSON.stringify([
                    {nodename: 'node1', status: 'active'},
                    {nodename: 'node2', status: 'inactive'},
                ])
            );
        });

        expect(screen.getByTestId('clusterStats').textContent).toBe(
            JSON.stringify({nodeCount: 2})
        );
        expect(screen.getByTestId('clusterName').textContent).toBe('test-cluster');

        expect(fetchDaemonStatus).toHaveBeenCalledWith(mockToken);
    });
});
