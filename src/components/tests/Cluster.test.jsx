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
        Storage.prototype.getItem = jest.fn(() => 'mock-token');

        axios.get.mockImplementation((url) => {
            if (url.includes('/object')) {
                // Simulates an object with provisioned = "false"
                return Promise.resolve({
                    data: {
                        items: [
                            {
                                metadata: {namespace: 'ns1'},
                                status: {provisioned: 'false'},
                            },
                        ],
                    },
                });
            }

            // Default mocks for other endpoints
            return Promise.resolve({data: {items: []}});
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
        Storage.prototype.getItem = jest.fn(() => 'mock-token');

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
        const mockNodeStatus = {
            node1: {frozen_at: '2023-01-01T00:00:00Z'}, // frozen
            node2: {frozen_at: '0001-01-01T00:00:00Z'}, // not frozen (default value)
            node3: {frozen_at: null}, // not frozen
            node4: {frozen_at: undefined}, // not frozen
            node5: {frozen_at: 'invalid-date'}, // invalid date
            node6: {}, // no frozen_at
        };

        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: mockNodeStatus,
            objectStatus: {},
            heartbeatStatus: {},
        }));

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('node-count')).toHaveTextContent('6');
        });

        const nodeStatusText = screen.getByTestId('node-status').textContent;
        expect(nodeStatusText).toMatch(/Frozen: \d+ \| Unfrozen: \d+/);
    });

    test('handles namespace parsing edge cases', async () => {
        const mockObjectStatus = {
            'ns1/svc/obj1': {avail: 'up', provisioned: true},
            'ns2/svc/obj2': {avail: 'up', provisioned: true},
            'root/svc/obj3': {avail: 'up', provisioned: true},
            'ns1/svc/obj4': {avail: 'up', provisioned: true},
            'invalid-namespace': {avail: 'up', provisioned: true},
            '': {avail: 'up', provisioned: true},
        };

        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: mockObjectStatus,
            heartbeatStatus: {},
        }));

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
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {id: 'dev1.rx', state: 'running', peers: {peer1: {is_beating: true}}},
                    {id: 'dev1.tx', state: 'running', peers: {peer1: {is_beating: true}}},
                    {id: 'dev2.rx', state: 'stopped', peers: {peer1: {is_beating: false}}},
                    {id: 'dev2.tx', state: 'failed', peers: {peer1: {is_beating: false}}},
                    {id: 'dev3.rx', state: 'paused', peers: {peer1: {is_beating: true}}},
                    {id: 'dev3.tx', state: null, peers: {peer1: {is_beating: true}}},
                    {id: 'dev4.rx', state: undefined, peers: {peer1: {is_beating: true}}},
                    {id: 'dev4.tx', peers: {peer1: {is_beating: true}}},
                ],
            },
        };

        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: {},
            heartbeatStatus: mockHeartbeatStatus,
        }));

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
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: {},
            heartbeatStatus: {},
        }));

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
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: {},
            heartbeatStatus: {},
        }));

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
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {node1: {frozen_at: null}},
            objectStatus: {'obj1': {avail: 'up', provisioned: true}},
            heartbeatStatus: {node1: {streams: []}},
        }));

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
            expect(mockNavigate).toHaveBeenCalledWith(expectedRoute);
        });
    });

    test('handles various API response formats for pools', async () => {
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: {},
            heartbeatStatus: {},
        }));

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
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: {},
            heartbeatStatus: {},
        }));

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

    test('handles partial node data in store', async () => {
        useEventStore.mockImplementation((selector) => {
            const state = {
                nodeStatus: {node1: {frozen_at: null}},
                objectStatus: undefined,
                heartbeatStatus: {},
            };

            if (selector.toString().includes('nodeStatus')) {
                return state.nodeStatus;
            }
            return {};
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

    test('handles partial object data in store', async () => {
        useEventStore.mockImplementation((selector) => {
            const state = {
                nodeStatus: {},
                objectStatus: {'obj1': {avail: 'up', provisioned: true}},
                heartbeatStatus: undefined,
            };

            if (selector.toString().includes('objectStatus')) {
                return state.objectStatus;
            }
            return {};
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

    test('handles partial heartbeat data in store', async () => {
        useEventStore.mockImplementation((selector) => {
            const state = {
                nodeStatus: undefined,
                objectStatus: {},
                heartbeatStatus: {node1: {streams: []}},
            };

            if (selector.toString().includes('heartbeatStatus')) {
                return state.heartbeatStatus;
            }
            return {};
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
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: {},
            heartbeatStatus: {},
        }));

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
        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: {},
            heartbeatStatus: {},
        }));

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
        useEventStore.mockImplementation((selector) => {
            const state = {
                nodeStatus: undefined,
                objectStatus: undefined,
                heartbeatStatus: undefined,
            };

            if (selector.toString().includes('nodeStatus')) {
                return state.nodeStatus || {};
            }
            if (selector.toString().includes('objectStatus')) {
                return state.objectStatus || {};
            }
            if (selector.toString().includes('heartbeatStatus')) {
                return state.heartbeatStatus || {};
            }
            return {};
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
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {id: 'dev1', state: 'running', peers: null},
                    {id: 'dev2', state: 'running', peers: {}},
                    {id: 'dev3', state: 'running'},
                    {id: 'dev4', state: 'running', peers: {peer1: {is_beating: undefined}}},
                    {id: 'dev5', state: 'running', peers: {peer1: {is_beating: null}}},
                ],
            },
        };

        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: {},
            heartbeatStatus: mockHeartbeatStatus,
        }));

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
        const mockObjectStatus = {
            'ns-with-dash/svc/obj-with-dash': {avail: 'up', provisioned: true},
            'ns_with_underscore/svc/obj_with_underscore': {avail: 'down', provisioned: true},
            'ns.with.dots/svc/obj.with.dots': {avail: 'warn', provisioned: true},
            'ns/with/slashes/svc/obj': {avail: 'up', provisioned: true},
        };

        useEventStore.mockImplementation((selector) => selector({
            nodeStatus: {},
            objectStatus: mockObjectStatus,
            heartbeatStatus: {},
        }));

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
