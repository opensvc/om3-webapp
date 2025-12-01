import React from 'react';
import {render, screen, waitFor, act} from '@testing-library/react';
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
        __setMockUserManager: (um) => {
            mockUserManager = um;
        },
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

    test('renders NavBar and redirects from / to /cluster', async () => {
        const validToken = makeTokenWithExp(3600);
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

        expect(await screen.findByTestId('navbar')).toBeInTheDocument();
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('ProtectedRoute with valid basic token shows cluster', async () => {
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? validToken : (k === 'authChoice' ? 'basic' : null)
        );

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('invalid basic token redirects to auth-choice and clears storage', async () => {
        const invalidToken = makeTokenWithExp(-3600);
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? invalidToken : (k === 'authChoice' ? 'basic' : null)
        );

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
    });

    test('openid authChoice with malformed token present still allows render', async () => {
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? 'not-a-valid-jwt' : (k === 'authChoice' ? 'openid' : null)
        );
        mockAuthState.authChoice = 'openid';

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('initializeOidcOnStartup calls oidcConfiguration and recreateUserManager when not initialized', async () => {
        mockOidcModule.__setMockIsInitialized(false);
        const validToken = makeTokenWithExp(3600);

        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? validToken : (k === 'authChoice' ? 'openid' : null)
        );
        mockAuthState.authChoice = 'openid';

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/auth-choice']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/unknown-route']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(oidcConfiguration).not.toHaveBeenCalled();
            expect(mockRecreateUserManager).not.toHaveBeenCalled();
        });
    });

    test('initializeOidcOnStartup does not run without authInfo', async () => {
        const validToken = makeTokenWithExp(3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return validToken;
            if (k === 'authChoice') return 'openid';
            return null;
        });
        mockAuthState.authChoice = 'openid';

        const authInfoMock = require('../../hooks/AuthInfo.jsx');
        authInfoMock.mockImplementation(() => null); // authInfo null

        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(oidcConfiguration).not.toHaveBeenCalled();
            expect(mockRecreateUserManager).not.toHaveBeenCalled();
        });

        // Restore implementation
        authInfoMock.mockImplementation(() => ({
            openid: {issuer: 'https://test-issuer.com', client_id: 'test-client'}
        }));
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

        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('ProtectedRoute with null authChoice and invalid token', async () => {
        const invalidToken = makeTokenWithExp(-3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return invalidToken;
            if (k === 'authChoice') return null; // authChoice null
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('authChoice', expect.anything());
        });
    });

    test('handles om3:auth-redirect event', async () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

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

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

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
        // Note: This function is not directly exported, we test it indirectly
        // via ProtectedRoute
        const invalidToken = 'not.a.valid.jwt';
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return invalidToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('isTokenValid returns false for expired token', async () => {
        const expiredToken = makeTokenWithExp(-3600);
        mockLocalStorage.getItem.mockImplementation((k) => {
            if (k === 'authToken') return expiredToken;
            if (k === 'authChoice') return 'basic';
            return null;
        });

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });
});