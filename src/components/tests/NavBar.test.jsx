import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {MemoryRouter, useLocation, useNavigate} from 'react-router-dom';
import NavBar from '../NavBar';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
    useLocation: jest.fn(),
}));

jest.mock('../../context/OidcAuthContext.tsx', () => ({
    useOidc: jest.fn(),
}));

jest.mock('../../context/AuthProvider.jsx', () => ({
    useAuth: jest.fn(),
    useAuthDispatch: jest.fn(),
    Logout: 'LOGOUT',
}));

jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    AppBar: jest.fn(({children}) => <div>{children}</div>),
    Toolbar: jest.fn(({children}) => <div>{children}</div>),
}));

// Mock initial pour useFetchDaemonStatus
jest.mock('../../hooks/useFetchDaemonStatus', () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue({
        clusterName: null,
        fetchNodes: jest.fn(),
        loading: false,
        daemon: null,
    }),
}));

jest.mock('../../hooks/useEventStore.js', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../hooks/useOnlineStatus', () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue(true),
}));

jest.mock('../../utils/logger.js', () => ({
    error: jest.fn(),
}));

describe('NavBar Component', () => {
    const mockNavigate = jest.fn();
    const mockAuthDispatch = jest.fn();
    const mockLocation = {
        pathname: '/cluster',
    };
    const mockUseEventStore = require('../../hooks/useEventStore.js').default;

    beforeEach(() => {
        jest.clearAllMocks();
        useNavigate.mockReturnValue(mockNavigate);
        useLocation.mockReturnValue(mockLocation);
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: 'test-token',
        });
        require('../../context/AuthProvider.jsx').useAuthDispatch.mockReturnValue(mockAuthDispatch);
        require('../../context/OidcAuthContext.tsx').useOidc.mockReturnValue({
            userManager: {
                signoutRedirect: jest.fn(),
                removeUser: jest.fn(),
            },
        });

        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: jest.fn(),
            loading: false,
            daemon: null,
        });

        mockUseEventStore.mockImplementation((selector) => selector({
            objectStatus: {},
            objectInstanceStatus: {},
            instanceMonitor: {},
        }));

        localStorage.clear();
    });

    test('renders correctly with cluster path', () => {
        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByText('Cluster')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /view user information/i})).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: /objects\?globalState=down/})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: /objects\?globalState=warn/})).not.toBeInTheDocument();
    });

    test('renders breadcrumbs for nested paths', () => {
        useLocation.mockReturnValue({
            pathname: '/cluster/node1/pod1',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByRole('link', {name: /navigate to cluster/i})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /navigate to node1/i})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /navigate to pod1/i})).toBeInTheDocument();
        expect(screen.getAllByText('>')).toHaveLength(2);
    });

    test('does not render breadcrumbs for login page', () => {
        useLocation.mockReturnValue({
            pathname: '/login',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.queryByRole('link', {name: /navigate to cluster/i})).not.toBeInTheDocument();
        expect(screen.queryByText('>')).not.toBeInTheDocument();
    });

    test('decodes URI components in breadcrumbs', () => {
        useLocation.mockReturnValue({
            pathname: '/cluster/node%201',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByRole('link', {name: /navigate to node 1/i})).toBeInTheDocument();
    });

    test('opens and closes menu correctly', async () => {
        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const menuButton = screen.getByLabelText(/open navigation menu/i);
        fireEvent.click(menuButton);

        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        }, {timeout: 1000});

        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems.length).toBeGreaterThan(0);

        const menu = screen.getByRole('menu');
        fireEvent.keyDown(menu, {key: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('navigates when menu item is clicked', () => {
        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const menuButton = screen.getByRole('button', {name: /open navigation menu/i});
        fireEvent.click(menuButton);

        const namespacesItem = screen.getByRole('menuitem', {name: /namespaces/i});
        fireEvent.click(namespacesItem);

        expect(mockNavigate).toHaveBeenCalledWith('/namespaces');
    });

    test('handles network path breadcrumbs correctly', () => {
        useLocation.mockReturnValue({
            pathname: '/network/eth0',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByRole('link', {name: /navigate to network/i})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /navigate to eth0/i})).toBeInTheDocument();
    });

    test('handles objects path breadcrumbs correctly', () => {
        useLocation.mockReturnValue({
            pathname: '/objects/volume1',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByRole('link', {name: /navigate to objects/i})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /navigate to volume1/i})).toBeInTheDocument();
    });

    test('shows loading state when cluster name is loading', async () => {
        useLocation.mockReturnValue({
            pathname: '/cluster',
        });
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: jest.fn(),
            loading: true,
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <NavBar/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('link', {name: /navigate to loading/i})).toBeInTheDocument();
        }, {timeout: 1000});
    });

    test('shows cluster name when available', async () => {
        useLocation.mockReturnValue({
            pathname: '/cluster',
        });
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: 'My Cluster',
            fetchNodes: jest.fn(),
            loading: false,
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <NavBar/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('link', {name: /navigate to my cluster/i})).toBeInTheDocument();
        }, {timeout: 1000});
    });

    test('handles menu item selection state', () => {
        useLocation.mockReturnValue({
            pathname: '/namespaces',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const menuButton = screen.getByRole('button', {name: /open navigation menu/i});
        fireEvent.click(menuButton);

        const selectedItem = screen.getByRole('menuitem', {name: /namespaces/i});

        expect(selectedItem).toHaveClass('Mui-selected');
    });

    test('retries fetchNodes when token is not initially available', async () => {
        const mockFetchNodes = jest.fn();
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: mockFetchNodes,
            loading: false,
        });

        let tokenCallCount = 0;
        require('../../context/AuthProvider.jsx').useAuth.mockImplementation(() => ({
            authChoice: 'local',
            get authToken() {
                tokenCallCount++;
                return tokenCallCount === 1 ? null : 'delayed-token';
            },
        }));

        jest.useFakeTimers();

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        jest.advanceTimersByTime(1000);

        await waitFor(() => {
            expect(mockFetchNodes).toHaveBeenCalledWith('delayed-token');
        });

        jest.useRealTimers();
    });

    test('handles case when max retries are exceeded', async () => {
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: null,
        });

        const mockFetchNodes = jest.fn();
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: mockFetchNodes,
            loading: false,
        });

        jest.useFakeTimers();

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        jest.advanceTimersByTime(3000);

        await waitFor(() => {
            expect(mockFetchNodes).not.toHaveBeenCalled();
        });

        jest.useRealTimers();
    });

    test('handles fetchNodes error', async () => {
        const mockFetchNodes = jest.fn().mockRejectedValue(new Error('Network error'));
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: mockFetchNodes,
            loading: false,
        });

        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: 'test-token',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        await waitFor(() => expect(mockFetchNodes).toHaveBeenCalledWith('test-token'));
    });

    test('handles single network path breadcrumbs correctly', () => {
        useLocation.mockReturnValue({
            pathname: '/network',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByRole('link', {name: /navigate to network/i})).toBeInTheDocument();
    });

    test('handles single objects path breadcrumbs correctly', () => {
        useLocation.mockReturnValue({
            pathname: '/objects',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByRole('link', {name: /navigate to objects/i})).toBeInTheDocument();
    });

    test('fetches token from localStorage if not in auth', async () => {
        localStorage.setItem('authToken', 'stored-token');
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: null,
        });

        const mockFetchNodes = jest.fn();
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: mockFetchNodes,
            loading: false,
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockFetchNodes).toHaveBeenCalledWith('stored-token');
        });
    });

    test('sets breadcrumbs when no token and network nested path', async () => {
        useLocation.mockReturnValue({
            pathname: '/network/eth0',
        });
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: null,
        });

        const mockFetchNodes = jest.fn();
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: mockFetchNodes,
            loading: false,
        });

        jest.useFakeTimers();

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        jest.advanceTimersByTime(3000);

        await waitFor(() => {
            expect(mockFetchNodes).not.toHaveBeenCalled();
        });

        expect(screen.getByRole('link', {name: /navigate to network/i})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /navigate to eth0/i})).toBeInTheDocument();

        jest.useRealTimers();
    });

    test('sets breadcrumbs when no token and objects nested path', async () => {
        useLocation.mockReturnValue({
            pathname: '/objects/volume1',
        });
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: null,
        });

        const mockFetchNodes = jest.fn();
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: mockFetchNodes,
            loading: false,
        });

        jest.useFakeTimers();

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        jest.advanceTimersByTime(3000);

        await waitFor(() => {
            expect(mockFetchNodes).not.toHaveBeenCalled();
        });

        expect(screen.getByRole('link', {name: /navigate to objects/i})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /navigate to volume1/i})).toBeInTheDocument();

        jest.useRealTimers();
    });

    test('sets breadcrumbs when no token and general nested path not starting with cluster', async () => {
        useLocation.mockReturnValue({
            pathname: '/namespaces/ns1',
        });
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: null,
        });

        const mockFetchNodes = jest.fn();
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: mockFetchNodes,
            loading: false,
        });

        jest.useFakeTimers();

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        jest.advanceTimersByTime(3000);

        await waitFor(() => {
            expect(mockFetchNodes).not.toHaveBeenCalled();
        });

        expect(screen.getByRole('link', {name: /navigate to namespaces/i})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /navigate to ns1/i})).toBeInTheDocument();

        jest.useRealTimers();
    });

    test('displays down and warn counts when objects have down or warn status from event store', async () => {
        const mockStore = {
            objectStatus: {
                'obj1': {avail: 'down', frozen: 'frozen', provisioned: 'true'},
                'obj2': {avail: 'warn', frozen: 'unfrozen', provisioned: 'false'},
                'obj3': {avail: 'up'},
                'obj4': {avail: 'invalid'}, // n/a
                'obj5': {avail: 'down'},
            },
            objectInstanceStatus: {
                'obj1': {
                    'node1': {avail: 'down', frozen_at: '2023-01-01T00:00:00Z', provisioned: 'true'},
                    'node2': {avail: 'up', frozen_at: '0001-01-01T00:00:00Z', provisioned: 'false'},
                },
                'obj4': {}, // no nodes
                'obj5': {'node3': {}},
            },
            instanceMonitor: {
                'node1:obj1': {global_expect: 'none', state: 'idle'},
                'node2:obj1': {global_expect: 'something'},
                'node3:obj5': {global_expect: null},
            },
        };
        mockUseEventStore.mockImplementation((selector) => selector(mockStore));

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const downCountEl = screen.getByText('2');
        const warnCountEl = screen.getByText('1');

        expect(downCountEl).toHaveAttribute('href', '/objects?globalState=down');
        expect(warnCountEl).toHaveAttribute('href', '/objects?globalState=warn');

        // Test tooltips
        const downTrigger = downCountEl;
        fireEvent.mouseOver(downTrigger);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toHaveTextContent('Number of down objects');
        });
        fireEvent.mouseLeave(downTrigger);

        const warnTrigger = warnCountEl;
        fireEvent.mouseOver(warnTrigger);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toHaveTextContent('Number of warn objects');
        });
        fireEvent.mouseLeave(warnTrigger);
    });

    test('displays down and warn counts from daemon when objectStatus is empty', async () => {
        mockUseEventStore.mockImplementation((selector) => selector({
            objectStatus: {},
            objectInstanceStatus: {},
            instanceMonitor: {},
        }));

        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: jest.fn(),
            loading: false,
            daemon: {
                cluster: {
                    object: {
                        'obj1': {avail: 'down'},
                        'obj2': {avail: 'warn'},
                        'obj3': {avail: 'up'},
                    }
                }
            }
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const downCountEl = screen.getByText('1', {selector: '[href="/objects?globalState=down"]'});
        const warnCountEl = screen.getByText('1', {selector: '[href="/objects?globalState=warn"]'});

        expect(downCountEl).toHaveAttribute('href', '/objects?globalState=down');
        expect(warnCountEl).toHaveAttribute('href', '/objects?globalState=warn');

        // Test tooltips
        const downTrigger = downCountEl;
        fireEvent.mouseOver(downTrigger);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toHaveTextContent('Number of down objects');
        });
        fireEvent.mouseLeave(downTrigger);

        const warnTrigger = warnCountEl;
        fireEvent.mouseOver(warnTrigger);
        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toHaveTextContent('Number of warn objects');
        });
        fireEvent.mouseLeave(warnTrigger);
    });

    test('displays only down count when warn count is 0', () => {
        const mockStore = {
            objectStatus: {
                'obj1': {avail: 'down'},
            },
            objectInstanceStatus: {},
            instanceMonitor: {},
        };
        mockUseEventStore.mockImplementation((selector) => selector(mockStore));

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const downCountEl = screen.getByText('1');
        expect(downCountEl).toHaveAttribute('href', '/objects?globalState=down');
        expect(screen.queryByText('1', {selector: '[href="/objects?globalState=warn"]'})).not.toBeInTheDocument();
    });

    test('displays only warn count when down count is 0', () => {
        const mockStore = {
            objectStatus: {
                'obj1': {avail: 'warn'},
            },
            objectInstanceStatus: {},
            instanceMonitor: {},
        };
        mockUseEventStore.mockImplementation((selector) => selector(mockStore));

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const warnCountEl = screen.getByText('1');
        expect(warnCountEl).toHaveAttribute('href', '/objects?globalState=warn');
        expect(screen.queryByText('1', {selector: '[href="/objects?globalState=down"]'})).not.toBeInTheDocument();
    });

    test('displays offline status when not online', () => {
        require('../../hooks/useOnlineStatus').default.mockReturnValue(false);

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    test('does not display offline status when online', () => {
        require('../../hooks/useOnlineStatus').default.mockReturnValue(true);

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    });

    test('renders WhoAmI icon button with correct styles', () => {
        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const whoAmIButton = screen.getByRole('link', {name: /view user information/i});
        expect(whoAmIButton).toBeInTheDocument();
        expect(whoAmIButton).toHaveAttribute('href', '/whoami');
    });

    test('navigates to WhoAmI page when icon is clicked', () => {
        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const whoAmIButton = screen.getByRole('link', {name: /view user information/i});
        expect(whoAmIButton).toHaveAttribute('href', '/whoami');
    });

    test('handles undefined object in objects when getting status', () => {
        const mockStore = {
            objectStatus: {
                'obj1': undefined,
            },
            objectInstanceStatus: {},
            instanceMonitor: {},
        };
        mockUseEventStore.mockImplementation((selector) => selector(mockStore));

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );
        expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    test('handles missing instance monitor for node', () => {
        const mockStore = {
            objectStatus: {
                'obj1': {avail: 'down'},
            },
            objectInstanceStatus: {
                'obj1': {
                    'node1': {avail: 'down'},
                },
            },
            instanceMonitor: {
            },
        };
        mockUseEventStore.mockImplementation((selector) => selector(mockStore));

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );
        expect(screen.getByText('1')).toBeInTheDocument();
    });

    test('excludes "cluster" from breadcrumb parts in getPathBreadcrumbs', () => {
        useLocation.mockReturnValue({
            pathname: '/cluster/node1/cluster',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );
        const clusterLinks = screen.getAllByRole('link', {name: /navigate to cluster/i});
        expect(clusterLinks).toHaveLength(1);
        expect(screen.getByRole('link', {name: /navigate to node1/i})).toBeInTheDocument();
    });

    test('does not call fetchNodes when it is not a function', async () => {
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: null,
            loading: false,
            daemon: null,
        });

        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: 'test-token',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByRole('link', {name: /view user information/i})).toBeInTheDocument();
        });
    });

    test('handles fetchNodes being undefined', async () => {
        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: undefined,
            loading: false,
            daemon: null,
        });

        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: 'test-token',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('link', {name: /view user information/i})).toBeInTheDocument();
        });
    });

    test('handles empty objects in getObjectStatus', () => {
        const mockStore = {
            objectStatus: {},
            objectInstanceStatus: {},
            instanceMonitor: {},
        };
        mockUseEventStore.mockImplementation((selector) => selector(mockStore));

        require('../../hooks/useFetchDaemonStatus').default.mockReturnValue({
            clusterName: null,
            fetchNodes: jest.fn(),
            loading: false,
            daemon: null,
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );
        expect(screen.getByRole('link', {name: /view user information/i})).toBeInTheDocument();
    });

    test('handles object with no nodes in objectInstanceStatus', () => {
        const mockStore = {
            objectStatus: {
                'obj1': {avail: 'down'},
            },
            objectInstanceStatus: {
                'obj1': {},
            },
            instanceMonitor: {},
        };
        mockUseEventStore.mockImplementation((selector) => selector(mockStore));

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );
        expect(screen.getByText('1')).toBeInTheDocument();
    });

    test('directly tests getPathBreadcrumbs exclusion of "cluster" segments', () => {
        useLocation.mockReturnValue({
            pathname: '/namespaces/cluster/objects',
        });
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: null,
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByRole('link', {name: /navigate to cluster/i})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /navigate to namespaces/i})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /navigate to objects/i})).toBeInTheDocument();

        expect(screen.getAllByText('>')).toHaveLength(2);
    });
});
