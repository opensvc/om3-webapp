import React from 'react';
import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import WhoAmI from '../WhoAmI';
import {URL_AUTH_WHOAMI} from '../../config/apiPath';
import {DarkModeProvider} from '../../context/DarkModeContext';

// Mock the fetch API
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn(),
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

jest.mock('../../hooks/useFetchDaemonStatus', () => jest.fn());

jest.mock('../../utils/logger.js', () => ({
    error: jest.fn(),
    info: jest.fn(),
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
    const mockFetchNodes = jest.fn();
    const mockUseFetchDaemonStatus = require('../../hooks/useFetchDaemonStatus');

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock localStorage.getItem
        mockLocalStorage.getItem.mockImplementation((key) => {
            switch (key) {
                case 'authToken':
                    return mockToken;
                case 'darkMode':
                    return 'false';
                case 'appVersion':
                    return null;
                case 'appVersionTime':
                    return null;
                case 'tokenExpiration':
                    return null;
                case 'authChoice':
                    return 'local';
                default:
                    return null;
            }
        });

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

        mockUseFetchDaemonStatus.mockReturnValue({
            daemon: {nodename: 'test-node'},
            fetchNodes: mockFetchNodes,
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

    // Helper function to render with DarkModeProvider
    const renderWithDarkModeProvider = (ui, options) => {
        return render(
            <DarkModeProvider>
                {ui}
            </DarkModeProvider>,
            options
        );
    };

    test('renders loading state initially', () => {
        renderWithDarkModeProvider(
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

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load user information');
        });
    });

    test('displays user information on successful fetch', async () => {
        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        // Main title
        await waitFor(() => {
            const headings = screen.getAllByRole('heading', {name: /My Information/i});
            expect(headings[0]).toBeInTheDocument();
        });

        // Identity block
        await waitFor(() => {
            expect(screen.getByText('Identity')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Username')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('testuser')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Auth Method')).toBeInTheDocument();
        });

        // Permission Details
        await waitFor(() => {
            expect(screen.getByText('Permission Details')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Raw Permissions')).toBeInTheDocument();
        });

        // grant.root
        await waitFor(() => {
            expect(screen.getByText(/root/i)).toBeInTheDocument();
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

        renderWithDarkModeProvider(
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

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load user information');
        });
    });

    test('uses authToken from localStorage', async () => {
        renderWithDarkModeProvider(
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

    test('renders logout button in WhoAmI', async () => {
        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /logout/i})).toBeInTheDocument();
        });
    });

    test('renders dark mode toggle button', async () => {
        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /dark mode/i})).toBeInTheDocument();
        });
    });

    test('dark mode button calls toggleDarkMode when clicked', async () => {
        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            const darkModeButton = screen.getByRole('button', {name: /dark mode/i});
            fireEvent.click(darkModeButton);
        });
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
        });

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /logout/i})).toBeInTheDocument();
        });

        const logoutButton = screen.getByRole('button', {name: /logout/i});
        fireEvent.click(logoutButton);

        await waitFor(() => {
            expect(mockSignoutRedirect).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(mockRemoveUser).toHaveBeenCalled();
        });

        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'LOGOUT'});
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
    });

    test('handles logout without openid auth', async () => {
        require('../../context/AuthProvider.jsx').useAuth.mockReturnValue({
            authChoice: 'local',
        });

        const {userManager} = require('../../context/OidcAuthContext.tsx').useOidc();

        renderWithDarkModeProvider(
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

    test('does not call fetchNodes when no authToken in localStorage', async () => {
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return null;
            if (key === 'darkMode') return 'false';
            return null;
        });

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            const titles = screen.getAllByText('My Information');
            expect(titles.length).toBeGreaterThan(0);
            expect(titles[0]).toBeInTheDocument();
        });

        expect(mockFetchNodes).not.toHaveBeenCalled();
    });

    test('calls fetchNodes when authToken exists in localStorage', async () => {
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return mockToken;
            if (key === 'darkMode') return 'false';
            return null;
        });

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockFetchNodes).toHaveBeenCalledWith(mockToken);
        });
    });

    test('handles error in fetchNodes call', async () => {
        const mockLogger = require('../../utils/logger.js');
        mockFetchNodes.mockRejectedValue(new Error('Daemon fetch failed'));

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockLogger.error).toHaveBeenCalledWith('Error fetching daemon status:', expect.any(Error));
        });
    });

    test('sets appVersion to cached value when cache is valid', async () => {
        const cachedVersion = '1.0.0';
        const cacheTime = Date.now().toString();

        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'appVersion') return cachedVersion;
            if (key === 'appVersionTime') return cacheTime;
            if (key === 'authToken') return mockToken;
            if (key === 'darkMode') return 'false';
            return null;
        });

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(`v${cachedVersion}`)).toBeInTheDocument();
        });

        // Should not call GitHub API
        expect(global.fetch).not.toHaveBeenCalledWith('https://api.github.com/repos/opensvc/om3-webapp/releases');
    });

    test('fetches appVersion from GitHub when cache is expired', async () => {
        const oldCacheTime = (Date.now() - 4000000).toString(); // More than 1 hour ago
        const cachedVersion = '1.0.0';

        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'appVersion') return cachedVersion;
            if (key === 'appVersionTime') return oldCacheTime;
            if (key === 'authToken') return mockToken;
            if (key === 'darkMode') return 'false';
            return null;
        });

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('v1.2.3')).toBeInTheDocument();
        });

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('appVersion', '1.2.3');
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('appVersionTime', expect.any(String));
    });

    test('sets appVersion to cached value when GitHub fetch fails but cache exists', async () => {
        const cachedVersion = '1.0.0';
        const cacheTime = (Date.now() - 4000000).toString(); // Expired cache

        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'appVersion') return cachedVersion;
            if (key === 'appVersionTime') return cacheTime;
            if (key === 'authToken') return mockToken;
            if (key === 'darkMode') return 'false';
            return null;
        });

        global.fetch.mockImplementation((url) => {
            if (url === URL_AUTH_WHOAMI) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockUserInfo),
                });
            }
            if (url.includes('github')) {
                return Promise.reject(new Error('Network error'));
            }
        });

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(`v${cachedVersion}`)).toBeInTheDocument();
        });
    });

    test('sets appVersion to Unknown when GitHub fetch fails and no cache exists', async () => {
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'appVersion') return null;
            if (key === 'appVersionTime') return null;
            if (key === 'authToken') return mockToken;
            if (key === 'darkMode') return 'false';
            return null;
        });

        global.fetch.mockImplementation((url) => {
            if (url === URL_AUTH_WHOAMI) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockUserInfo),
                });
            }
            if (url.includes('github')) {
                return Promise.reject(new Error('Network error'));
            }
        });

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('vUnknown')).toBeInTheDocument();
        });
    });

    test('handles daemon status with missing nodename', async () => {
        mockUseFetchDaemonStatus.mockReturnValue({
            daemon: {},
            fetchNodes: mockFetchNodes,
        });

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    test('handles WhoAmI fetch with missing auth token', async () => {
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return null;
            if (key === 'darkMode') return 'false';
            return null;
        });

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(URL_AUTH_WHOAMI, {
                credentials: 'include',
                headers: {
                    Authorization: 'Bearer null',
                },
            });
        });
    });

    test('handles WhoAmI response with missing fields', async () => {
        const incompleteUserInfo = {
            auth: null,
            name: null,
            raw_grant: null
        };

        global.fetch.mockImplementation((url) => {
            if (url === URL_AUTH_WHOAMI) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(incompleteUserInfo),
                });
            }
            return Promise.resolve({
                json: () => Promise.resolve([{tag_name: 'v1.2.3'}]),
            });
        });

        renderWithDarkModeProvider(
            <MemoryRouter>
                <WhoAmI/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
        });
    });
});
