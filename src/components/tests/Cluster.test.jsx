// Cluster.test.jsx
import React from 'react';
import {render, screen, waitFor, fireEvent, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';
import {toHaveNoViolations} from 'jest-axe';
import ClusterOverview from '../Cluster.jsx';
import useEventStore from '../../hooks/useEventStore.js';
import {URL_POOL} from '../../config/apiPath.js';
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
            <div>{nodeCount}</div>
            <div>Frozen: {frozenCount} | Unfrozen: {unfrozenCount}</div>
        </button>
    );
    const GridObjects = ({objectCount, statusCount, onClick}) => (
        <button aria-label="Objects stat card" onClick={() => onClick && onClick()}>
            <div>{objectCount}</div>
            <div>Up {statusCount?.up ?? 0}</div>
            <div>Warn {statusCount?.warn ?? 0}</div>
            <div>Down {statusCount?.down ?? 0}</div>
        </button>
    );
    const GridNamespaces = ({namespaceCount, namespaceSubtitle, onClick}) => (
        <button aria-label="Namespaces stat card" onClick={() => onClick && onClick()}>
            <div>{namespaceCount}</div>
            <div>
                {namespaceSubtitle?.map(ns => (
                    <div
                        key={ns.namespace}
                        role="group"
                        aria-label={`${ns.namespace} chip`}
                        className="ns-chip"
                    >
                        <span>{ns.namespace}</span>
                        <span style={{fontSize: '10px'}}>{ns.count}</span>
                    </div>
                ))}
            </div>
        </button>
    );
    const GridHeartbeats = ({heartbeatCount, onClick}) => (
        <button aria-label="Heartbeats stat card" onClick={() => onClick && onClick()}>
            <div>{heartbeatCount}</div>
        </button>
    );
    const GridPools = ({poolCount, onClick}) => (
        <button aria-label="Pools stat card" onClick={() => onClick && onClick()}>
            <div>{poolCount}</div>
        </button>
    );
    const GridNetworks = ({networks, onClick}) => (
        <button aria-label="Networks stat card" onClick={() => onClick && onClick()}>
            <div>{networks?.length ?? 0}</div>
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
    const mockStartEventReception = jest.fn(() => jest.fn());
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
            const poolsCard = screen.getByRole('button', {name: /Pools stat card/i});
            expect(within(poolsCard).getByText('2')).toBeInTheDocument();
        });
        expect(screen.getByText('Cluster Overview')).toBeInTheDocument();
        const nodesCard = screen.getByRole('button', {name: /Nodes stat card/i});
        expect(within(nodesCard).getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Frozen: 1 | Unfrozen: 1')).toBeInTheDocument();
        const objectsCard = screen.getByRole('button', {name: /Objects stat card/i});
        expect(within(objectsCard).getByText('4')).toBeInTheDocument();
        expect(screen.getByText('Up 1')).toBeInTheDocument();
        expect(screen.getByText('Warn 1')).toBeInTheDocument();
        expect(screen.getByText('Down 1')).toBeInTheDocument();
        const namespacesCard = screen.getByRole('button', {name: /Namespaces stat card/i});
        expect(within(namespacesCard).getByText('3')).toBeInTheDocument();
        // ns1
        const ns1Group = within(namespacesCard).getByRole('group', {name: 'ns1 chip'});
        expect(within(ns1Group).getByText('2')).toBeInTheDocument();
        // root
        const rootGroup = within(namespacesCard).getByRole('group', {name: 'root chip'});
        expect(within(rootGroup).getByText('1')).toBeInTheDocument();
        // ns2
        const ns2Group = within(namespacesCard).getByRole('group', {name: 'ns2 chip'});
        expect(within(ns2Group).getByText('1')).toBeInTheDocument();
        const heartbeatsCard = screen.getByRole('button', {name: /Heartbeats stat card/i});
        expect(within(heartbeatsCard).getByText('2')).toBeInTheDocument();
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
        expect(axios.get).toHaveBeenCalledWith(`${URL_POOL}`, {
            headers: {Authorization: `Bearer ${mockToken}`},
        });
        await waitFor(() => {
            const poolsCard = screen.getByRole('button', {name: /Pools stat card/i});
            expect(within(poolsCard).getByText('2')).toBeInTheDocument();
        });
    });
    test('navigates to correct routes on card clicks', async () => {
        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );
        await waitFor(() => {
            const poolsCard = screen.getByRole('button', {name: /Pools stat card/i});
            expect(within(poolsCard).getByText('2')).toBeInTheDocument();
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
        expect(within(screen.getByRole('button', {name: /Nodes stat card/i})).getByText('0')).toBeInTheDocument();
        expect(screen.getByText('Frozen: 0 | Unfrozen: 0')).toBeInTheDocument();
        expect(within(screen.getByRole('button', {name: /Objects stat card/i})).getByText('0')).toBeInTheDocument();
        expect(screen.getByText('Up 0')).toBeInTheDocument();
        expect(screen.getByText('Warn 0')).toBeInTheDocument();
        expect(screen.getByText('Down 0')).toBeInTheDocument();
        expect(within(screen.getByRole('button', {name: /Namespaces stat card/i})).getByText('0')).toBeInTheDocument();
        expect(screen.queryByRole('group', {name: /ns1 chip/i})).not.toBeInTheDocument();
        expect(within(screen.getByRole('button', {name: /Heartbeats stat card/i})).getByText('0')).toBeInTheDocument();
        const poolsCard = screen.getByRole('button', {name: /Pools stat card/i});
        await waitFor(() => {
            expect(within(poolsCard).getByText('0')).toBeInTheDocument();
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
            const poolsCard = screen.getByRole('button', {name: /Pools stat card/i});
            expect(within(poolsCard).getByText('0')).toBeInTheDocument();
        });
    });
});
