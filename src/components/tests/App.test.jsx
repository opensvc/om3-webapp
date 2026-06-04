import React from 'react';
import {render, screen, waitFor, act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import App from '../App';
import {DarkModeProvider} from '../../context/DarkModeContext';
import {ThemeProvider, createTheme} from '@mui/material/styles';

jest.mock('../../styles/main.css', () => ({}));
jest.mock('../../utils/logger.js', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));
const logger = require('../../utils/logger.js');
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
jest.mock('../OidcCallback', () => () => <div data-testid="auth-callback">OidcCallback</div>);
jest.mock('../Login', () => ({
    __esModule: true,
    default: () => <div data-testid="login">Login</div>,
    decodeToken: jest.fn(),
    refreshToken: jest.fn(),
}));

const mockDecodeToken = jest.requireMock('../Login').decodeToken;

jest.mock('../../hooks/AuthInfo.jsx', () => jest.fn(() => ({
    openid: {issuer: 'https://test-issuer.com', client_id: 'test-client'}
})));

jest.mock('../../config/oidcConfiguration.js', () => jest.fn(() => Promise.resolve({
    client_id: 'test-client',
    authority: 'https://test-issuer.com',
    scope: 'openid profile email'
})));
const oidcConfiguration = require('../../config/oidcConfiguration.js');

const mockAuthDispatch = jest.fn();
const mockAuthState = {user: null, isAuthenticated: false, authChoice: null, authInfo: null, accessToken: null};

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
        addUserLoaded: jest.fn(), addAccessTokenExpiring: jest.fn(),
        addAccessTokenExpired: jest.fn(), addSilentRenewError: jest.fn(),
        removeUserLoaded: jest.fn(), removeAccessTokenExpired: jest.fn(),
        removeSilentRenewError: jest.fn(),
    }
};
let mockRecreateUserManager = jest.fn();
let mockIsInitialized = true;

jest.mock('../../context/OidcAuthContext.tsx', () => ({
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
}));
const mockOidcModule = require('../../context/OidcAuthContext.tsx');

const mockLocalStorage = {getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn()};
Object.defineProperty(window, 'localStorage', {value: mockLocalStorage});

const consoleSpy = {
    log: jest.spyOn(console, 'log').mockImplementation(() => {
    }),
    error: jest.spyOn(console, 'error').mockImplementation(() => {
    }),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {
    }),
    debug: jest.spyOn(console, 'debug').mockImplementation(() => {
    }),
};

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// --- Helpers ---

const makeTokenWithExp = (expSecondsFromNow) => {
    const payload = {exp: Math.floor(Date.now() / 1000) + expSecondsFromNow};
    return 'h.' + btoa(JSON.stringify(payload)) + '.s';
};

const renderApp = (initialEntries = ['/']) => {
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

const setupBasicAuth = (tokenExpOffset = 3600) => {
    const token = makeTokenWithExp(tokenExpOffset);
    mockLocalStorage.getItem.mockImplementation((k) =>
        k === 'authToken' ? token : k === 'authChoice' ? 'basic' : null
    );
    mockDecodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) + tokenExpOffset});
    return token;
};

const setupOidcAuth = (token = 'dummy') => {
    mockLocalStorage.getItem.mockImplementation((k) =>
        k === 'authToken' ? token : k === 'authChoice' ? 'openid' : null
    );
    mockAuthState.authChoice = 'openid';
};

// --- Tests ---

describe('App Component', () => {
    beforeEach(() => {
        // Use mockClear (preserves implementations) not mockReset (strips them)
        mockAuthDispatch.mockClear();
        mockLocalStorage.getItem.mockClear().mockReturnValue(null);
        mockLocalStorage.setItem.mockClear().mockImplementation(() => {
        });
        mockLocalStorage.removeItem.mockClear();
        mockDecodeToken.mockClear();
        mockNavigate.mockClear();
        oidcConfiguration.mockClear();
        // mockClear on console spies preserves their mockImplementation(() => {})
        Object.values(consoleSpy).forEach(spy => spy.mockClear());
        Object.values(logger).forEach(fn => fn.mockClear());
        mockAuthState.authChoice = null;
        mockAuthState.accessToken = null;
        mockAuthState.isAuthenticated = false;
        mockUserManager.getUser.mockResolvedValue(null);
        mockUserManager.signinSilent.mockResolvedValue(null);
        Object.values(mockUserManager.events).forEach(fn => fn.mockClear?.());
        mockRecreateUserManager = jest.fn();
        mockOidcModule.__setMockRecreateUserManager(mockRecreateUserManager);
        mockOidcModule.__setMockIsInitialized(true);
    });

    // --- Routing ---

    test('renders NavBar and redirects / to /cluster', async () => {
        setupBasicAuth();
        renderApp(['/']);
        expect(await screen.findByTestId('navbar')).toBeInTheDocument();
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('unknown route redirects to /cluster', async () => {
        setupBasicAuth();
        renderApp(['/unknown-route']);
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test.each([
        ['/namespaces', 'namespaces'],
        ['/nodes', 'nodes'],
        ['/pools', 'pools'],
        ['/network', 'network'],
        ['/objects', 'objects'],
        ['/whoami', 'whoami'],
        ['/network/test-network', 'network-details'],
        ['/objects/test-object', 'object-details'],
    ])('protected route %s renders %s', async (path, testId) => {
        setupBasicAuth();
        const {unmount} = renderApp([path]);
        expect(await screen.findByTestId(testId)).toBeInTheDocument();
        unmount();
    });

    test.each([
        ['/heartbeats', 'heartbeats'],
        ['/silent-renew', 'silent-renew'],
        ['/auth-callback', 'auth-callback'],
        ['/auth-choice', 'auth-choice'],
        ['/auth/login', 'login'],
    ])('unprotected route %s renders %s', async (path, testId) => {
        const {unmount} = renderApp([path]);
        expect(await screen.findByTestId(testId)).toBeInTheDocument();
        unmount();
    });

    // --- ProtectedRoute ---

    test('ProtectedRoute: valid basic token shows content', async () => {
        setupBasicAuth();
        renderApp(['/cluster']);
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('ProtectedRoute: expired basic token redirects and clears storage', async () => {
        setupBasicAuth(-3600);
        renderApp(['/cluster']);
        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tokenExpiration');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authChoice');
    });

    test('ProtectedRoute: null token + null authChoice redirects', async () => {
        renderApp(['/cluster']);
        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('ProtectedRoute: OIDC without token redirects', async () => {
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authChoice' ? 'openid' : null
        );
        renderApp(['/cluster']);
        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('ProtectedRoute: OIDC with malformed token still renders', async () => {
        setupOidcAuth('not-a-valid-jwt');
        mockDecodeToken.mockReturnValue(null);
        renderApp(['/cluster']);
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('ProtectedRoute: null token + null authChoice clears storage', async () => {
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authToken' ? makeTokenWithExp(-3600) : k === 'authChoice' ? null : null
        );
        mockDecodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) - 3600});
        renderApp(['/cluster']);
        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
    });

    // --- OIDC Initialization ---

    test('initializeOidcOnStartup calls oidcConfiguration and recreateUserManager when not initialized', async () => {
        mockOidcModule.__setMockIsInitialized(false);
        setupOidcAuth(makeTokenWithExp(3600));
        mockDecodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) + 3600});
        renderApp(['/cluster']);
        await waitFor(() => expect(oidcConfiguration).toHaveBeenCalled());
        await waitFor(() => expect(mockRecreateUserManager).toHaveBeenCalled());
        mockOidcModule.__setMockIsInitialized(true);
    });

    test('initializeOidcOnStartup does not run if already initialized', async () => {
        setupOidcAuth(makeTokenWithExp(3600));
        renderApp(['/']);
        await waitFor(() => {
            expect(oidcConfiguration).not.toHaveBeenCalled();
            expect(mockRecreateUserManager).not.toHaveBeenCalled();
        });
    });

    test('initializeOidcOnStartup does not run without token', async () => {
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authChoice' ? 'openid' : null
        );
        mockAuthState.authChoice = 'openid';
        renderApp(['/']);
        await waitFor(() => expect(oidcConfiguration).not.toHaveBeenCalled());
    });

    test('initializeOidcOnStartup does not run for non-openid authChoice', async () => {
        setupBasicAuth();
        renderApp(['/']);
        await waitFor(() => expect(oidcConfiguration).not.toHaveBeenCalled());
    });

    test('initializeOidcOnStartup does not run if authInfo is null', async () => {
        mockOidcModule.__setMockIsInitialized(false);
        const authInfoMock = require('../../hooks/AuthInfo.jsx');
        authInfoMock.mockImplementation(() => null);
        setupOidcAuth(makeTokenWithExp(3600));
        renderApp(['/']);
        await new Promise(r => setTimeout(r, 200));
        expect(oidcConfiguration).not.toHaveBeenCalled();
        authInfoMock.mockImplementation(() => ({
            openid: {
                issuer: 'https://test-issuer.com',
                client_id: 'test-client'
            }
        }));
        mockOidcModule.__setMockIsInitialized(true);
    });

    test('initializeOidcOnStartup handles oidcConfiguration rejection', async () => {
        mockOidcModule.__setMockIsInitialized(false);
        oidcConfiguration.mockImplementationOnce(() => Promise.reject(new Error('config failed')));
        setupOidcAuth(makeTokenWithExp(3600));
        renderApp(['/cluster']);
        await new Promise(r => setTimeout(r, 200));
        expect(oidcConfiguration).toHaveBeenCalled();
        expect(mockRecreateUserManager).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalled();
        mockOidcModule.__setMockIsInitialized(true);
    });

    test('initializeOidcOnStartup handles recreateUserManager throwing', async () => {
        mockOidcModule.__setMockIsInitialized(false);
        oidcConfiguration.mockImplementationOnce(() => Promise.resolve({client_id: 'x'}));
        mockRecreateUserManager = jest.fn(() => {
            throw new Error('boom create');
        });
        mockOidcModule.__setMockRecreateUserManager(mockRecreateUserManager);
        setupOidcAuth(makeTokenWithExp(3600));
        renderApp(['/cluster']);
        await new Promise(r => setTimeout(r, 200));
        expect(mockRecreateUserManager).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalled();
        mockOidcModule.__setMockIsInitialized(true);
    });

    // --- OIDC User Events ---

    test('valid user from getUser triggers SetAccessToken and Login dispatch', async () => {
        const validUser = {
            profile: {preferred_username: 'test-user'},
            access_token: 'new-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expired: false,
        };
        mockUserManager.getUser.mockResolvedValue(validUser);
        setupOidcAuth();
        renderApp(['/cluster']);
        await waitFor(() => expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'SetAccessToken', data: 'new-token'}));
        await waitFor(() => expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'Login', data: 'test-user'}));
        await waitFor(() => expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'new-token'));
        await waitFor(() => expect(mockLocalStorage.setItem).toHaveBeenCalledWith('tokenExpiration', expect.any(String)));
    });

    test('expired user from getUser does not trigger SetAccessToken', async () => {
        mockUserManager.getUser.mockResolvedValue({profile: {preferred_username: 'x'}, expired: true});
        setupOidcAuth();
        renderApp(['/cluster']);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        expect(mockAuthDispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: 'SetAccessToken'}));
    });

    test('expired user triggers silent renew; success dispatches tokens', async () => {
        const refreshedUser = {
            profile: {preferred_username: 'refreshed-user'},
            access_token: 'refreshed-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expired: false,
        };
        mockUserManager.getUser.mockResolvedValue({profile: {preferred_username: 'x'}, expired: true});
        mockUserManager.signinSilent.mockResolvedValue(refreshedUser);
        setupOidcAuth();
        renderApp(['/cluster']);
        await waitFor(() => expect(mockUserManager.signinSilent).toHaveBeenCalled());
        await waitFor(() => expect(mockAuthDispatch).toHaveBeenCalledWith({
            type: 'SetAccessToken',
            data: 'refreshed-token'
        }));
        await waitFor(() => expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'Login', data: 'refreshed-user'}));
    });

    test('expired user silent renew failure logs error', async () => {
        mockUserManager.getUser.mockResolvedValue({profile: {preferred_username: 'x'}, expired: true});
        mockUserManager.signinSilent.mockRejectedValue(new Error('Renew failed'));
        setupOidcAuth();
        renderApp(['/cluster']);
        await waitFor(() => expect(mockUserManager.signinSilent).toHaveBeenCalled());
        expect(logger.error).toHaveBeenCalledWith('Silent renew failed:', expect.any(Error));
    });

    test('addAccessTokenExpired handler clears storage and navigates', async () => {
        setupOidcAuth();
        renderApp(['/cluster']);
        await waitFor(() => expect(mockUserManager.events.addAccessTokenExpired).toHaveBeenCalled());
        act(() => mockUserManager.events.addAccessTokenExpired.mock.calls[0][0]());
        await waitFor(() => expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken'));
        await waitFor(() => expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tokenExpiration'));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true}));
    });

    test('addSilentRenewError handler clears storage and navigates', async () => {
        setupOidcAuth();
        renderApp(['/cluster']);
        await waitFor(() => expect(mockUserManager.events.addSilentRenewError).toHaveBeenCalled());
        act(() => mockUserManager.events.addSilentRenewError.mock.calls[0][0](new Error('renew failed')));
        await waitFor(() => expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken'));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true}));
    });

    test('addAccessTokenExpiring listener logs debug', async () => {
        setupOidcAuth();
        renderApp(['/cluster']);
        await waitFor(() => expect(mockUserManager.events.addAccessTokenExpiring).toHaveBeenCalled());
        act(() => mockUserManager.events.addAccessTokenExpiring.mock.calls[0][0]());
        expect(logger.debug).toHaveBeenCalled();
    });

    test('removes old event listeners before adding new ones', async () => {
        setupOidcAuth();
        renderApp(['/cluster']);
        await waitFor(() => expect(mockUserManager.events.removeUserLoaded).toHaveBeenCalled());
        await waitFor(() => expect(mockUserManager.events.removeAccessTokenExpired).toHaveBeenCalled());
        await waitFor(() => expect(mockUserManager.events.removeSilentRenewError).toHaveBeenCalled());
    });

    test('onUserRefreshed: user without profile does not dispatch Login', async () => {
        setupOidcAuth();
        mockUserManager.getUser.mockResolvedValue({
            access_token: 'new-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600
        });
        renderApp(['/cluster']);
        await waitFor(() => expect(mockAuthDispatch).toHaveBeenCalledWith({type: 'SetAccessToken', data: 'new-token'}));
        expect(mockAuthDispatch).not.toHaveBeenCalledWith(expect.objectContaining({
            type: 'Login',
            data: expect.anything()
        }));
    });

    test('onUserRefreshed via addUserLoaded event fires correctly', async () => {
        setupOidcAuth();
        renderApp(['/cluster']);
        await waitFor(() => expect(mockUserManager.events.addUserLoaded).toHaveBeenCalled());
        act(() => mockUserManager.events.addUserLoaded.mock.calls[0][0]({
            profile: {preferred_username: 'event-user'},
            access_token: 'event-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
        }));
        await waitFor(() => expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'event-token'));
    });

    // --- Auth Choice Persistence ---

    test('saves auth.authChoice to localStorage', async () => {
        mockAuthState.authChoice = 'basic';
        renderApp(['/']);
        await waitFor(() => expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authChoice', 'basic'));
    });

    test('does not save authChoice if null', async () => {
        renderApp(['/']);
        await waitFor(() => {
            expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('authChoice', expect.anything());
        });
    });

    // --- Auth Resume (visibility/focus) ---

    test('focus triggers redirect when basic token is expired', async () => {
        setupBasicAuth(-3600);
        renderApp(['/cluster']);
        act(() => window.dispatchEvent(new Event('focus')));
        await act(async () => {
            await new Promise(r => setTimeout(r, 600));
        });
        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('focus does not redirect when OIDC token is present', async () => {
        setupOidcAuth('dummy-token');
        renderApp(['/cluster']);
        act(() => window.dispatchEvent(new Event('focus')));
        await act(async () => {
            await new Promise(r => setTimeout(r, 10));
        });
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalledWith('/auth-choice', {replace: true});
    });

    test('focus does not redirect when basic token is valid', async () => {
        setupBasicAuth();
        renderApp(['/cluster']);
        act(() => window.dispatchEvent(new Event('focus')));
        await act(async () => {
            await new Promise(r => setTimeout(r, 10));
        });
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('visibilitychange triggers auth check without redirect for valid token', async () => {
        setupBasicAuth();
        renderApp(['/cluster']);
        Object.defineProperty(document, 'visibilityState', {value: 'visible', configurable: true});
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        expect(await screen.findByTestId('cluster')).toBeInTheDocument();
    });

    test('OIDC expired token on resume triggers silent renew and updates storage', async () => {
        setupOidcAuth(makeTokenWithExp(-3600));
        mockDecodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) - 3600});
        mockUserManager.signinSilent.mockResolvedValue({
            profile: {preferred_username: 'refreshed-user'},
            access_token: 'refreshed-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expired: false,
        });
        renderApp(['/cluster']);
        act(() => window.dispatchEvent(new Event('focus')));
        await act(async () => {
            await new Promise(r => setTimeout(r, 600));
        });
        await waitFor(() => expect(mockUserManager.signinSilent).toHaveBeenCalled());
        await waitFor(() => expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'refreshed-token'));
    });

    test('OIDC with no token on resume redirects', async () => {
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authChoice' ? 'openid' : null
        );
        renderApp(['/cluster']);
        expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
    });

    test('handleCheckAuthOnResume: OIDC no token on focus redirects', async () => {
        setupOidcAuth();
        renderApp(['/cluster']);
        // After initial render, simulate focus with no token
        mockLocalStorage.getItem.mockImplementation((k) =>
            k === 'authChoice' ? 'openid' : null
        );
        act(() => window.dispatchEvent(new Event('focus')));
        await act(async () => {
            await new Promise(r => setTimeout(r, 600));
        });
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true});
    });

    test('handleCheckAuthOnResume: OIDC expired token without userManager redirects', async () => {
        // Simulate userManager being null at resume time
        mockOidcModule.__setMockIsInitialized(false);
        const expiredToken = makeTokenWithExp(-3600);
        setupOidcAuth(expiredToken);
        mockDecodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) - 3600});
        // Override userManager to null for this test
        jest.spyOn(require('../../context/OidcAuthContext.tsx'), 'useOidc').mockReturnValue({
            userManager: null,
            recreateUserManager: mockRecreateUserManager,
            isInitialized: false,
        });
        renderApp(['/cluster']);
        act(() => window.dispatchEvent(new Event('focus')));
        await act(async () => {
            await new Promise(r => setTimeout(r, 600));
        });
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true});
        jest.restoreAllMocks();
        mockOidcModule.__setMockIsInitialized(true);
    });

    test('handleCheckAuthOnResume: OIDC silent renew returns expired user redirects', async () => {
        const expiredToken = makeTokenWithExp(-3600);
        setupOidcAuth(expiredToken);
        mockDecodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) - 3600});
        // Silent renew returns an expired user
        mockUserManager.signinSilent.mockResolvedValue({expired: true});
        renderApp(['/cluster']);
        act(() => window.dispatchEvent(new Event('focus')));
        await act(async () => {
            await new Promise(r => setTimeout(r, 600));
        });
        await waitFor(() => expect(mockUserManager.signinSilent).toHaveBeenCalled());
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true});
    });

    test('expired user silent renew returns still-expired user logs warning', async () => {
        mockUserManager.getUser.mockResolvedValue({profile: {preferred_username: 'x'}, expired: true});
        // signinSilent returns a still-expired user
        mockUserManager.signinSilent.mockResolvedValue({expired: true, profile: {preferred_username: 'x'}});
        setupOidcAuth();
        renderApp(['/cluster']);
        await waitFor(() => expect(mockUserManager.signinSilent).toHaveBeenCalled());
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Silent renew failed or user still expired'));
    });

    test('handleCheckAuthOnResume handles storage errors gracefully', async () => {
        setupBasicAuth();
        renderApp(['/cluster']);
        mockLocalStorage.getItem.mockImplementation(() => {
            throw new Error('Storage error');
        });
        act(() => window.dispatchEvent(new Event('focus')));
        await waitFor(() =>
            expect(logger.error).toHaveBeenCalledWith('Error while checking auth on resume:', expect.any(Error))
        );
    });

    // --- Miscellaneous ---

    test('handles om3:auth-redirect event', async () => {
        renderApp(['/']);
        act(() => window.dispatchEvent(new CustomEvent('om3:auth-redirect', {detail: '/auth-choice'})));
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice', {replace: true});
    });

    test('storage event calls getItem to check new token', async () => {
        const newToken = makeTokenWithExp(3600);
        // Render with auth-choice path to avoid ProtectedRoute interference
        mockLocalStorage.getItem.mockImplementation((k) => k === 'authChoice' ? 'basic' : null);
        renderApp(['/auth-choice']);
        await screen.findByTestId('auth-choice');
        mockLocalStorage.getItem.mockImplementation((k) => k === 'authToken' ? newToken : null);
        act(() => window.dispatchEvent(new StorageEvent('storage', {key: 'authToken', newValue: newToken})));
        await waitFor(() => expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken'));
    });

    test('event listeners are cleaned up on unmount', async () => {
        const removeListenerSpy = jest.spyOn(window, 'removeEventListener');
        const docRemoveListenerSpy = jest.spyOn(document, 'removeEventListener');
        setupBasicAuth();
        const {unmount} = renderApp(['/']);
        await screen.findByTestId('navbar');
        unmount();
        expect(removeListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
        expect(removeListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
        expect(removeListenerSpy).toHaveBeenCalledWith('om3:auth-redirect', expect.any(Function));
        expect(docRemoveListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    test('isTokenValid: null, empty, and malformed tokens fail', async () => {
        for (const token of [null, '', 'not.a.valid.jwt']) {
            mockLocalStorage.getItem.mockImplementation((k) =>
                k === 'authToken' ? token : k === 'authChoice' ? 'basic' : null
            );
            mockDecodeToken.mockReturnValue(null);
            const {unmount} = renderApp(['/cluster']);
            expect(await screen.findByTestId('auth-choice')).toBeInTheDocument();
            unmount();
        }
    });
});
