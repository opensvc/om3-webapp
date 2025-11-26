import React from 'react';
import {render, screen, waitFor, within, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import WhoAmI from '../WhoAmI';
import {URL_AUTH_WHOAMI} from '../../config/apiPath';

// Mock the fetch API
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {value: mockLocalStorage});

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));

jest.mock('../../context/OidcAuthContext.tsx', () => ({
    useOidc: jest.fn(),
}));

jest.mock('../../context/AuthProvider.jsx', () => ({
    useAuth: jest.fn(),
    useAuthDispatch: jest.fn(),
    Logout: 'LOGOUT',
}));

describe('WhoAmI Component', () => {
    const mockToken = 'mock-auth-token';
    const mockUserInfo = {
        auth: 'user',
        grant: {root: null},
        namespace: 'system',
        raw_grant: 'root',
        name: 'testuser'
    };

    const mockNavigate = jest.fn();
    const mockAuthDispatch = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue(mockToken);

        // Mock useNavigate
        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);

        // Mock useAuth
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
            authToken: 'test-token',
        });

        // Mock useAuthDispatch
        require('../../context/AuthProvider.jsx').useAuthDispatch.mockReturnValue(mockAuthDispatch);

        // Mock useOidc
        require('../../context/OidcAuthContext.tsx').useOidc.mockReturnValue({
            userManager: {
                signoutRedirect: jest.fn(),
                removeUser: jest.fn(),
            },
        });

        // Mock GitHub API call for version
        global.fetch.mockImplementation((url) => {
            if (url === 'https://api.github.com/repos/opensvc/om3-webapp/releases') {
                return Promise.resolve({
                    json: () => Promise.resolve([{tag_name: 'v1.2.3'}]),
                });
            }
            if (url === URL_AUTH_WHOAMI) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockUserInfo),
                });
            }
            return Promise.reject(new Error(`Unknown URL: ${url}`));
        });
    });

    test('renders loading state initially', () => {
        render(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('displays error message on fetch failure', async () => {
        global.fetch.mockImplementation((url) => {
            if (url === URL_AUTH_WHOAMI) {
                return Promise.reject(new Error('Failed to load user information'));
            }
            return Promise.resolve({
                json: () => Promise.resolve([{tag_name: 'v1.2.3'}]),
            });
        });

        render(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load user information');
        });
    });

    test('displays user information on successful fetch', async () => {
        render(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        // Utiliser getAllByRole et prendre le premier élément (le titre principal)
        await waitFor(() => {
            const headings = screen.getAllByRole('heading', {name: /My Information/i});
            expect(headings[0]).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Identity')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Username')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('testuser')).toBeInTheDocument();
        });

        // CORRECTION : Remplacer "Authentication Method" par "Auth Method"
        await waitFor(() => {
            expect(screen.getByText('Auth Method')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Access')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Namespace')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('system')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Raw Permissions')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('root')).toBeInTheDocument();
        });

        await waitFor(() => {
            // eslint-disable-next-line testing-library/no-node-access
            const permissionSection = screen.getByText('Permission Details').parentElement;
            const preElement = within(permissionSection).getByText(/root.*null/i, {selector: 'pre'});
            expect(preElement).toHaveTextContent(/"root": null/);
        });

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(URL_AUTH_WHOAMI, {
                credentials: 'include',
                headers: {
                    Authorization: `Bearer ${mockToken}`,
                },
            });
        });
    });

    test('displays "None" for missing raw_grant', async () => {
        const userInfoNoRawGrant = {...mockUserInfo, raw_grant: null};
        global.fetch.mockImplementation((url) => {
            if (url === URL_AUTH_WHOAMI) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(userInfoNoRawGrant),
                });
            }
            return Promise.resolve({
                json: () => Promise.resolve([{tag_name: 'v1.2.3'}]),
            });
        });

        render(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Raw Permissions')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('None')).toBeInTheDocument();
        });
    });

    test('handles non-OK response with error message', async () => {
        global.fetch.mockImplementation((url) => {
            if (url === URL_AUTH_WHOAMI) {
                return Promise.resolve({
                    ok: false,
                    status: 401,
                    json: () => Promise.resolve({}),
                });
            }
            return Promise.resolve({
                json: () => Promise.resolve([{tag_name: 'v1.2.3'}]),
            });
        });

        render(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load user information');
        });
    });

    test('uses authToken from localStorage', async () => {
        render(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken');

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                URL_AUTH_WHOAMI,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockToken}`,
                    }),
                })
            );
        });
    });

    // NOUVEAUX TESTS POUR LE BOUTON LOGOUT
    test('renders logout button in WhoAmI', async () => {
        render(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /logout/i})).toBeInTheDocument();
        });
    });

    test('handles logout with openid auth', async () => {
        const mockSignoutRedirect = jest.fn();
        const mockRemoveUser = jest.fn();

        require('../../context/OidcAuthContext.tsx').useOidc.mockReturnValue({
            userManager: {
                signoutRedirect: mockSignoutRedirect,
                removeUser: mockRemoveUser,
            },
        });

        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'openid',
        });

        render(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /logout/i})).toBeInTheDocument();
        });

        const logoutButton = screen.getByRole('button', {name: /logout/i});
        fireEvent.click(logoutButton);

        expect(mockSignoutRedirect).toHaveBeenCalled();
        expect(mockRemoveUser).toHaveBeenCalled();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'LOGOUT'});
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
    });

    test('handles logout without openid auth', async () => {
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
        });

        const {userManager} = require('../../context/OidcAuthContext.tsx').useOidc();

        render(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /logout/i})).toBeInTheDocument();
        });

        const logoutButton = screen.getByRole('button', {name: /logout/i});
        fireEvent.click(logoutButton);

        expect(userManager.signoutRedirect).not.toHaveBeenCalled();
        expect(userManager.removeUser).not.toHaveBeenCalled();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'LOGOUT'});
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
    });
});
