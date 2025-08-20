import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {MemoryRouter, useLocation, useNavigate} from 'react-router-dom';
import NavBar from '../NavBar';
import {AppBar, Toolbar, Typography, Button} from '@mui/material';
import {FaSignOutAlt} from 'react-icons/fa';

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
    }),
}));

describe('NavBar Component', () => {
    const mockNavigate = jest.fn();
    const mockAuthDispatch = jest.fn();
    const mockLocation = {
        pathname: '/cluster',
    };

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
        });

        localStorage.clear();
    });

    test('renders correctly with cluster path', () => {
        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByText('Cluster')).toBeInTheDocument();
        expect(screen.getByText('Logout')).toBeInTheDocument();
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

    test('handles logout with openid auth', async () => {
        const mockSignoutRedirect = jest.fn().mockResolvedValue(undefined);
        const mockRemoveUser = jest.fn().mockResolvedValue(undefined);
        require('../../context/OidcAuthContext.tsx').useOidc.mockReturnValue({
            userManager: {
                signoutRedirect: mockSignoutRedirect,
                removeUser: mockRemoveUser,
            },
        });
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'openid',
            user: {profile: {}},
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const logoutButton = screen.getByText('Logout');
        fireEvent.click(logoutButton);

        await waitFor(() => {
            expect(mockSignoutRedirect).toHaveBeenCalled();
            expect(mockRemoveUser).toHaveBeenCalled();
            expect(localStorage.getItem('authToken')).toBeNull();
            expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'LOGOUT'});
            expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
        }, {timeout: 2000});
    });

    test('handles logout without openid auth', () => {
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
        });

        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const logoutButton = screen.getByText('Logout');
        fireEvent.click(logoutButton);

        const {userManager} = require('../../context/OidcAuthContext.tsx').useOidc();
        expect(userManager.signoutRedirect).not.toHaveBeenCalled();
        expect(userManager.removeUser).not.toHaveBeenCalled();
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'LOGOUT'});
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
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

    test('renders logout button with correct styles', () => {
        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        const logoutButton = screen.getByText('Logout');
        expect(logoutButton).toHaveStyle('background-color: red');
        expect(logoutButton).toHaveStyle('color: white');
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

        // Initially return null for auth token, then after delay return a token
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
                <NavBar />
            </MemoryRouter>
        );

        // Advance timers to trigger retry
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
                <NavBar />
            </MemoryRouter>
        );

        // Advance timers beyond all retries
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

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <MemoryRouter>
                <NavBar />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockFetchNodes).toHaveBeenCalledWith('test-token');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error while calling fetchNodes:', 'Network error');
        });

        consoleErrorSpy.mockRestore();
    });
});
