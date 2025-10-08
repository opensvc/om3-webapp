import React from 'react';
import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';
import {toHaveNoViolations} from 'jest-axe';
import ClusterOverview from '../Cluster.jsx';
import useEventStore from '../../hooks/useEventStore.js';
import {URL_POOL, URL_NETWORK} from '../../config/apiPath.js';
import {startEventReception} from '../../eventSourceManager';

expect.extend(toHaveNoViolations);

// Mock react-router's useNavigate
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));

// Mock axios module
jest.mock('axios');

// Mock the event store hook
jest.mock('../../hooks/useEventStore.js');

// Mock the event source manager
jest.mock('../../eventSourceManager');

// Mock ClusterStatGrids named exports using a factory function
jest.mock('../ClusterStatGrids.jsx', () => {
    const GridNodes = ({nodeCount, frozenCount, unfrozenCount, onClick}) => (
        <button aria-label="Nodes stat card" onClick={onClick}>
            <div data-testid="node-count">{nodeCount}</div>
            <div data-testid="node-status">Frozen: {frozenCount} | Unfrozen: {unfrozenCount}</div>
        </button>
    );
    const GridObjects = ({objectCount, statusCount, onClick}) => (
        <button aria-label="Objects stat card" onClick={() => onClick && onClick()}>
            <div data-testid="object-count">{objectCount}</div>
            <div data-testid="up-count">Up {statusCount?.up ?? 0}</div>
            <div data-testid="warn-count">Warn {statusCount?.warn ?? 0}</div>
            <div data-testid="down-count">Down {statusCount?.down ?? 0}</div>
            <div data-testid="na-count">N/A {statusCount?.["n/a"] ?? 0}</div>
            <div data-testid="unprovisioned-count">Unprovisioned {statusCount?.unprovisioned ?? 0}</div>
        </button>
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
        <button aria-label="Heartbeats stat card" onClick={() => onClick && onClick()}>
            <div data-testid="heartbeat-count">{heartbeatCount}</div>
            <div data-testid="beating-count">Beating: {beatingCount}</div>
            <div data-testid="non-beating-count">Non-beating: {nonBeatingCount}</div>
            <div data-testid="running-count">Running: {stateCount?.running ?? 0}</div>
        </button>
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

describe('ClusterOverview', () => {
    const mockNavigate = jest.fn();
    const mockStartEventReception = jest.fn();
    const mockNodeStatus = {
        node1: {frozen_at: '2023-01-01T00:00:00Z'},
        node2: {frozen_at: '0001-01-01T00:00:00Z'},
    };
    const mockObjectStatus = {
        'ns1/svc/obj1': {avail: 'up', provisioned: true},
        'ns1/svc/obj2': {avail: 'down', provisioned: true},
        'root/svc/obj3': {avail: 'warn', provisioned: true},
        'ns2/svc/obj4': {avail: 'unknown', provisioned: true},
    };
    const mockHeartbeatStatus = {
        node1: {
            streams: [
                {id: 'dev1.rx', state: 'running', peers: {peer1: {is_beating: true}}},
                {id: 'dev1.tx', state: 'running', peers: {peer1: {is_beating: false}}},
            ],
        },
        node2: {
            streams: [
                {id: 'dev2.rx', state: 'stopped', peers: {peer1: {is_beating: true}}},
                {id: 'dev2.tx', state: 'failed', peers: {peer1: {is_beating: false}}},
            ],
        },
    };
    const mockToken = 'mock-token';

    beforeEach(() => {
        jest.clearAllMocks();
        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: mockNodeStatus,
            objectStatus: mockObjectStatus,
            heartbeatStatus: mockHeartbeatStatus,
        }));
        startEventReception.mockImplementation(mockStartEventReception);
        Storage.prototype.getItem = jest.fn(() => mockToken);
        axios.get.mockResolvedValue({
            data: {items: [{id: 'pool1'}, {id: 'pool2'}]},
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
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
        expect(screen.getByTestId('node-status')).toHaveTextContent('Frozen: 1 | Unfrozen: 1');
        expect(screen.getByTestId('object-count')).toHaveTextContent('4');
        expect(screen.getByTestId('up-count')).toHaveTextContent('Up 1');
        expect(screen.getByTestId('warn-count')).toHaveTextContent('Warn 1');
        expect(screen.getByTestId('down-count')).toHaveTextContent('Down 1');
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
        expect(mockStartEventReception).toHaveBeenCalledWith(mockToken);
        expect(axios.get).toHaveBeenCalledWith(URL_POOL, {
            headers: {Authorization: `Bearer ${mockToken}`},
        });
        expect(axios.get).toHaveBeenCalledWith(URL_NETWORK, {
            headers: {Authorization: `Bearer ${mockToken}`},
        });
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
        fireEvent.click(screen.getByRole('button', {name: /Nodes stat card/i}));
        expect(mockNavigate).toHaveBeenCalledWith('/nodes');

        fireEvent.click(screen.getByRole('button', {name: /Objects stat card/i}));
        expect(mockNavigate).toHaveBeenCalledWith('/objects');

        fireEvent.click(screen.getByRole('button', {name: /Namespaces stat card/i}));
        expect(mockNavigate).toHaveBeenCalledWith('/namespaces');

        fireEvent.click(screen.getByRole('button', {name: /Heartbeats stat card/i}));
        expect(mockNavigate).toHaveBeenCalledWith('/heartbeats');

        fireEvent.click(screen.getByRole('button', {name: /Pools stat card/i}));
        expect(mockNavigate).toHaveBeenCalledWith('/storage-pools');
    });

    test('handles empty data correctly', async () => {
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: {},
            heartbeatStatus: {},
        }));
        axios.get.mockResolvedValue({data: {items: []}});

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        expect(screen.getByTestId('node-count')).toHaveTextContent('0');
        expect(screen.getByTestId('node-status')).toHaveTextContent('Frozen: 0 | Unfrozen: 0');
        expect(screen.getByTestId('object-count')).toHaveTextContent('0');
        expect(screen.getByTestId('up-count')).toHaveTextContent('Up 0');
        expect(screen.getByTestId('warn-count')).toHaveTextContent('Warn 0');
        expect(screen.getByTestId('down-count')).toHaveTextContent('Down 0');
        expect(screen.getByTestId('namespace-count')).toHaveTextContent('0');
        expect(screen.getByTestId('heartbeat-count')).toHaveTextContent('0');
        await waitFor(() => {
            expect(screen.getByTestId('pool-count')).toHaveTextContent('0');
        });
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

    test('handles nodes with missing frozen_at property', async () => {
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {
                node1: {frozen_at: '2023-01-01T00:00:00Z'},
                node2: {}, // frozen_at missing
            },
            objectStatus: mockObjectStatus,
            heartbeatStatus: mockHeartbeatStatus,
        }));
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
            expect(screen.getByTestId('node-status')).toHaveTextContent('Frozen: 1 | Unfrozen: 1');
        });
    });

    test('handles objects with missing status or avail property', async () => {
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: mockNodeStatus,
            objectStatus: {
                'ns1/svc/obj1': {avail: 'up', provisioned: true},
                'ns1/svc/obj2': {}, // avail missing
                'root/svc/obj3': null, // status missing
            },
            heartbeatStatus: mockHeartbeatStatus,
        }));
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
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: mockNodeStatus,
            objectStatus: mockObjectStatus,
            heartbeatStatus: {
                node1: {
                    streams: [
                        {id: 'dev1.rx', state: 'paused', peers: {peer1: {is_beating: true}}},
                        {id: 'dev2.tx', state: 'running', peers: {peer1: {is_beating: false}}},
                    ],
                },
            },
        }));
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
});
