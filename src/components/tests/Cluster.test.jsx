import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';
import ClusterOverview from '../Cluster.jsx';
import useEventStore from '../../hooks/useEventStore.js';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus';
import {URL_POOL} from '../../config/apiPath.js'

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
    const mockHeartbeatStatus = {hb1: {}, hb2: {}};
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
            expect(screen.getByTestId('stat-card-value-pools')).toHaveTextContent('2');
        }, {timeout: 2000});

        expect(screen.getByText('Cluster Overview')).toBeInTheDocument();

        expect(screen.getByTestId('stat-card-nodes')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-value-nodes')).toHaveTextContent('2');
        expect(screen.getByText('Frozen: 1 | Unfrozen: 1')).toBeInTheDocument();

        expect(screen.getByTestId('stat-card-objects')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-value-objects')).toHaveTextContent('4');
        expect(screen.getByText('Up 1')).toBeInTheDocument();
        expect(screen.getByText('Warn 1')).toBeInTheDocument();
        expect(screen.getByText('Down 1')).toBeInTheDocument();


        expect(screen.getByTestId('stat-card-namespaces')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-value-namespaces')).toHaveTextContent('3');
        expect(screen.getByText('ns1: 2 | root: 1 | ns2: 1')).toBeInTheDocument();

        expect(screen.getByTestId('stat-card-heartbeats')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-value-heartbeats')).toHaveTextContent('2');

        expect(screen.getByTestId('stat-card-pools')).toBeInTheDocument();
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
            expect(screen.getByTestId('stat-card-value-pools')).toHaveTextContent('2');
        }, {timeout: 2000});
    });

    test('navigates to correct routes on card clicks', async () => {
        render(
            <MemoryRouter>
                <ClusterOverview/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('stat-card-value-pools')).toHaveTextContent('2');
        }, {timeout: 2000});

        const nodesCard = screen.getByTestId('stat-card-nodes');
        nodesCard.click();
        expect(mockNavigate).toHaveBeenCalledWith('/nodes');

        const objectsCard = screen.getByTestId('stat-card-objects');
        objectsCard.click();
        expect(mockNavigate).toHaveBeenCalledWith('/objects');

        const namespacesCard = screen.getByTestId('stat-card-namespaces');
        namespacesCard.click();
        expect(mockNavigate).toHaveBeenCalledWith('/namespaces');

        const heartbeatsCard = screen.getByTestId('stat-card-heartbeats');
        heartbeatsCard.click();
        expect(mockNavigate).toHaveBeenCalledWith('/heartbeats');

        const poolsCard = screen.getByTestId('stat-card-pools');
        poolsCard.click();
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

        expect(screen.getByTestId('stat-card-nodes')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-value-nodes')).toHaveTextContent('0');
        expect(screen.getByText('Frozen: 0 | Unfrozen: 0')).toBeInTheDocument();

        expect(screen.getByTestId('stat-card-objects')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-value-objects')).toHaveTextContent('0');
        expect(screen.getByText('Up 0')).toBeInTheDocument();
        expect(screen.getByText('Warn 0')).toBeInTheDocument();
        expect(screen.getByText('Down 0')).toBeInTheDocument();


        expect(screen.getByTestId('stat-card-namespaces')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-value-namespaces')).toHaveTextContent('0');
        expect(screen.queryByText(/ns1:/)).not.toBeInTheDocument();

        expect(screen.getByTestId('stat-card-heartbeats')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-value-heartbeats')).toHaveTextContent('0');

        expect(screen.getByTestId('stat-card-pools')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByTestId('stat-card-value-pools')).toHaveTextContent('0');
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
});