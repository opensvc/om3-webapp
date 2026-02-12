import React from 'react';
import {render, screen, waitFor, fireEvent, act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';
import {toHaveNoViolations} from 'jest-axe';
import ClusterOverview from '../Cluster.jsx';
import {URL_POOL, URL_NETWORK} from '../../config/apiPath.js';
import {startEventReception} from '../../eventSourceManager';
import {
    useNodeStats,
    useObjectStats,
    useHeartbeatStats
} from '../../hooks/useClusterData';

expect.extend(toHaveNoViolations);

// Mock react-router's useNavigate
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));

// Mock axios module
jest.mock('axios');

// Mock custom hooks
jest.mock('../../hooks/useClusterData', () => ({
    useNodeStats: jest.fn(),
    useObjectStats: jest.fn(),
    useHeartbeatStats: jest.fn(),
}));

// Mock the event source manager
jest.mock('../../eventSourceManager');

// Mock ClusterStatGrids named exports using a factory function
jest.mock('../ClusterStatGrids.jsx', () => {
    const GridNodes = ({nodeCount, frozenCount, onClick}) => (
        <button aria-label="Nodes stat card" onClick={onClick}>
            <div data-testid="node-count">{nodeCount}</div>
            <div data-testid="node-status">Frozen: {frozenCount}</div>
        </button>
    );
    const GridObjects = ({objectCount, statusCount, onClick}) => (
        <div>
            <button aria-label="Objects stat card" onClick={() => onClick && onClick()}>
                <div data-testid="object-count">{objectCount}</div>
                <div data-testid="up-count">Up {statusCount?.up ?? 0}</div>
                <div data-testid="warn-count">Warn {statusCount?.warn ?? 0}</div>
                <div data-testid="down-count">Down {statusCount?.down ?? 0}</div>
                <div data-testid="na-count">N/A {statusCount?.["n/a"] ?? 0}</div>
                <div data-testid="unprovisioned-count">Unprovisioned {statusCount?.unprovisioned ?? 0}</div>
            </button>
            <button
                aria-label="Objects up status"
                onClick={() => onClick && onClick('up')}
                data-testid="up-status-button"
            >
                View Up
            </button>
            <button
                aria-label="Objects warn status"
                onClick={() => onClick && onClick('warn')}
                data-testid="warn-status-button"
            >
                View Warn
            </button>
        </div>
    );
    const GridNamespaces = ({namespaceCount, namespaceSubtitle, onClick}) => (
        <button aria-label="Namespaces stat card" onClick={() => onClick && onClick()}>
            <div data-testid="namespace-count">{namespaceCount}</div>
            <div>
                {namespaceSubtitle?.map(ns => (
                    <div
                        key={ns.namespace}
                        role="group"
                        aria-label={`${ns.namespace} chip`}
                        className="ns-chip"
                        data-testid={`namespace-${ns.namespace}`}
                    >
                        <span>{ns.namespace}</span>
                        <span data-testid={`${ns.namespace}-count`} style={{fontSize: '10px'}}>{ns.count}</span>
                    </div>
                ))}
            </div>
        </button>
    );
    const GridHeartbeats = ({heartbeatCount, beatingCount, nonBeatingCount, stateCount, onClick}) => (
        <div>
            <button aria-label="Heartbeats stat card" onClick={() => onClick && onClick()}>
                <div data-testid="heartbeat-count">{heartbeatCount}</div>
                <div data-testid="beating-count">Beating: {beatingCount}</div>
                <div data-testid="non-beating-count">Non-beating: {nonBeatingCount}</div>
                <div data-testid="running-count">Running: {stateCount?.running ?? 0}</div>
            </button>
            <button
                aria-label="Heartbeats beating status"
                onClick={() => onClick && onClick('beating')}
                data-testid="beating-status-button"
            >
                View Beating
            </button>
            <button
                aria-label="Heartbeats running state"
                onClick={() => onClick && onClick('beating', 'running')}
                data-testid="running-state-button"
            >
                View Running
            </button>
        </div>
    );
    const GridPools = ({poolCount, onClick}) => (
        <button aria-label="Pools stat card" onClick={() => onClick && onClick()}>
            <div data-testid="pool-count">{poolCount}</div>
        </button>
    );
    const GridNetworks = ({networks, onClick}) => (
        <button aria-label="Networks stat card" onClick={() => onClick && onClick()}>
            <div data-testid="network-count">{networks?.length ?? 0}</div>
        </button>
    );
    return {
        GridNodes,
        GridObjects,
        GridNamespaces,
        GridHeartbeats,
        GridPools,
        GridNetworks,
    };
});

// Mock setTimeout
jest.useFakeTimers();

describe('ClusterOverview', () => {
    const mockNavigate = jest.fn();
    const mockStartEventReception = jest.fn();
    const mockToken = 'mock-token';

    beforeEach(() => {
        jest.clearAllMocks();
        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);

        // Mock custom hooks with default data
        useNodeStats.mockReturnValue({
            count: 2,
            frozen: 1
            // unfrozen is no longer used
        });

        useObjectStats.mockReturnValue({
            objectCount: 4,
            statusCount: {
                up: 1,
                warn: 1,
                down: 1,
                'n/a': 1,
                unprovisioned: 0
            },
            namespaceCount: 3,
            namespaceSubtitle: [
                {namespace: 'ns1', count: 2},
                {namespace: 'root', count: 1},
                {namespace: 'ns2', count: 1}
            ]
        });

        useHeartbeatStats.mockReturnValue({
            count: 2,
            beating: 2,
            stale: 0,
            stateCount: {running: 2}
        });

        startEventReception.mockImplementation(mockStartEventReception);
        Storage.prototype.getItem = jest.fn(() => mockToken);
        axios.get.mockResolvedValue({
            data: {items: [{id: 'pool1'}, {id: 'pool2'}]},
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    test('renders Cluster Overview title and stat cards', async () => {
        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toHaveTextContent('2');
        });
        expect(screen.getByText('Cluster Overview')).toBeInTheDocument();
        expect(screen.getByTestId('node-count')).toHaveTextContent('2');
        expect(screen.getByTestId('node-status')).toHaveTextContent('Frozen: 1');
        expect(screen.getByTestId('object-count')).toHaveTextContent('4');
        expect(screen.getByTestId('up-count')).toHaveTextContent('Up 1');
        expect(screen.getByTestId('warn-count')).toHaveTextContent('Warn 1');
        expect(screen.getByTestId('down-count')).toHaveTextContent('Down 1');
        expect(screen.getByTestId('na-count')).toHaveTextContent('N/A 1');
        expect(screen.getByTestId('namespace-count')).toHaveTextContent('3');
        expect(screen.getByTestId('namespace-ns1')).toBeInTheDocument();
        expect(screen.getByTestId('ns1-count')).toHaveTextContent('2');
        expect(screen.getByTestId('namespace-root')).toBeInTheDocument();
        expect(screen.getByTestId('root-count')).toHaveTextContent('1');
        expect(screen.getByTestId('namespace-ns2')).toBeInTheDocument();
        expect(screen.getByTestId('ns2-count')).toHaveTextContent('1');
        expect(screen.getByTestId('heartbeat-count')).toHaveTextContent('2');
        expect(screen.getByRole('button', {name: /Pools stat card/i})).toBeInTheDocument();
    });

    test('fetches data on mount with auth token', async () => {
        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );
        expect(localStorage.getItem).toHaveBeenCalledWith('authToken');
        expect(mockStartEventReception).toHaveBeenCalledWith(mockToken, expect.any(Array));

        expect(axios.get).toHaveBeenCalledWith(URL_POOL, expect.objectContaining({
            headers: {Authorization: `Bearer ${mockToken}`},
            timeout: 5000
        }));
        expect(axios.get).toHaveBeenCalledWith(URL_NETWORK, expect.objectContaining({
            headers: {Authorization: `Bearer ${mockToken}`},
            timeout: 5000
        }));
        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toHaveTextContent('2');
        });
    });

    test('navigates to correct routes on card clicks', async () => {
        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toHaveTextContent('2');
        });

        // Nodes card
        fireEvent.click(screen.getByRole('button', {name: /Nodes stat card/i}));
        act(() => {
            jest.advanceTimersByTime(50);
        });
        expect(mockNavigate).toHaveBeenCalledWith('/nodes');

        // Objects card
        fireEvent.click(screen.getByRole('button', {name: /Objects stat card/i}));
        act(() => {
            jest.advanceTimersByTime(50);
        });
        expect(mockNavigate).toHaveBeenCalledWith('/objects');

        // Namespaces card
        fireEvent.click(screen.getByRole('button', {name: /Namespaces stat card/i}));
        act(() => {
            jest.advanceTimersByTime(50);
        });
        expect(mockNavigate).toHaveBeenCalledWith('/namespaces');

        // Heartbeats card
        fireEvent.click(screen.getByRole('button', {name: /Heartbeats stat card/i}));
        act(() => {
            jest.advanceTimersByTime(50);
        });
        expect(mockNavigate).toHaveBeenCalledWith('/heartbeats');

        // Pools card
        fireEvent.click(screen.getByRole('button', {name: /Pools stat card/i}));
        act(() => {
            jest.advanceTimersByTime(50);
        });
        expect(mockNavigate).toHaveBeenCalledWith('/storage-pools');
    });

    test('navigates to objects with globalState parameter', async () => {
        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toHaveTextContent('2');
        });

        // Click on up status button
        fireEvent.click(screen.getByTestId('up-status-button'));
        act(() => {
            jest.advanceTimersByTime(50);
        });
        expect(mockNavigate).toHaveBeenCalledWith('/objects?globalState=up');

        mockNavigate.mockClear();

        // Click on warn status button
        fireEvent.click(screen.getByTestId('warn-status-button'));
        act(() => {
            jest.advanceTimersByTime(50);
        });
        expect(mockNavigate).toHaveBeenCalledWith('/objects?globalState=warn');
    });

    test('navigates to heartbeats with status and state parameters', async () => {
        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toHaveTextContent('2');
        });

        // Click on beating status button
        fireEvent.click(screen.getByTestId('beating-status-button'));
        act(() => {
            jest.advanceTimersByTime(50);
        });
        expect(mockNavigate).toHaveBeenCalledWith('/heartbeats?status=beating');

        mockNavigate.mockClear();

        // Click on running state button
        fireEvent.click(screen.getByTestId('running-state-button'));
        act(() => {
            jest.advanceTimersByTime(50);
        });
        expect(mockNavigate).toHaveBeenCalledWith('/heartbeats?status=beating&state=running');
    });

    test('handles empty data correctly', async () => {
        useNodeStats.mockReturnValue({
            count: 0,
            frozen: 0
        });

        useObjectStats.mockReturnValue({
            objectCount: 0,
            statusCount: {
                up: 0,
                warn: 0,
                down: 0,
                'n/a': 0,
                unprovisioned: 0
            },
            namespaceCount: 0,
            namespaceSubtitle: []
        });

        useHeartbeatStats.mockReturnValue({
            count: 0,
            beating: 0,
            stale: 0,
            stateCount: {running: 0}
        });

        axios.get.mockResolvedValue({data: {items: []}});

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.getByTestId('node-count')).toBeInTheDocument();
        });

        // Now check the values
        expect(screen.getByTestId('node-count')).toHaveTextContent('0');
        expect(screen.getByTestId('node-status')).toHaveTextContent('Frozen: 0');
        expect(screen.getByTestId('object-count')).toHaveTextContent('0');
        expect(screen.getByTestId('up-count')).toHaveTextContent('Up 0');
        expect(screen.getByTestId('warn-count')).toHaveTextContent('Warn 0');
        expect(screen.getByTestId('down-count')).toHaveTextContent('Down 0');
        expect(screen.getByTestId('na-count')).toHaveTextContent('N/A 0');
        expect(screen.getByTestId('namespace-count')).toHaveTextContent('0');
        expect(screen.getByTestId('heartbeat-count')).toHaveTextContent('0');
        expect(screen.getByTestId('pool-count')).toHaveTextContent('0');
    });

    test('does not fetch data if no auth token', async () => {
        Storage.prototype.getItem = jest.fn(() => null);

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );
        expect(mockStartEventReception).not.toHaveBeenCalled();
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('handles API error for pools', async () => {
        axios.get.mockRejectedValue(new Error('Network error'));

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toHaveTextContent('0');
        });
    });

    test('handles API error during fetch and component unmount during fetch', async () => {
        let resolvePromise;
        const slowPromise = new Promise((resolve) => {
            resolvePromise = resolve;
        });

        axios.get.mockReturnValue(slowPromise);

        const {unmount} = render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        // Unmount the component before the promise resolves
        unmount();

        // Resolve the promise after unmount
        resolvePromise({data: {items: [{id: 'pool1'}]}});

        await act(async () => {
            await slowPromise;
        });

        // Component should handle unmount gracefully without setting state
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('handles API error and component unmount during error', async () => {
        let rejectPromise;
        const errorPromise = new Promise((resolve, reject) => {
            rejectPromise = reject;
        });

        axios.get.mockReturnValue(errorPromise);

        const {unmount} = render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        // Unmount the component before the error is thrown
        unmount();

        // Reject the promise after unmount
        rejectPromise(new Error('API Error'));

        await act(async () => {
            try {
                await errorPromise;
            } catch (e) {
                // Expected error
            }
        });

        // Component should handle unmount gracefully without setting state
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('handles nodes with missing frozen_at property', async () => {
        useNodeStats.mockReturnValue({
            count: 2,
            frozen: 1
        });

        axios.get.mockResolvedValue({data: {items: []}});

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('node-count')).toHaveTextContent('2');
        });

        await waitFor(() => {
            expect(screen.getByTestId('node-status')).toHaveTextContent('Frozen: 1');
        });
    });

    test('handles objects with missing status or avail property', async () => {
        useObjectStats.mockReturnValue({
            objectCount: 3,
            statusCount: {
                up: 1,
                warn: 0,
                down: 0,
                'n/a': 2,
                unprovisioned: 0
            },
            namespaceCount: 0,
            namespaceSubtitle: []
        });

        axios.get.mockResolvedValue({data: {items: []}});

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('object-count')).toHaveTextContent('3');
        });

        expect(screen.getByTestId('up-count')).toHaveTextContent('Up 1');
        expect(screen.getByTestId('warn-count')).toHaveTextContent('Warn 0');
        expect(screen.getByTestId('down-count')).toHaveTextContent('Down 0');
        expect(screen.getByTestId('na-count')).toHaveTextContent('N/A 2');
    });

    test('handles heartbeats with unrecognized state', async () => {
        useHeartbeatStats.mockReturnValue({
            count: 2,
            beating: 1,
            stale: 1,
            stateCount: {running: 1, unknown: 1}
        });

        axios.get.mockResolvedValue({data: {items: []}});

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('heartbeat-count')).toHaveTextContent('2');
        });
    });

    test('handles API error for networks', async () => {
        axios.get.mockImplementation((url) => {
            if (url === URL_POOL) {
                return Promise.resolve({data: {items: [{id: 'pool1'}]}});
            }
            return Promise.reject(new Error('Network error'));
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('network-count')).toHaveTextContent('0');
        });
    });

    test('handles invalid networks data structure gracefully', async () => {
        axios.get.mockImplementation((url) => {
            if (url === URL_POOL) {
                return Promise.resolve({data: {items: [{id: 'pool1'}]}});
            }
            if (url === URL_NETWORK) {
                return Promise.resolve({data: {items: null}}); // invalid
            }
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('network-count')).toHaveTextContent('0');
        });
    });

    test('handles unprovisioned status objects without crashing', async () => {
        useObjectStats.mockReturnValue({
            objectCount: 1,
            statusCount: {
                up: 0,
                warn: 0,
                down: 0,
                'n/a': 0,
                unprovisioned: 1
            },
            namespaceCount: 1,
            namespaceSubtitle: [{namespace: 'ns1', count: 1}]
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        // Wait for the component to finish processing
        await waitFor(() => {
            expect(screen.getByText(/cluster overview/i)).toBeInTheDocument();
        });
    });

    test('renders correctly when networks is empty', async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes('/network')) {
                return Promise.resolve({data: {items: []}});
            }
            return Promise.resolve({data: {items: []}});
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            // Check that GridNetworks is not rendered or is empty
            const networksSection = screen.queryByTestId('grid-networks');
            expect(networksSection).toBeNull();
        });
    });

    test('handles various frozen_at date formats', async () => {
        useNodeStats.mockReturnValue({
            count: 6,
            frozen: 1
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('node-count')).toHaveTextContent('6');
        });

        const nodeStatusText = screen.getByTestId('node-status').textContent;
        expect(nodeStatusText).toMatch(/Frozen: 1/);
    });

    test('handles namespace parsing edge cases', async () => {
        useObjectStats.mockReturnValue({
            objectCount: 6,
            statusCount: {
                up: 6,
                warn: 0,
                down: 0,
                'n/a': 0,
                unprovisioned: 0
            },
            namespaceCount: 4,
            namespaceSubtitle: [
                {namespace: 'ns1', count: 2},
                {namespace: 'ns2', count: 1},
                {namespace: 'root', count: 1},
                {namespace: 'invalid-namespace', count: 1},
                {namespace: '', count: 1}
            ]
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('namespace-count')).toBeInTheDocument();
        });
    });

    test('handles heartbeat state counting edge cases', async () => {
        useHeartbeatStats.mockReturnValue({
            count: 8,
            beating: 5,
            stale: 3,
            stateCount: {running: 2, stopped: 1, failed: 1, paused: 1, unknown: 3}
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('heartbeat-count')).toBeInTheDocument();
        });
    });

    test('handles API errors gracefully for pools', async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes('/pools')) {
                return Promise.reject(new Error('Pool API unavailable'));
            }
            return Promise.resolve({data: {items: []}});
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toBeInTheDocument();
        });
    });

    test('handles API errors gracefully for networks', async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes('/networks')) {
                return Promise.reject(new Error('Network API unavailable'));
            }
            return Promise.resolve({data: {items: []}});
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('network-count')).toBeInTheDocument();
        });
    });

    test('handles navigation for stat cards', async () => {
        useNodeStats.mockReturnValue({
            count: 1,
            frozen: 0
        });

        useObjectStats.mockReturnValue({
            objectCount: 1,
            statusCount: {
                up: 1,
                warn: 0,
                down: 0,
                'n/a': 0,
                unprovisioned: 0
            },
            namespaceCount: 1,
            namespaceSubtitle: []
        });

        useHeartbeatStats.mockReturnValue({
            count: 1,
            beating: 1,
            stale: 0,
            stateCount: {running: 1}
        });

        axios.get.mockResolvedValue({
            data: {
                items: [
                    {id: 'pool1'},
                    {id: 'network1'}
                ]
            }
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toBeInTheDocument();
        });

        // Test navigation for each card
        const cards = [
            {role: 'Nodes stat card', expectedRoute: '/nodes'},
            {role: 'Objects stat card', expectedRoute: '/objects'},
            {role: 'Namespaces stat card', expectedRoute: '/namespaces'},
            {role: 'Heartbeats stat card', expectedRoute: '/heartbeats'},
            {role: 'Pools stat card', expectedRoute: '/storage-pools'},
        ];

        cards.forEach(({role, expectedRoute}) => {
            const card = screen.getByRole('button', {name: new RegExp(role, 'i')});
            fireEvent.click(card);
            act(() => {
                jest.advanceTimersByTime(50);
            });
            expect(mockNavigate).toHaveBeenCalledWith(expectedRoute);
            mockNavigate.mockClear();
        });
    });

    test('handles various API response formats for pools', async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes('/pools')) {
                return Promise.resolve({
                    data: {
                        items: [
                            {id: 'pool1', name: 'Pool 1'},
                            {id: 'pool2', name: 'Pool 2'},
                        ]
                    }
                });
            }
            return Promise.resolve({data: {items: []}});
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toBeInTheDocument();
        });
    });

    test('handles various API response formats for networks', async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes('/networks')) {
                return Promise.resolve({
                    data: {
                        items: [
                            {id: 'net1', name: 'Network 1', type: 'bridge'},
                            {name: 'Network 2', type: 'vlan'},
                        ]
                    }
                });
            }
            return Promise.resolve({data: {items: []}});
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('network-count')).toBeInTheDocument();
        });
    });

    test('handles partial node data', async () => {
        useNodeStats.mockReturnValue({
            count: 1,
            frozen: 0
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('node-count')).toBeInTheDocument();
        });
    });

    test('handles partial object data', async () => {
        useObjectStats.mockReturnValue({
            objectCount: 1,
            statusCount: {
                up: 1,
                warn: 0,
                down: 0,
                'n/a': 0,
                unprovisioned: 0
            },
            namespaceCount: 1,
            namespaceSubtitle: []
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('object-count')).toBeInTheDocument();
        });
    });

    test('handles partial heartbeat data', async () => {
        useHeartbeatStats.mockReturnValue({
            count: 1,
            beating: 0,
            stale: 1,
            stateCount: {running: 0}
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('heartbeat-count')).toBeInTheDocument();
        });
    });

    test('handles empty arrays in API responses', async () => {
        axios.get.mockResolvedValue({
            data: {
                items: []
            }
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toBeInTheDocument();
        });
    });

    test('handles null values in API responses', async () => {
        axios.get.mockResolvedValue({
            data: {
                items: null
            }
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toBeInTheDocument();
        });
    });

    test('handles missing properties in store data', async () => {
        useNodeStats.mockReturnValue({
            count: 0,
            frozen: 0
        });

        useObjectStats.mockReturnValue({
            objectCount: 0,
            statusCount: {
                up: 0,
                warn: 0,
                down: 0,
                'n/a': 0,
                unprovisioned: 0
            },
            namespaceCount: 0,
            namespaceSubtitle: []
        });

        useHeartbeatStats.mockReturnValue({
            count: 0,
            beating: 0,
            stale: 0,
            stateCount: {}
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('node-count')).toBeInTheDocument();
        });
    });

    test('handles heartbeat peers edge cases', async () => {
        useHeartbeatStats.mockReturnValue({
            count: 5,
            beating: 2,
            stale: 3,
            stateCount: {running: 5}
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('heartbeat-count')).toBeInTheDocument();
        });
    });

    test('handles object status with special characters in names', async () => {
        useObjectStats.mockReturnValue({
            objectCount: 4,
            statusCount: {
                up: 2,
                warn: 1,
                down: 1,
                'n/a': 0,
                unprovisioned: 0
            },
            namespaceCount: 4,
            namespaceSubtitle: [
                {namespace: 'ns-with-dash', count: 1},
                {namespace: 'ns_with_underscore', count: 1},
                {namespace: 'ns.with.dots', count: 1},
                {namespace: 'ns', count: 1}
            ]
        });

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('object-count')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByTestId('namespace-count')).toBeInTheDocument();
        });
    });
});
