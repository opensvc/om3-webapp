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
    AppBar: jest.fn(({children}) => <div data-testid="app-bar">{children}</div>),
    Toolbar: jest.fn(({children}) => <div data-testid="toolbar">{children}</div>),
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
        });
        require('../../context/AuthProvider.jsx').useAuthDispatch.mockReturnValue(mockAuthDispatch);
        require('../../context/OidcAuthContext.tsx').useOidc.mockReturnValue({
            userManager: {
                signoutRedirect: jest.fn(),
                removeUser: jest.fn(),
            },
        });
        localStorage.clear();
    });

    test('renders correctly with cluster path', () => {
        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        expect(screen.getByTestId('app-bar')).toBeInTheDocument();
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
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

        expect(screen.getByText('Cluster')).toBeInTheDocument();
        expect(screen.getByText('node1')).toBeInTheDocument();
        expect(screen.getByText('pod1')).toBeInTheDocument();
        expect(screen.getAllByText('>')).toHaveLength(2);
    });

    test('handles logout with openid auth', async () => {
        // Setup specific mocks for this test
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

        // Render the component
        render(
            <MemoryRouter>
                <NavBar/>
            </MemoryRouter>
        );

        // Check button rendering
        const logoutButton = screen.getByText('Logout');
        expect(logoutButton).toBeInTheDocument();
        console.log('Test 3: Logout button rendered');

        // Simulate click
        fireEvent.click(logoutButton);
        console.log('Test 3: Logout button clicked');

        // Assertions
        await waitFor(() => {
            console.log('Test 3: Checking mocks');
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

        expect(screen.queryByText('Cluster')).not.toBeInTheDocument();
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

        expect(screen.getByText('node 1')).toBeInTheDocument();
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
});
