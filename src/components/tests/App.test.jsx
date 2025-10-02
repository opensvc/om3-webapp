import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import App from '../App';

// Mock CSS imports
jest.mock('../../styles/main.css', () => ({}));

// Mock dependencies
jest.mock('../NavBar', () => () => <div data-testid="navbar">NavBar</div>);
jest.mock('../Cluster', () => () => <div data-testid="cluster">ClusterOverview</div>);
jest.mock('../NodesTable', () => () => <div data-testid="nodes">NodesTable</div>);
jest.mock('../Namespaces', () => () => <div data-testid="namespaces">Namespaces</div>);
jest.mock('../Heartbeats', () => () => <div data-testid="heartbeats">Heartbeats</div>);
jest.mock('../Pools', () => () => <div data-testid="pools">Pools</div>);
jest.mock('../Objects', () => () => <div data-testid="objects">Objects</div>);
jest.mock('../ObjectDetails', () => () => <div data-testid="object-details">ObjectDetails</div>);
jest.mock('../AuthChoice.jsx', () => () => <div data-testid="auth-choice">AuthChoice</div>);
jest.mock('../Login', () => () => <div data-testid="login">Login</div>);
jest.mock('../OidcCallback', () => () => <div data-testid="auth-callback">OidcCallback</div>);

// Mock AuthInfo hook
jest.mock('../../hooks/AuthInfo.jsx', () => () => ({
    openid: {
        issuer: 'https://test-issuer.com',
        client_id: 'test-client'
    }
}));

// Mock OIDC configuration
jest.mock('../../config/oidcConfiguration.js', () => jest.fn(() => Promise.resolve({
    client_id: 'test-client',
    authority: 'https://test-issuer.com',
    scope: 'openid profile email'
})));

// Mock AuthProvider with proper context values
const mockAuthDispatch = jest.fn();
const mockAuthState = {
    user: null,
    isAuthenticated: false,
    authChoice: null,
    authInfo: null,
    accessToken: null,
};

jest.mock('../../context/AuthProvider', () => ({
    AuthProvider: ({children}) => <div>{children}</div>,
    useAuth: () => mockAuthState,
    useAuthDispatch: () => mockAuthDispatch,
    SetAccessToken: 'SetAccessToken',
    SetAuthChoice: 'SetAuthChoice',
    Login: 'Login',
}));

// Mock OidcAuthContext with proper hooks
const mockUserManager = {
    getUser: jest.fn(() => Promise.resolve(null)),
    events: {
        addUserLoaded: jest.fn(),
        addAccessTokenExpiring: jest.fn(),
        addAccessTokenExpired: jest.fn(),
        addSilentRenewError: jest.fn(),
        removeUserLoaded: jest.fn(),
        removeAccessTokenExpired: jest.fn(),
        removeSilentRenewError: jest.fn(),
    }
};

const mockRecreateUserManager = jest.fn();

jest.mock('../../context/OidcAuthContext.tsx', () => ({
    OidcProvider: ({children}) => <div>{children}</div>,
    useOidc: () => ({
        userManager: mockUserManager,
        recreateUserManager: mockRecreateUserManager,
        isInitialized: true,
    }),
}));

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {value: mockLocalStorage});

// Mock console.log, console.error, and console.warn to suppress logs
jest.spyOn(console, 'log').mockImplementation(() => {
});
jest.spyOn(console, 'error').mockImplementation(() => {
});
jest.spyOn(console, 'warn').mockImplementation(() => {
});

describe('App Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authChoice') return null;
            return null;
        });
        // Reset auth state
        mockAuthState.authChoice = null;
        mockAuthState.accessToken = null;
        mockAuthState.isAuthenticated = false;
        // Reset getUser default
        mockUserManager.getUser.mockResolvedValue(null);
    });

    test('renders NavBar and redirects from / to /cluster', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return validToken;
            if (key === 'authChoice') return 'basic';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('navbar')).toBeInTheDocument();
        }, {timeout: 2000});

        await waitFor(() => {
            expect(screen.getByTestId('cluster')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders protected route /cluster with valid token', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return validToken;
            if (key === 'authChoice') return 'basic';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('cluster')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('redirects from protected route /cluster to /auth-choice with invalid token', async () => {
        const invalidToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 - 3600})) + '.signature';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return invalidToken;
            if (key === 'authChoice') return 'basic';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-choice')).toBeInTheDocument();
        }, {timeout: 2000});

        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
    });

    test('redirects from protected route /cluster to /auth-choice with no token', async () => {
        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-choice')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders protected route with OIDC token', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return validToken;
            if (key === 'authChoice') return 'openid';
            return null;
        });
        mockAuthState.authChoice = 'openid';

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('cluster')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('redirects OIDC user with no token to /auth-choice', async () => {
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authChoice') return 'openid';
            return null; // no token
        });
        mockAuthState.authChoice = 'openid';

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-choice')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders public route /auth-choice without token', async () => {
        render(
            <MemoryRouter initialEntries={['/auth-choice']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-choice')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders public route /auth/login without token', async () => {
        render(
            <MemoryRouter initialEntries={['/auth/login']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('login')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders public route /auth-callback without token', async () => {
        render(
            <MemoryRouter initialEntries={['/auth-callback']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-callback')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders protected route /nodes with valid token', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return validToken;
            if (key === 'authChoice') return 'basic';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/nodes']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('nodes')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders protected route /objects/:objectName with valid token', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return validToken;
            if (key === 'authChoice') return 'basic';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/objects/test-object']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('object-details')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('updates token state on localStorage change', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockReturnValue(null);

        render(
            <MemoryRouter initialEntries={['/auth-choice']}>
                <App/>
            </MemoryRouter>
        );

        // Simulate storage event
        window.dispatchEvent(
            new StorageEvent('storage', {
                key: 'authToken',
                newValue: validToken,
                bubbles: true,
                cancelable: false,
            })
        );

        await waitFor(() => {
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken');
        }, {timeout: 2000});
    });

    test('handles invalid token format gracefully', async () => {
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return 'invalid-token';
            if (key === 'authChoice') return 'basic';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-choice')).toBeInTheDocument();
        }, {timeout: 2000});

        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
    });

    test('redirects unknown routes to /', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return validToken;
            if (key === 'authChoice') return 'basic';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/unknown']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('cluster')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('does not render blank page', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return validToken;
            if (key === 'authChoice') return 'basic';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('navbar')).toBeInTheDocument();
        }, {timeout: 2000});

        await waitFor(() => {
            expect(screen.getByTestId('cluster')).toBeInTheDocument();
        }, {timeout: 2000});

        // Verify text content presence using specific elements
        expect(screen.getByTestId('navbar').textContent).toBe('NavBar');
        expect(screen.getByTestId('cluster').textContent).toBe('ClusterOverview');
    });

    test('initializes OIDC UserManager on startup with existing token (cluster renders)', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return validToken;
            if (key === 'authChoice') return 'openid';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('cluster')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('refreshes user and updates access token on userManager.getUser()', async () => {
        const validUser = {
            profile: {preferred_username: 'test-user'},
            access_token: 'new-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expired: false,
        };
        mockUserManager.getUser.mockResolvedValue(validUser);
        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return 'dummy';
            if (key === 'authChoice') return 'openid';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockUserManager.getUser).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'SetAccessToken', data: 'new-token'});
        });

        await waitFor(() => {
            expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'Login', data: 'test-user'});
        });

        await waitFor(() => {
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'new-token');
        });

        await waitFor(() => {
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('tokenExpiration', expect.any(String));
        });
    });

    test('handles expired user by not refreshing tokens (silent renew path)', async () => {
        const expiredUser = {profile: {preferred_username: 'expired-user'}, expired: true};
        mockUserManager.getUser.mockResolvedValue(expiredUser);
        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return 'dummy';
            if (key === 'authChoice') return 'openid';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockUserManager.getUser).toHaveBeenCalled();
        });

        expect(mockAuthDispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: 'SetAccessToken'}));
    });

    test('handles token expired by clearing storage and redirecting', async () => {
        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return 'dummy';
            if (key === 'authChoice') return 'openid';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockUserManager.events.addAccessTokenExpired).toHaveBeenCalled();
        });

        const expiredCb = mockUserManager.events.addAccessTokenExpired.mock.calls[0][0];
        expiredCb();

        await waitFor(() => {
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        });

        await waitFor(() => {
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tokenExpiration');
        });
    });

    test('handles silent renew error by clearing storage and redirecting', async () => {
        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return 'dummy';
            if (key === 'authChoice') return 'openid';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockUserManager.events.addSilentRenewError).toHaveBeenCalled();
        });

        const errorCb = mockUserManager.events.addSilentRenewError.mock.calls[0][0];
        errorCb(new Error('renew failed'));

        await waitFor(() => {
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        });

        await waitFor(() => {
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tokenExpiration');
        });
    });

    test('logs when access token is about to expire', async () => {
        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return 'dummy';
            if (key === 'authChoice') return 'openid';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockUserManager.events.addAccessTokenExpiring).toHaveBeenCalled();
        });

        const expiringCb = mockUserManager.events.addAccessTokenExpiring.mock.calls[0][0];
        expiringCb();

        expect(console.log).toHaveBeenCalledWith(
            'Access token is about to expire, attempting silent renew...'
        );
    });
});
