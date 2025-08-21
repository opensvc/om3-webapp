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
    };

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
    });

    test('renders loading text', () => {
        render(<OidcCallback/>);
        expect(screen.getByText('Logging ...')).toBeInTheDocument();
    });

    test('calls recreateUserManager when authInfo exists and userManager is null', async () => {
        useAuthInfo.mockReturnValue(mockAuthInfo);
        render(<OidcCallback/>);
        await waitFor(() => {
            expect(mockRecreateUserManager).toHaveBeenCalledWith({some: 'config'});
            expect(oidcConfiguration).toHaveBeenCalledWith(mockAuthInfo);
            expect(console.log).toHaveBeenCalledWith('Initializing UserManager with authInfo');
        });
    });

    test('does not call recreateUserManager when authInfo is null', async () => {
        render(<OidcCallback/>);
        await waitFor(() => {
            expect(mockRecreateUserManager).not.toHaveBeenCalled();
            expect(oidcConfiguration).not.toHaveBeenCalled();
        });
    });

    test('calls signinRedirectCallback when userManager exists', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.signinRedirectCallback).toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith('Handling signinRedirectCallback');
        });
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
            expect(localStorage.getItem('authToken')).toBeNull();
            expect(localStorage.getItem('tokenExpiration')).toBeNull();
            expect(mockAuthDispatch).not.toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
            expect(console.error).toHaveBeenCalledWith('signinRedirectCallback failed:', error);
        });
    });

    test('adds event listeners for user loaded and token expiring', async () => {
        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });
        mockUserManager.signinRedirectCallback.mockResolvedValue(mockUser);
        render(<OidcCallback/>);

        await waitFor(() => {
            expect(mockUserManager.events.addUserLoaded).toHaveBeenCalledWith(expect.any(Function));
            expect(mockUserManager.events.addAccessTokenExpiring).toHaveBeenCalledWith(expect.any(Function));
        });

        const addUserLoadedCallback = mockUserManager.events.addUserLoaded.mock.calls[0][0];
        addUserLoadedCallback(mockUser);

        expect(mockAuthDispatch).toHaveBeenCalledWith({
            type: SetAccessToken,
            data: 'mock-access-token',
        });
        expect(localStorage.getItem('authToken')).toBe('mock-access-token');
        expect(localStorage.getItem('tokenExpiration')).toBe('1234567890');
        expect(console.log).toHaveBeenCalledWith('User refreshed:', 'testuser', 'expires_at:', 1234567890);

        const addAccessTokenExpiringCallback = mockUserManager.events.addAccessTokenExpiring.mock.calls[0][0];
        addAccessTokenExpiringCallback();

        expect(console.log).toHaveBeenCalledWith('Access token is about to expire, attempting silent renew...');
    });

    test('re-runs effect when authInfo changes', async () => {
        useAuthInfo.mockReturnValue(mockAuthInfo);
        const {rerender} = render(<OidcCallback/>);
        await waitFor(() => {
            expect(mockRecreateUserManager).toHaveBeenCalledWith({some: 'config'});
        });
        useAuthInfo.mockReturnValue({different: 'auth-info'});
        oidcConfiguration.mockResolvedValue({different: 'config'});
        rerender(<OidcCallback/>);

        await waitFor(() => {
            expect(mockRecreateUserManager).toHaveBeenCalledWith({different: 'config'});
        });
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
});
