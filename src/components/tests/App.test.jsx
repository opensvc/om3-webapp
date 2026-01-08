import React from 'react';
import {render, screen, waitFor, act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import App from '../App';
import {DarkModeProvider} from '../../context/DarkModeContext';
import {ThemeProvider, createTheme} from '@mui/material/styles';

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
jest.mock('../Network', () => () => <div data-testid="network">Network</div>);
jest.mock('../NetworkDetails', () => () => <div data-testid="network-details">NetworkDetails</div>);
jest.mock('../WhoAmI', () => () => <div data-testid="whoami">WhoAmI</div>);
jest.mock('../SilentRenew.jsx', () => () => <div data-testid="silent-renew">SilentRenew</div>);
jest.mock('../AuthChoice.jsx', () => () => <div data-testid="auth-choice">AuthChoice</div>);
jest.mock('../Login', () => () => <div data-testid="login">Login</div>);
jest.mock('../OidcCallback', () => () => <div data-testid="auth-callback">OidcCallback</div>);

jest.mock('../../hooks/AuthInfo.jsx', () => jest.fn(() => ({
    openid: {
        issuer: 'https://test-issuer.com',
        client_id: 'test-client'
    }
})));

jest.mock('../../config/oidcConfiguration.js', () => jest.fn(() => Promise.resolve({
    client_id: 'test-client',
    authority: 'https://test-issuer.com',
    scope: 'openid profile email'
})));
const oidcConfiguration = require('../../config/oidcConfiguration.js');

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

let mockUserManager = {
    getUser: jest.fn(() => Promise.resolve(null)),
    signinSilent: jest.fn(() => Promise.resolve(null)),
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
let mockRecreateUserManager = jest.fn();
let mockIsInitialized = true;

jest.mock('../../context/OidcAuthContext.tsx', () => {
    return {
        OidcProvider: ({children}) => <div>{children}</div>,
        useOidc: () => ({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
            isInitialized: mockIsInitialized,
        }),
        __setMockRecreateUserManager: (fn) => {
            mockRecreateUserManager = fn;
        },
        __setMockIsInitialized: (v) => {
            mockIsInitialized = v;
        },
    };
});
const mockOidcModule = require('../../context/OidcAuthContext.tsx');

const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {value: mockLocalStorage});

jest.spyOn(console, 'log').mockImplementation(() => {
});
jest.spyOn(console, 'error').mockImplementation(() => {
});
jest.spyOn(console, 'warn').mockImplementation(() => {
});
jest.spyOn(console, 'debug').mockImplementation(() => {
});

const makeTokenWithExp = (expSecondsFromNow) => {
    const payload = {exp: Math.floor(Date.now() / 1000) + expSecondsFromNow};
    return 'h.' + btoa(JSON.stringify(payload)) + '.s';
};

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

describe('App Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockLocalStorage.getItem.mockImplementation(() => null);
        mockLocalStorage.setItem.mockImplementation(() => {
        });
        mockLocalStorage.removeItem.mockImplementation(() => {
        });

        mockAuthState.authChoice = null;
        mockAuthState.accessToken = null;
        mockAuthState.isAuthenticated = false;

        mockUserManager.getUser.mockResolvedValue(null);
        mockUserManager.signinSilent.mockResolvedValue(null);
        mockUserManager.events.addUserLoaded.mockClear();
        mockUserManager.events.addAccessTokenExpiring.mockClear();
        mockUserManager.events.addAccessTokenExpired.mockClear();
        mockUserManager.events.addSilentRenewError.mockClear();
        mockUserManager.events.removeUserLoaded.mockClear();
        mockUserManager.events.removeAccessTokenExpired.mockClear();
        mockUserManager.events.removeSilentRenewError.mockClear();

        mockRecreateUserManager = jest.fn();
        mockOidcModule.__setMockRecreateUserManager(mockRecreateUserManager);
        mockOidcModule.__setMockIsInitialized(true);

        oidcConfiguration.mockClear();
        mockNavigate.mockClear();
    });

    // Helper function to render with all providers
    const renderAppWithProviders = (initialEntries = ['/']) => {
        const theme = createTheme();

        return render(
            <DarkModeProvider>
                <ThemeProvider theme={theme}>
                    <MemoryRouter initialEntries={initialEntries}>
                        <App/>
                    </MemoryRouter>
                </ThemeProvider>
            </DarkModeProvider>
        );
    };

    test('renders NavBar and redirects from / to /cluster', async () => {
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return validToken;
            if (key === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/']);

        expect(await screen.findByTestId('navbar')).toBeInTheDocument();
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('ProtectedRoute with valid basic token shows cluster', async () => {
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? validToken : (k === 'authChoice' ? 'basic' : null)
        );

        renderAppWithProviders(['/cluster']);

        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('invalid basic token redirects to auth-choice and clears storage', async () => {
        const invalidToken = makeTokenWithExp(-3600);
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? invalidToken : (k === 'authChoice' ? 'basic' : null)
        );

        renderAppWithProviders(['/cluster']);

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
    });

    test('openid authChoice with malformed token present still allows render', async () => {
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'not-a-valid-jwt' : (k === 'authChoice' ? 'openid' : null)
        );
        mockAuthState.authChoice = 'openid';

        renderAppWithProviders(['/cluster']);

        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('initializeOidcOnStartup calls oidcConfiguration and recreateUserManager when not initialized', async () => {
        mockOidcModule.__setMockIsInitialized(false);
        const validToken = makeTokenWithExp(3600);

        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? validToken : (k === 'authChoice' ? 'openid' : null)
        );
        mockAuthState.authChoice = 'openid';

        renderAppWithProviders(['/cluster']);

        await waitFor(() => expect(oidcConfiguration).toHaveBeenCalled());
        await waitFor(() => expect(mockRecreateUserManager).toHaveBeenCalled());

        mockOidcModule.__setMockIsInitialized(true);
    });

    test('initializeOidcOnStartup handles oidcConfiguration rejection gracefully', async () => {
        mockOidcModule.__setMockIsInitialized(false);
        oidcConfiguration.mockImplementationOnce(() =>
            Promise.reject(new Error('config failed'))
        );

        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? validToken : (k === 'authChoice' ? 'openid' : null)
        );
        mockAuthState.authChoice = 'openid';

        renderAppWithProviders(['/cluster']);

        await new Promise(r => setTimeout(r, 200));
        expect(oidcConfiguration).toHaveBeenCalled();
        expect(mockRecreateUserManager).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();

        mockOidcModule.__setMockIsInitialized(true);
    });

    test('initializeOidcOnStartup handles recreateUserManager throwing', async () => {
        mockOidcModule.__setMockIsInitialized(false);

        oidcConfiguration.mockImplementationOnce(() =>
            Promise.resolve({client_id: 'x'})
        );

        mockRecreateUserManager = jest.fn(() => {
            throw new Error('boom create');
        });
        mockOidcModule.__setMockRecreateUserManager(mockRecreateUserManager);

        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? validToken : (k === 'authChoice' ? 'openid' : null)
        );
        mockAuthState.authChoice = 'openid';

        renderAppWithProviders(['/cluster']);

        await new Promise(r => setTimeout(r, 200));
        expect(oidcConfiguration).toHaveBeenCalled();
        expect(mockRecreateUserManager).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();

        mockOidcModule.__setMockIsInitialized(true);
    });

    test('initializeOidcOnStartup does not run if authInfo hook returns null', async () => {
        mockOidcModule.__setMockIsInitialized(false);

        const authInfoMock = require('../../hooks/AuthInfo.jsx');
        authInfoMock.mockImplementationOnce(() => null);

        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? validToken : (k === 'authChoice' ? 'openid' : null)
        );
        mockAuthState.authChoice = 'openid';

        renderAppWithProviders(['/cluster']);

        await new Promise(r => setTimeout(r, 200));
        expect(oidcConfiguration).not.toHaveBeenCalled();
        expect(mockRecreateUserManager).not.toHaveBeenCalled();

        authInfoMock.mockImplementation(() => ({
            openid: {issuer: 'https://test-issuer.com', client_id: 'test-client'}
        }));
        mockOidcModule.__setMockIsInitialized(true);
    });

    test('userManager.getUser valid user triggers login + token refresh', async () => {
        const validUser = {
            profile: {preferred_username: 'test-user'},
            access_token: 'new-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expired: false,
        };

        mockUserManager.getUser.mockResolvedValue(validUser);
        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        await waitFor(() =>
            expect(mockAuthDispatch).toHaveBeenCalledWith({
                type: 'SetAccessToken',
                data: 'new-token'
            })
        );

        await waitFor(() =>
            expect(mockAuthDispatch).toHaveBeenCalledWith({
                type: 'Login',
                data: 'test-user'
            })
        );

        await waitFor(() =>
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                'authToken',
                'new-token'
            )
        );

        await waitFor(() =>
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                'tokenExpiration',
                expect.any(String)
            )
        );
    });

    test('expired user does not trigger SetAccessToken dispatch', async () => {
        const expiredUser = {
            profile: {preferred_username: 'expired-user'},
            expired: true
        };

        mockUserManager.getUser.mockResolvedValue(expiredUser);
        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        expect(mockAuthDispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({type: 'SetAccessToken'})
        );
    });

    test('addAccessTokenExpired handler clears storage', async () => {
        mockAuthState.authChoice = 'openid';

        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        await waitFor(() =>
            expect(mockUserManager.events.addAccessTokenExpired).toHaveBeenCalled()
        );

        const expiredCb = mockUserManager.events.addAccessTokenExpired.mock.calls[0][0];

        act(() => expiredCb());

        await waitFor(() =>
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken')
        );

        await waitFor(() =>
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'tokenExpiration'
            )
        );
    });

    test('addSilentRenewError handler clears storage', async () => {
        mockAuthState.authChoice = 'openid';

        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        await waitFor(() =>
            expect(mockUserManager.events.addSilentRenewError).toHaveBeenCalled()
        );

        const errorCb = mockUserManager.events.addSilentRenewError.mock.calls[0][0];

        act(() => errorCb(new Error('renew failed')));

        await waitFor(() =>
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken')
        );

        await waitFor(() =>
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tokenExpiration')
        );
    });

    test('addAccessTokenExpiring listener logs debug', async () => {
        mockAuthState.authChoice = 'openid';

        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        await waitFor(() =>
            expect(mockUserManager.events.addAccessTokenExpiring).toHaveBeenCalled()
        );

        const expiringCb =
            mockUserManager.events.addAccessTokenExpiring.mock.calls[0][0];

        act(() => expiringCb());

        expect(console.debug).toHaveBeenCalled();
    });

    test('removes old listeners when setting up new ones', async () => {
        mockAuthState.authChoice = 'openid';

        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        await waitFor(() =>
            expect(mockUserManager.events.removeUserLoaded).toHaveBeenCalled()
        );
        await waitFor(() =>
            expect(mockUserManager.events.removeAccessTokenExpired).toHaveBeenCalled()
        );
        await waitFor(() =>
            expect(mockUserManager.events.removeSilentRenewError).toHaveBeenCalled()
        );
    });

    test('storage event triggers checkTokenChange', async () => {
        mockLocalStorage.getItem.mockReturnValue(null);

        renderAppWithProviders(['/auth-choice']);

        act(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'authToken',
                    newValue: makeTokenWithExp(3600)
                })
            );
        });

        await waitFor(() =>
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken')
        );
    });

    test('focus triggers redirect when token invalid', async () => {
        const invalidToken = makeTokenWithExp(-3600);
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? invalidToken : (k === 'authChoice' ? 'basic' : null)
        );

        renderAppWithProviders(['/cluster']);

        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('visibilitychange does not redirect for valid openid', async () => {
        mockAuthState.authChoice = 'openid';

        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy-token' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        act(() => {
            Object.defineProperty(document, 'visibilityState', {
                value: 'visible',
                configurable: true
            });
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('saves auth.authChoice to localStorage', async () => {
        mockAuthState.authChoice = 'basic';

        renderAppWithProviders(['/']);

        await waitFor(() =>
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                'authChoice',
                'basic'
            )
        );
    });

    test('unknown route redirects to /cluster', async () => {
        const validToken = makeTokenWithExp(3600);

        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? validToken : (k === 'authChoice' ? 'basic' : null)
        );

        renderAppWithProviders(['/unknown-route']);

        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('initializeOidcOnStartup does not run if savedAuthChoice is not openid', async () => {
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'basic'; // Not 'openid'
            return null;
        });
        mockAuthState.authChoice = 'basic';

        renderAppWithProviders(['/']);

        await waitFor(() => {
            expect(oidcConfiguration).not.toHaveBeenCalled();
            expect(mockRecreateUserManager).not.toHaveBeenCalled();
        });
    });

    test('initializeOidcOnStartup does not run without token', async () => {
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return null; // No token
            if (k === 'authChoice') return 'openid';
            return null;
        });
        mockAuthState.authChoice = 'openid';

        renderAppWithProviders(['/']);

        await waitFor(() => {
            expect(oidcConfiguration).not.toHaveBeenCalled();
            expect(mockRecreateUserManager).not.toHaveBeenCalled();
        });
    });

    test('initializeOidcOnStartup does not run if already initialized', async () => {
        mockOidcModule.__setMockIsInitialized(true);
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'openid';
            return null;
        });
        mockAuthState.authChoice = 'openid';

        renderAppWithProviders(['/']);

        await waitFor(() => {
            expect(oidcConfiguration).not.toHaveBeenCalled();
            expect(mockRecreateUserManager).not.toHaveBeenCalled();
        });
    });

    test('userManager.getUser returns null does not trigger login', async () => {
        mockUserManager.getUser.mockResolvedValue(null);
        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());

        // Should not trigger SetAccessToken
        expect(mockAuthDispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({type: 'SetAccessToken'})
        );

        // Should not trigger Login
        expect(mockAuthDispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({type: 'Login'})
        );
    });

    test('silent renew fails on expired user', async () => {
        const expiredUser = {
            profile: {preferred_username: 'expired-user'},
            expired: true,
        };

        mockUserManager.getUser.mockResolvedValue(expiredUser);
        mockUserManager.signinSilent.mockRejectedValue(new Error('Renew failed'));

        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        await waitFor(() => expect(mockUserManager.signinSilent).toHaveBeenCalled());

        expect(console.error).toHaveBeenCalledWith('Silent renew failed:', expect.any(Error));
    });

    test('ProtectedRoute redirects if authChoice openid without token', async () => {
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return null; // No token
            if (k === 'authChoice') return 'openid';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('ProtectedRoute with null authChoice and invalid token', async () => {
        const invalidToken = makeTokenWithExp(-3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return invalidToken;
            if (k === 'authChoice') return null; // authChoice null
            return null;
        });

        renderAppWithProviders(['/cluster']);

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tokenExpiration');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authChoice');
    });

    test('handleCheckAuthOnResume does not redirect for OIDC with token', async () => {
        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return 'oidc-token';
            if (k === 'authChoice') return 'openid';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        // Simulate focus
        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        // Should not redirect
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
        expect(screen.queryByTestId('auth-choice')).not.toBeInTheDocument();
    });

    test('handleCheckAuthOnResume does not redirect for basic auth with valid token', async () => {
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        // Simulate focus
        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        // Should not redirect
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
        expect(screen.queryByTestId('auth-choice')).not.toBeInTheDocument();
    });

    test('does not save authChoice to localStorage if auth.authChoice is null', async () => {
        mockAuthState.authChoice = null;

        renderAppWithProviders(['/']);

        await waitFor(() => {
            expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('authChoice', expect.anything());
        });
    });

    test('handles om3:auth-redirect event', async () => {
        renderAppWithProviders(['/']);

        act(() => {
            window.dispatchEvent(new CustomEvent('om3:auth-redirect', {
                detail: '/auth-choice'
            }));
        });

        // Check that navigate was called
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true});
    });

    test('handles storage event with new token', async () => {
        const newToken = makeTokenWithExp(3600);

        // First, set up the initial state with no token
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return null;
            return null;
        });

        renderAppWithProviders(['/']);

        // Now change the mock to return the new token when getItem is called after the storage event
        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authToken') return newToken;
            return null;
        });

        act(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'authToken',
                    newValue: newToken,
                    oldValue: 'old-token',
                    url: window.location.href
                })
            );
        });

        // Wait for the component to process the event
        await waitFor(() => {
            // Check that getItem was called with 'authToken'
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken');
        });

        // The component logs multiple debug messages, we need to find the storage event one
        const debugCalls = console.debug.mock.calls;
        const storageEventCalls = debugCalls.filter(call =>
            call[0] === 'Storage event: newToken='
        );

        // Should have at least one storage event log
        expect(storageEventCalls.length).toBeGreaterThan(0);

        // The last storage event should have the newToken
        const lastStorageCall = storageEventCalls[storageEventCalls.length - 1];
        expect(lastStorageCall[0]).toBe('Storage event: newToken=');
        expect(lastStorageCall[1]).toBe(newToken);
    });

    test('handles errors in handleCheckAuthOnResume', async () => {
        mockLocalStorage.getItem.mockImplementation(() => {
            throw new Error('Storage error');
        });

        // We need a valid token to reach the handleCheckAuthOnResume
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        // Now mock getItem to throw error for the focus event
        mockLocalStorage.getItem.mockImplementation(() => {
            throw new Error('Storage error');
        });

        // Simulate focus (which will trigger the error)
        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(
                'Error while checking auth on resume:',
                expect.any(Error)
            );
        });
    });

    test('isTokenValid returns false for malformed token', async () => {
        const invalidToken = 'not.a.valid.jwt';
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return invalidToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('isTokenValid returns false for expired token', async () => {
        const expiredToken = makeTokenWithExp(-3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return expiredToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('handles silent renew error callback with error parameter', async () => {
        mockAuthState.authChoice = 'openid';

        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        await waitFor(() =>
            expect(mockUserManager.events.addSilentRenewError).toHaveBeenCalled()
        );

        const errorCb = mockUserManager.events.addSilentRenewError.mock.calls[0][0];

        act(() => errorCb(new Error('renew failed')));

        await waitFor(() =>
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken')
        );

        await waitFor(() =>
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tokenExpiration')
        );

        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true});
    });

    test('onUserRefreshed callback handles user without profile', async () => {
        mockAuthState.authChoice = 'openid';

        const userWithoutProfile = {
            access_token: 'new-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
        };

        // Simulate that getUser returns this user
        mockUserManager.getUser.mockResolvedValue(userWithoutProfile);

        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        // Wait for getUser to be called
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());

        // The onUserRefreshed callback should still be called
        await waitFor(() =>
            expect(mockAuthDispatch).toHaveBeenCalledWith({
                type: 'SetAccessToken',
                data: 'new-token'
            })
        );

        // But Login action should not be dispatched since there's no profile
        expect(mockAuthDispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({type: 'Login', data: expect.anything()})
        );
    });

    test('visibilitychange triggers auth check on resume', async () => {
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        // Mock document.visibilityState
        Object.defineProperty(document, 'visibilityState', {
            value: 'visible',
            configurable: true,
        });

        // Trigger visibilitychange event
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        // Should not redirect since token is valid
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('handleCheckAuthOnResume handles OIDC with valid token', async () => {
        mockAuthState.authChoice = 'openid';

        // Mock valid token (not expired)
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'openid';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        // Simulate focus
        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        // Should not redirect
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalledWith('/auth-choice', {replace: true});
    });

    test('handleCheckAuthOnResume handles basic auth with expired token', async () => {
        mockAuthState.authChoice = 'basic';

        // Mock expired token
        const expiredToken = makeTokenWithExp(-3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return expiredToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        // Simulate focus
        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        // Should redirect
        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true});
    });

    test('event listeners are cleaned up on unmount', async () => {
        const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
        const documentAddEventListenerSpy = jest.spyOn(document, 'addEventListener');
        const documentRemoveEventListenerSpy = jest.spyOn(document, 'removeEventListener');

        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        const {unmount} = renderAppWithProviders(['/']);

        // Wait for initial render
        await screen.findByTestId('navbar');

        // Unmount the component
        unmount();

        // Check that event listeners were removed
        expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('om3:auth-redirect', expect.any(Function));
        expect(documentRemoveEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    test('handles all route paths correctly', async () => {
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        // Test each protected route
        const routes = [
            {path: '/namespaces', testId: 'namespaces'},
            {path: '/nodes', testId: 'nodes'},
            {path: '/storage-pools', testId: 'pools'},
            {path: '/network', testId: 'network'},
            {path: '/objects', testId: 'objects'},
            {path: '/whoami', testId: 'whoami'},
        ];

        for (const route of routes) {
            mockNavigate.mockClear();
            const {unmount} = renderAppWithProviders([route.path]);

            await waitFor(() => {
                expect(screen.getByTestId(route.testId)).toBeInTheDocument();
            });

            unmount();
        }

        // Test non-protected routes
        const nonProtectedRoutes = [
            {path: '/heartbeats', testId: 'heartbeats'},
            {path: '/silent-renew', testId: 'silent-renew'},
            {path: '/auth-callback', testId: 'auth-callback'},
            {path: '/auth-choice', testId: 'auth-choice'},
            {path: '/auth/login', testId: 'login'},
        ];

        for (const route of nonProtectedRoutes) {
            mockNavigate.mockClear();
            const {unmount} = renderAppWithProviders([route.path]);

            await waitFor(() => {
                expect(screen.getByTestId(route.testId)).toBeInTheDocument();
            });

            unmount();
        }
    });

    test('ProtectedRoute with null token and null authChoice', async () => {
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return null;
            if (k === 'authChoice') return null;
            return null;
        });

        renderAppWithProviders(['/cluster']);

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('onUserRefreshed callback is called when user loaded event fires', async () => {
        mockAuthState.authChoice = 'openid';

        renderAppWithProviders(['/cluster']);

        await waitFor(() =>
            expect(mockUserManager.events.addUserLoaded).toHaveBeenCalled()
        );

        const userLoadedCallback = mockUserManager.events.addUserLoaded.mock.calls[0][0];
        expect(userLoadedCallback).toBeDefined();

        const testUser = {
            profile: {preferred_username: 'event-user'},
            access_token: 'event-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
        };

        // Call the callback directly
        act(() => {
            userLoadedCallback(testUser);
        });

        await waitFor(() =>
            expect(mockAuthDispatch).toHaveBeenCalledWith({
                type: 'SetAccessToken',
                data: 'event-token'
            })
        );

        await waitFor(() =>
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'event-token')
        );
    });

    // NOUVEAUX TESTS POUR AMÉLIORER LA COUVERTURE - SIMPLIFIÉS

    test('isTokenValid returns false for null token', async () => {
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return null; // null token
            if (k === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('isTokenValid returns false for empty token string', async () => {
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return ''; // empty string token
            if (k === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('onUserRefreshed handles user with profile but no preferred_username', async () => {
        mockAuthState.authChoice = 'openid';

        const userWithProfileNoUsername = {
            profile: {}, // Profile exists but no preferred_username
            access_token: 'token-no-username',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
        };

        renderAppWithProviders(['/cluster']);

        await waitFor(() =>
            expect(mockUserManager.events.addUserLoaded).toHaveBeenCalled()
        );

        const userLoadedCallback = mockUserManager.events.addUserLoaded.mock.calls[0][0];

        // Call the callback with user without preferred_username
        act(() => {
            userLoadedCallback(userWithProfileNoUsername);
        });

        await waitFor(() =>
            expect(mockAuthDispatch).toHaveBeenCalledWith({
                type: 'SetAccessToken',
                data: 'token-no-username'
            })
        );

        // Login action should not be dispatched since there's no preferred_username
        expect(mockAuthDispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({type: 'Login', data: expect.anything()})
        );
    });

    test('handleTokenExpired callback navigates to auth-choice', async () => {
        mockAuthState.authChoice = 'openid';

        renderAppWithProviders(['/cluster']);

        await waitFor(() =>
            expect(mockUserManager.events.addAccessTokenExpired).toHaveBeenCalled()
        );

        const expiredCb = mockUserManager.events.addAccessTokenExpired.mock.calls[0][0];

        act(() => expiredCb());

        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true})
        );
    });

    test('silent renew on expired user with successful renew', async () => {
        const expiredUser = {
            profile: {preferred_username: 'expired-user'},
            expired: true,
        };

        const refreshedUser = {
            profile: {preferred_username: 'refreshed-user'},
            access_token: 'refreshed-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expired: false,
        };

        mockUserManager.getUser.mockResolvedValue(expiredUser);
        mockUserManager.signinSilent.mockResolvedValue(refreshedUser);

        mockAuthState.authChoice = 'openid';
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'dummy' : (k === 'authChoice' ? 'openid' : null)
        );

        renderAppWithProviders(['/cluster']);

        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        await waitFor(() => expect(mockUserManager.signinSilent).toHaveBeenCalled());

        // Should dispatch actions for refreshed user
        await waitFor(() =>
            expect(mockAuthDispatch).toHaveBeenCalledWith({
                type: 'SetAccessToken',
                data: 'refreshed-token'
            })
        );

        await waitFor(() =>
            expect(mockAuthDispatch).toHaveBeenCalledWith({
                type: 'Login',
                data: 'refreshed-user'
            })
        );
    });

    test('network details route with parameter', async () => {
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/network/test-network']);

        expect(await screen.findByTestId('network-details')).toBeInTheDocument();
    });

    test('object details route with parameter', async () => {
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        renderAppWithProviders(['/objects/test-object']);

        expect(await screen.findByTestId('object-details')).toBeInTheDocument();
    });

    test('auth choice saved to localStorage when authChoice changes', async () => {
        // Simulate authChoice changing from null to 'basic'
        let currentAuthChoice = null;
        mockAuthState.authChoice = 'basic';

        mockLocalStorage.setItem.mockImplementation((key, value) => {
            if (key === 'authChoice') {
                currentAuthChoice = value;
            }
        });

        mockLocalStorage.getItem.mockImplementation((key) => {
            if (key === 'authChoice') return currentAuthChoice;
            return null;
        });

        renderAppWithProviders(['/']);

        await waitFor(() => {
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authChoice', 'basic');
        });
    });

    test('handleCheckAuthOnResume for OIDC with no token', async () => {
        mockAuthState.authChoice = 'openid';

        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return null; // No token
            if (k === 'authChoice') return 'openid';
            return null;
        });

        renderAppWithProviders(['/cluster']);

        // Simulate focus
        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        // Should redirect
        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true});
    });

    test('handleCheckAuthOnResume for OIDC with expired token and userManager', async () => {
        mockAuthState.authChoice = 'openid';

        // Mock expired token
        const expiredToken = makeTokenWithExp(-3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return expiredToken;
            if (k === 'authChoice') return 'openid';
            return null;
        });

        // Mock successful silent renew
        const refreshedUser = {
            profile: {preferred_username: 'refreshed-user'},
            access_token: 'refreshed-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expired: false,
        };

        mockUserManager.signinSilent.mockResolvedValue(refreshedUser);

        renderAppWithProviders(['/cluster']);

        // Simulate focus event
        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        // Wait for silent renew to complete
        await waitFor(() => expect(mockUserManager.signinSilent).toHaveBeenCalled());

        // Should update storage
        await waitFor(() =>
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'refreshed-token')
        );

        // Should not redirect
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });
});