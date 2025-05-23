import {render, screen, waitFor, fireEvent, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';
import {toHaveNoViolations} from 'jest-axe';
import ClusterOverview from '../Cluster.jsx';
import useEventStore from '../../hooks/useEventStore.js';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus';
import {URL_POOL} from '../../config/apiPath.js';

expect.extend(toHaveNoViolations);

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));
jest.mock('axios');
jest.mock('../../hooks/useEventStore.js');
jest.mock('../../hooks/useFetchDaemonStatus');

describe('ClusterOverview', () => {
    const mockNavigate = jest.fn();
    const mockFetchNodes = jest.fn();
    const mockStartEventReception = jest.fn();
    const mockNodeStatus = {
        node1: {frozen_at: '2023-01-01T00:00:00Z'},
        node2: {frozen_at: '0001-01-01T00:00:00Z'},
    };
    const mockObjectStatus = {
        'ns1/svc/obj1': {avail: 'up'},
        'ns1/svc/obj2': {avail: 'down'},
        'root/svc/obj3': {avail: 'warn'},
        'ns2/svc/obj4': {avail: 'unknown'},
    };
    const mockHeartbeatStatus = {
        node1: {
            streams: [
                {id: 'dev1.rx'},
                {id: 'dev1.tx'},
            ],
        },
        node2: {
            streams: [
                {id: 'dev2.rx'},
                {id: 'dev2.tx'},
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
        useFetchDaemonStatus.mockReturnValue({
            fetchNodes: mockFetchNodes.mockResolvedValue(mockNodeStatus),
            startEventReception: mockStartEventReception,
        });
        Storage.prototype.getItem = jest.fn(() => mockToken);
        jest.spyOn(axios, 'get').mockResolvedValue({
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
        }, {timeout: 2000});

        expect(screen.getByText('Cluster Overview')).toBeInTheDocument();

        const nodesCard = screen.getByRole('button', {name: /Nodes stat card/i});
        expect(nodesCard).toBeInTheDocument();
        expect(within(nodesCard).getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Frozen: 1 | Unfrozen: 1')).toBeInTheDocument();

        const objectsCard = screen.getByRole('button', {name: /Objects stat card/i});
        expect(objectsCard).toBeInTheDocument();
        expect(within(objectsCard).getByText('4')).toBeInTheDocument();
        expect(screen.getByText('Up 1')).toBeInTheDocument();
        expect(screen.getByText('Warn 1')).toBeInTheDocument();
        expect(screen.getByText('Down 1')).toBeInTheDocument();

        const namespacesCard = screen.getByRole('button', {name: /Namespaces stat card/i});
        expect(namespacesCard).toBeInTheDocument();
        expect(within(namespacesCard).getByText('3')).toBeInTheDocument();
        expect(screen.getByText('ns1: 2 | root: 1 | ns2: 1')).toBeInTheDocument();

        const heartbeatsCard = screen.getByRole('button', {name: /Heartbeats stat card/i});
        expect(heartbeatsCard).toBeInTheDocument();
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
        expect(mockFetchNodes).toHaveBeenCalledWith(mockToken);
        expect(mockStartEventReception).toHaveBeenCalledWith(mockToken);
        expect(axios.get).toHaveBeenCalledWith(`${URL_POOL}`, {
            headers: {Authorization: `Bearer ${mockToken}`},
        });

        await waitFor(() => {
            const poolsCard = screen.getByRole('button', {name: /Pools stat card/i});
            expect(within(poolsCard).getByText('2')).toBeInTheDocument();
        }, {timeout: 2000});
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
        }, {timeout: 2000});

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
        jest.spyOn(axios, 'get').mockResolvedValue({data: {items: []}});
        useFetchDaemonStatus.mockReturnValue({
            fetchNodes: jest.fn().mockResolvedValue({}),
            startEventReception: jest.fn(),
        });

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
        expect(screen.queryByText(/ns1:/)).not.toBeInTheDocument();

        expect(within(screen.getByRole('button', {name: /Heartbeats stat card/i})).getByText('0')).toBeInTheDocument();

        const poolsCard = screen.getByRole('button', {name: /Pools stat card/i});
        await waitFor(() => {
            expect(within(poolsCard).getByText('0')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('does not fetch data if no auth token', async () => {
        Storage.prototype.getItem = jest.fn(() => null);

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        expect(mockFetchNodes).not.toHaveBeenCalled();
        expect(mockStartEventReception).not.toHaveBeenCalled();
        expect(axios.get).not.toHaveBeenCalled();
    });


    test('handles API error for pools', async () => {
        jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));

        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            const poolsCard = screen.getByRole('button', {name: /Pools stat card/i});
            expect(within(poolsCard).getByText('0')).toBeInTheDocument();
        }, {timeout: 2000});
    });


});