import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {useNavigate} from 'react-router-dom';
import OidcCallback from '../OidcCallback';
import {useAuthDispatch, SetAccessToken, SetAuthChoice, Login} from '../../context/AuthProvider.jsx';
import useAuthInfo from '../../hooks/AuthInfo.jsx';
import {useOidc} from '../../context/OidcAuthContext.tsx';
import oidcConfiguration from '../../config/oidcConfiguration.js';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));

jest.mock('../../context/AuthProvider.jsx', () => ({
    useAuthDispatch: jest.fn(),
    SetAccessToken: 'SET_ACCESS_TOKEN',
    SetAuthChoice: 'SET_AUTH_CHOICE',
    Login: 'LOGIN',
}));

jest.mock('../../hooks/AuthInfo.jsx', () => jest.fn());

jest.mock('../../context/OidcAuthContext.tsx', () => ({
    useOidc: jest.fn(),
}));

jest.mock('../../config/oidcConfiguration.js', () => jest.fn());

describe('OidcCallback Component', () => {
    const mockNavigate = jest.fn();
    const mockAuthDispatch = jest.fn();
    const mockUserManager = {
        signinRedirectCallback: jest.fn(),
        getUser: jest.fn(),
        events: {
            addUserLoaded: jest.fn(),
            addAccessTokenExpiring: jest.fn(),
            addAccessTokenExpired: jest.fn(),
            addSilentRenewError: jest.fn(),
        },
    };
    const mockRecreateUserManager = jest.fn();
    const mockAuthInfo = {some: 'auth-info'};
    const mockUser = {
        access_token: 'mock-access-token',
        expires_at: 1234567890,
        profile: {
            preferred_username: 'testuser',
        },
        expired: false,
    };

    let broadcastChannelMock;

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        useNavigate.mockReturnValue(mockNavigate);
        useAuthDispatch.mockReturnValue(mockAuthDispatch);
        useAuthInfo.mockReturnValue(null);
        useOidc.mockReturnValue({
            userManager: null,
            recreateUserManager: mockRecreateUserManager,
        });
        oidcConfiguration.mockResolvedValue({some: 'config'});
        console.error = jest.fn();
        console.log = jest.fn();
        console.warn = jest.fn();

        // Set up BroadcastChannel mock
        broadcastChannelMock = {
            postMessage: jest.fn(),
            close: jest.fn(),
            onmessage: null,
            addEventListener: jest.fn((event, handler) => {
                if (event === 'message') {
                    broadcastChannelMock.onmessage = handler;
                }
            }),
            removeEventListener: jest.fn(),
        };
        global.BroadcastChannel = jest.fn(() => broadcastChannelMock);
    });

    afterEach(() => {
        delete global.BroadcastChannel;
    });

    test('renders loading text', () => {
        render(<OidcCallback/>);
        expect(screen.getByText('Logging ...')).toBeInTheDocument();
    });

    test('calls recreateUserManager when authInfo exists and userManager is null', async () => {
        useAuthInfo.mockReturnValue(mockAuthInfo);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockRecreateUserManager).toHaveBeenCalled();
        });

        expect(mockRecreateUserManager).toHaveBeenCalledWith({some: 'config'});
        expect(oidcConfiguration).toHaveBeenCalledWith(mockAuthInfo);
        expect(console.log).toHaveBeenCalledWith('Initializing UserManager with authInfo');
    });

    test('does not call recreateUserManager when authInfo is null', async () => {
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockRecreateUserManager).not.toHaveBeenCalled();
        });

        expect(oidcConfiguration).not.toHaveBeenCalled();
    });

    test('handles oidcConfiguration error', async () => {
        useAuthInfo.mockReturnValue(mockAuthInfo);
        const error = new Error('OIDC config failed');
        oidcConfiguration.mockRejectedValue(error);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(oidcConfiguration).toHaveBeenCalled();
        });

        expect(oidcConfiguration).toHaveBeenCalledWith(mockAuthInfo);
        expect(console.error).toHaveBeenCalledWith('Failed to initialize OIDC config:', error);
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
    });

    test('calls signinRedirectCallback when userManager exists and getUser is not a function', async () => {
        useOidc.mockReturnValue({
            userManager: {...mockUserManager, getUser: undefined},
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled();
        });

        expect(console.log).toHaveBeenCalledWith('Handling OIDC callback or session check');
    });

    test('handles existing user session with expired token', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue({...mockUser, expired: true});
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.getUser).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled();
        });

        expect(console.log).toHaveBeenCalledWith('Handling OIDC callback or session check');
    });

    test('handles getUser returning null user', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(null);
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.getUser).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled();
        });

        expect(console.log).toHaveBeenCalledWith('Handling OIDC callback or session check');
    });

    test('handles getUser error', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        const error = new Error('Failed to get user');
        mockUserManager.getUser.mockRejectedValue(error);
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.getUser).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled();
        });

        expect(console.error).toHaveBeenCalledWith('Failed to get user:', error);
    });

    test('handles successful signinRedirectCallback', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled();
        });

        expect(localStorage.getItem('authToken')).toBe('mock-access-token');
        expect(localStorage.getItem('tokenExpiration')).toBe('1234567890');

        expect(mockAuthDispatch).toHaveBeenCalledWith({
            type: SetAccessToken,
            data: 'mock-access-token',
        });

        expect(mockAuthDispatch).toHaveBeenCalledWith({
            type: SetAuthChoice,
            data: 'openid',
        });

        expect(mockAuthDispatch).toHaveBeenCalledWith({
            type: Login,
            data: 'testuser',
        });

        expect(mockUserManager.events.addUserLoaded).toHaveBeenCalled();
        expect(mockUserManager.events.addAccessTokenExpiring).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/');
        expect(console.log).toHaveBeenCalledWith('User refreshed:', 'testuser', 'expires_at:', 1234567890);
        expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith({
            type: 'tokenUpdated',
            data: 'mock-access-token',
            expires_at: 1234567890,
        });
    });

    test('handles failed signinRedirectCallback', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        const error = new Error('OIDC callback failed');
        mockUserManager.signinRedirectCallback.mockRejectedValue(error);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled();
        });

        expect(localStorage.getItem('authToken')).toBeNull();
        expect(localStorage.getItem('tokenExpiration')).toBeNull();
        expect(mockAuthDispatch).not.toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
        expect(console.error).toHaveBeenCalledWith('signinRedirectCallback failed:', error);
    });

    test('adds event listeners for user loaded and token expiring', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.events.addUserLoaded).toHaveBeenCalled();
        });

        expect(mockUserManager.events.addAccessTokenExpiring).toHaveBeenCalled();

        const addUserLoadedCallback = mockUserManager.events.addUserLoaded.mock.calls[0][0];
        addUserLoadedCallback(mockUser);

        expect(mockAuthDispatch).toHaveBeenCalledWith({
            type: SetAccessToken,
            data: 'mock-access-token',
        });
        expect(localStorage.getItem('authToken')).toBe('mock-access-token');
        expect(localStorage.getItem('tokenExpiration')).toBe('1234567890');
        expect(console.log).toHaveBeenCalledWith('User refreshed:', 'testuser', 'expires_at:', 1234567890);
        expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith({
            type: 'tokenUpdated',
            data: 'mock-access-token',
            expires_at: 1234567890,
        });

        const addAccessTokenExpiringCallback = mockUserManager.events.addAccessTokenExpiring.mock.calls[0][0];
        addAccessTokenExpiringCallback();

        expect(console.log).toHaveBeenCalledWith('Access token is about to expire, attempting silent renew...');
    });

    test('re-runs effect when authInfo changes', async () => {
        useAuthInfo.mockReturnValue(mockAuthInfo);
        const {rerender} = render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockRecreateUserManager).toHaveBeenCalled();
        });

        useAuthInfo.mockReturnValue({different: 'auth-info'});
        oidcConfiguration.mockResolvedValue({different: 'config'});
        rerender(<OidcCallback/>);

        await waitFor(() => {
            expect(mockRecreateUserManager).toHaveBeenCalled();
        });

        expect(mockRecreateUserManager).toHaveBeenCalledWith({different: 'config'});
        expect(oidcConfiguration).toHaveBeenCalledWith({different: 'auth-info'});
    });

    test('re-runs effect when userManager changes', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        const {rerender} = render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled();
        });

        const newUserManager = {
            ...mockUserManager,
            signinRedirectCallback: jest.fn().mockResolvedValue(mockUser),
        };
        useOidc.mockReturnValue({
            userManager: newUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        rerender(<OidcCallback/>);

        await waitFor(() => {
            expect(newUserManager.signinRedirectCallback).toHaveBeenCalled();
        });
    });

    test('handles access token expired event', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.events.addAccessTokenExpired).toHaveBeenCalled();
        });

        const addAccessTokenExpiredCallback = mockUserManager.events.addAccessTokenExpired.mock.calls[0][0];
        addAccessTokenExpiredCallback();

        expect(console.warn).toHaveBeenCalledWith('Access token expired, redirecting to /auth-choice');
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(localStorage.getItem('tokenExpiration')).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
        expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith({type: 'logout'});
    });

    test('handles silent renew error event', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.events.addSilentRenewError).toHaveBeenCalled();
        });

        const addSilentRenewErrorCallback = mockUserManager.events.addSilentRenewError.mock.calls[0][0];
        const error = new Error('Silent renew error');
        addSilentRenewErrorCallback(error);

        expect(console.error).toHaveBeenCalledWith('Silent renew failed:', error);
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(localStorage.getItem('tokenExpiration')).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
        expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith({type: 'logout'});
    });

    test('handles BroadcastChannel tokenUpdated message', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled();
        });

        // Trigger the onmessage handler
        broadcastChannelMock.onmessage({
            data: {
                type: 'tokenUpdated',
                data: 'new-token',
                expires_at: 9876543210,
            },
        });

        expect(mockAuthDispatch).toHaveBeenCalledWith({
            type: SetAccessToken,
            data: 'new-token',
        });
        expect(localStorage.getItem('authToken')).toBe('new-token');
        expect(localStorage.getItem('tokenExpiration')).toBe('9876543210');
        expect(console.log).toHaveBeenCalledWith('Token updated from another tab');
        expect(broadcastChannelMock.close).toHaveBeenCalled();
    });

    test('handles BroadcastChannel logout message', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled();
        });

        // Trigger the onmessage handler
        broadcastChannelMock.onmessage({
            data: {
                type: 'logout',
            },
        });

        expect(mockAuthDispatch).toHaveBeenCalledWith({
            type: SetAccessToken,
            data: null,
        });
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(localStorage.getItem('tokenExpiration')).toBeNull();
        expect(localStorage.getItem('authChoice')).toBeNull();
        expect(console.log).toHaveBeenCalledWith('Logout triggered from another tab');
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
        expect(broadcastChannelMock.close).toHaveBeenCalled();
    });

    test('sends BroadcastChannel message on token refresh', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.getUser).toHaveBeenCalled();
        });

        expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith({
            type: 'tokenUpdated',
            data: 'mock-access-token',
            expires_at: 1234567890,
        });
        expect(broadcastChannelMock.close).toHaveBeenCalled();
    });

    test('sends BroadcastChannel message on token expiration', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.events.addAccessTokenExpired).toHaveBeenCalled();
        });

        const addAccessTokenExpiredCallback = mockUserManager.events.addAccessTokenExpired.mock.calls[0][0];
        addAccessTokenExpiredCallback();

        expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith({type: 'logout'});
        expect(broadcastChannelMock.close).toHaveBeenCalled();
    });

    test('sends BroadcastChannel message on silent renew error', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.events.addSilentRenewError).toHaveBeenCalled();
        });

        const addSilentRenewErrorCallback = mockUserManager.events.addSilentRenewError.mock.calls[0][0];
        const error = new Error('Silent renew error');
        addSilentRenewErrorCallback(error);

        expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith({type: 'logout'});
        expect(broadcastChannelMock.close).toHaveBeenCalled();
    });

    test('handles existing user session without expired property', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        const userWithoutExpired = {
            access_token: 'mock-access-token',
            expires_at: 1234567890,
            profile: {
                preferred_username: 'testuser',
            },
            // Missing expired property
        };
        mockUserManager.getUser.mockResolvedValue(userWithoutExpired);
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.getUser).toHaveBeenCalled();
        });

        // Should treat user without expired property as valid
        expect(mockUserManager.signinRedirectCallback).not.toHaveBeenCalled();
        expect(mockAuthDispatch).toHaveBeenCalledWith({
            type: SetAccessToken,
            data: 'mock-access-token',
        });
    });

    test('does not setup BroadcastChannel when not available', () => {
        delete global.BroadcastChannel;

        render(<OidcCallback/>);

        // Should not throw errors when BroadcastChannel is not available
        expect(() => {
            screen.getByText('Logging ...');
        }).not.toThrow();
    });
});
