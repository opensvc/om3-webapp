import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {useNavigate} from 'react-router-dom';
import OidcCallback from '../OidcCallback';
import {useAuthDispatch, SetAccessToken, SetAuthChoice, Login} from '../../context/AuthProvider.jsx';
import useAuthInfo from '../../hooks/AuthInfo.jsx';
import {useOidc} from '../../context/OidcAuthContext.tsx';
import oidcConfiguration from '../../config/oidcConfiguration.js';

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

jest.mock('../../utils/logger.js', () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

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
            removeUserLoaded: jest.fn(),
            removeAccessTokenExpiring: jest.fn(),
            removeAccessTokenExpired: jest.fn(),
            removeSilentRenewError: jest.fn(),
        },
    };
    const mockRecreateUserManager = jest.fn();
    const mockAuthInfo = {some: 'auth-info'};
    const mockUser = {
        access_token: 'mock-access-token',
        expires_at: 1234567890,
        profile: {preferred_username: 'testuser'},
        expired: false,
    };

    let broadcastChannelMock;
    let logger;

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

        logger = require('../../utils/logger.js');

        broadcastChannelMock = {
            postMessage: jest.fn(),
            close: jest.fn(),
            onmessage: null,
            addEventListener: jest.fn((event, handler) => {
                if (event === 'message') broadcastChannelMock.onmessage = handler;
            }),
            removeEventListener: jest.fn(),
        };
        global.BroadcastChannel = jest.fn(() => broadcastChannelMock);
    });

    afterEach(() => {
        delete global.BroadcastChannel;
        jest.restoreAllMocks();
    });

    test('renders loading text', () => {
        render(<OidcCallback/>);
        expect(screen.getByText('Logging ...')).toBeInTheDocument();
    });

    test('calls recreateUserManager when authInfo exists and userManager is null', async () => {
        useAuthInfo.mockReturnValue(mockAuthInfo);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockRecreateUserManager).toHaveBeenCalled());
        expect(mockRecreateUserManager).toHaveBeenCalledWith({some: 'config'});
        expect(oidcConfiguration).toHaveBeenCalledWith(mockAuthInfo);
        expect(logger.info).toHaveBeenCalledWith('Initializing UserManager with authInfo');
    });

    test('does not call recreateUserManager when authInfo is null', async () => {
        render(<OidcCallback/>);
        await waitFor(() => expect(mockRecreateUserManager).not.toHaveBeenCalled());
        expect(oidcConfiguration).not.toHaveBeenCalled();
    });

    test('does not call recreateUserManager when userManager already exists', async () => {
        useAuthInfo.mockReturnValue(mockAuthInfo);
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockRecreateUserManager).not.toHaveBeenCalled());
        expect(oidcConfiguration).not.toHaveBeenCalled();
    });

    test('handles oidcConfiguration error and navigates to auth-choice', async () => {
        useAuthInfo.mockReturnValue(mockAuthInfo);
        const error = new Error('OIDC config failed');
        oidcConfiguration.mockRejectedValue(error);
        render(<OidcCallback/>);
        await waitFor(() => expect(oidcConfiguration).toHaveBeenCalled());
        expect(logger.error).toHaveBeenCalledWith('Failed to initialize OIDC config:', error);
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
    });

    test('calls signinRedirectCallback when getUser is not a function', async () => {
        useOidc.mockReturnValue({
            userManager: {...mockUserManager, getUser: undefined},
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled());
        expect(logger.debug).toHaveBeenCalledWith('Handling OIDC callback or session check');
    });

    test('handles existing valid user from getUser', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        expect(mockUserManager.signinRedirectCallback).not.toHaveBeenCalled();
        expect(mockAuthDispatch).toHaveBeenCalledWith({type: SetAccessToken, data: mockUser.access_token});
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    test('handles existing user with no expired property (treated as valid)', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        const userWithoutExpired = {...mockUser, expired: undefined};
        mockUserManager.getUser.mockResolvedValue(userWithoutExpired);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        expect(mockUserManager.signinRedirectCallback).not.toHaveBeenCalled();
        expect(mockAuthDispatch).toHaveBeenCalled();
    });

    test('handles expired user from getUser triggers signinRedirectCallback', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue({...mockUser, expired: true});
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        await waitFor(() => expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled());
    });

    test('handles getUser returning null → calls signinRedirectCallback', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(null);
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        await waitFor(() => expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled());
    });

    test('handles getUser error → calls signinRedirectCallback', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        const error = new Error('getUser failed');
        mockUserManager.getUser.mockRejectedValue(error);
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        await waitFor(() => expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled());
        expect(logger.error).toHaveBeenCalledWith('Failed to get user:', error);
    });

    test('successful signinRedirectCallback updates state and navigates', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled());
        expect(localStorage.getItem('authToken')).toBe('mock-access-token');
        expect(localStorage.getItem('tokenExpiration')).toBe('1234567890');
        expect(mockAuthDispatch).toHaveBeenCalledWith({type: SetAccessToken, data: 'mock-access-token'});
        expect(mockAuthDispatch).toHaveBeenCalledWith({type: SetAuthChoice, data: 'openid'});
        expect(mockAuthDispatch).toHaveBeenCalledWith({type: Login, data: 'testuser'});
        expect(mockUserManager.events.addUserLoaded).toHaveBeenCalled();
        expect(mockUserManager.events.addAccessTokenExpiring).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/');
        expect(broadcastChannelMock.postMessage).toHaveBeenCalled();
    });

    test('failed signinRedirectCallback navigates to auth-choice', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        const error = new Error('callback failed');
        mockUserManager.signinRedirectCallback.mockRejectedValue(error);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled());
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
        expect(logger.error).toHaveBeenCalledWith('signinRedirectCallback failed:', error);
    });

    test('adds event listeners only once', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(mockUser);
        const {rerender} = render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.events.addUserLoaded).toHaveBeenCalledTimes(1));
        rerender(<OidcCallback/>);
        expect(mockUserManager.events.addUserLoaded).toHaveBeenCalledTimes(1);
    });

    test('access token expired event triggers logout', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.events.addAccessTokenExpired).toHaveBeenCalled());
        const expiredHandler = mockUserManager.events.addAccessTokenExpired.mock.calls[0][0];
        expiredHandler();
        expect(logger.warn).toHaveBeenCalledWith('Access token expired, redirecting to /auth-choice');
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
        expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith({type: 'logout'});
    });

    test('silent renew error event triggers logout', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.events.addSilentRenewError).toHaveBeenCalled());
        const errorHandler = mockUserManager.events.addSilentRenewError.mock.calls[0][0];
        const error = new Error('renew failed');
        errorHandler(error);
        expect(logger.error).toHaveBeenCalledWith('Silent renew failed:', error);
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
    });

    test('covers line 61 – access token expiring logs debug message', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        // Simulate a valid existing user so that setupEventHandlers is called
        mockUserManager.getUser.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.events.addAccessTokenExpiring).toHaveBeenCalled();
        });

        const expiringHandler = mockUserManager.events.addAccessTokenExpiring.mock.calls[0][0];
        expiringHandler();

        expect(logger.debug).toHaveBeenCalledWith('Access token is about to expire, attempting silent renew...');
    });

    test('BroadcastChannel tokenUpdated message updates token', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        broadcastChannelMock.onmessage({
            data: {type: 'tokenUpdated', data: 'new-token', expires_at: 9876543210},
        });
        expect(mockAuthDispatch).toHaveBeenCalledWith({type: SetAccessToken, data: 'new-token'});
        expect(localStorage.getItem('authToken')).toBe('new-token');
        expect(localStorage.getItem('tokenExpiration')).toBe('9876543210');
        expect(logger.info).toHaveBeenCalledWith('Token updated from another tab');
    });

    test('BroadcastChannel logout message triggers logout', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        broadcastChannelMock.onmessage({data: {type: 'logout'}});
        expect(mockAuthDispatch).toHaveBeenCalledWith({type: SetAccessToken, data: null});
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
    });

    test('handles missing BroadcastChannel gracefully', async () => {
        delete global.BroadcastChannel;
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        expect(screen.getByText('Logging ...')).toBeInTheDocument();
    });

    test('onUserRefreshed works with null authDispatch', async () => {
        useAuthDispatch.mockReturnValue(null);
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        expect(localStorage.getItem('authToken')).toBe('mock-access-token');
        expect(broadcastChannelMock.postMessage).toHaveBeenCalled();
    });

    test('onUserRefreshed handles null profile', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        const userNullProfile = {...mockUser, profile: null};
        mockUserManager.getUser.mockResolvedValue(userNullProfile);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        expect(logger.info).toHaveBeenCalledWith('User refreshed:', undefined, 'expires_at:', 1234567890);
    });

    test('onUserRefreshed handles null expires_at', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        const userNullExpires = {...mockUser, expires_at: null};
        mockUserManager.getUser.mockResolvedValue(userNullExpires);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.getUser).toHaveBeenCalled());
        expect(localStorage.getItem('tokenExpiration')).toBe('');
    });

    test('handleLogout with null authDispatch does not crash', async () => {
        useAuthDispatch.mockReturnValue(null);
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.getUser.mockResolvedValue(undefined);
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);
        await waitFor(() => expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled());
        await waitFor(() => expect(mockUserManager.events.addAccessTokenExpired).toHaveBeenCalled());
        const expiredHandler = mockUserManager.events.addAccessTokenExpired.mock.calls[0][0];
        expiredHandler();
        expect(logger.warn).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
        expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith({type: 'logout'});
    });

    test('does not add event listeners when userManager is null', async () => {
        useOidc.mockReturnValue({
            userManager: null,
            recreateUserManager: mockRecreateUserManager,
        });
        render(<OidcCallback/>);
        expect(mockUserManager.events?.addUserLoaded).not.toHaveBeenCalled();
    });
});
