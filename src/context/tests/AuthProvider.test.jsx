import React from 'react';
import {render, screen, fireEvent, act, waitFor} from '@testing-library/react';
import {
    AuthProvider,
    useAuth,
    useAuthDispatch,
    Login,
    Logout,
    SetAccessToken,
    SetAuthInfo,
    SetAuthChoice,
} from '../AuthProvider';

// Mock BroadcastChannel
global.BroadcastChannel = class {
    constructor() {
        this.onmessage = null;
        this._messages = [];
    }

    postMessage(msg) {
        this._messages.push(msg);
    }

    close() {
    }
};

// Mock decodeToken and refreshToken
jest.mock('../../components/Login', () => ({
    decodeToken: jest.fn(),
    refreshToken: jest.fn(),
}));
const {decodeToken, refreshToken} = require('../../components/Login');

const TestAuthComponent = () => {
    const auth = useAuth();
    return (
        <div>
            <div data-testid="user">{JSON.stringify(auth.user)}</div>
            <div data-testid="isAuthenticated">{auth.isAuthenticated.toString()}</div>
            <div data-testid="authChoice">{JSON.stringify(auth.authChoice)}</div>
            <div data-testid="authInfo">{JSON.stringify(auth.authInfo)}</div>
            <div data-testid="accessToken">{JSON.stringify(auth.accessToken)}</div>
        </div>
    );
};

const TestDispatchComponent = () => {
    const dispatch = useAuthDispatch();
    return (
        <div>
            <button data-testid="login" onClick={() => dispatch({type: Login, data: 'testuser'})}>
                Login
            </button>
            <button data-testid="logout" onClick={() => dispatch({type: Logout})}>
                Logout
            </button>
            <button
                data-testid="setAccessToken"
                onClick={() => dispatch({type: SetAccessToken, data: 'mock-token'})}
            >
                Set Access Token
            </button>
            <button
                data-testid="setAccessTokenNull"
                onClick={() => dispatch({type: SetAccessToken, data: null})}
            >
                Set Access Token Null
            </button>
            <button
                data-testid="setAuthInfo"
                onClick={() => dispatch({type: SetAuthInfo, data: {provider: 'openid'}})}
            >
                Set Auth Info
            </button>
            <button
                data-testid="setAuthChoice"
                onClick={() => dispatch({type: SetAuthChoice, data: 'sso'})}
            >
                Set Auth Choice
            </button>
            <button
                data-testid="setAuthChoiceOpenid"
                onClick={() => dispatch({type: SetAuthChoice, data: 'openid'})}
            >
                Set Auth Choice Openid
            </button>
            <button
                data-testid="unknownAction"
                onClick={() => dispatch({type: 'UNKNOWN_ACTION', data: 'invalid'})}
            >
                Unknown Action
            </button>
        </div>
    );
};

const TestUseAuthError = () => {
    useAuth();
    return null;
};
const TestUseAuthDispatchError = () => {
    useAuthDispatch();
    return null;
};

// Utility function to flush promises
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AuthProvider', () => {
    let broadcastChannelInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        jest.useFakeTimers();
        const originalBroadcastChannel = global.BroadcastChannel;
        global.BroadcastChannel = class extends originalBroadcastChannel {
            constructor() {
                super();
                broadcastChannelInstance = this;
            }
        };
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        broadcastChannelInstance = null;
    });

    test('provides initial authentication state', () => {
        render(
            <AuthProvider>
                <TestAuthComponent/>
            </AuthProvider>
        );
        expect(screen.getByTestId('user').textContent).toBe('null');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
        expect(screen.getByTestId('authChoice').textContent).toBe('null');
        expect(screen.getByTestId('authInfo').textContent).toBe('null');
        expect(screen.getByTestId('accessToken').textContent).toBe('null');
    });

    test('updates state with Login action', () => {
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('login'));
        expect(screen.getByTestId('user').textContent).toBe('"testuser"');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
    });

    test('updates state with Logout action', () => {
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('login'));
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
        fireEvent.click(screen.getByTestId('logout'));
        expect(screen.getByTestId('user').textContent).toBe('null');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
        expect(screen.getByTestId('accessToken').textContent).toBe('null');
    });

    test('updates state with SetAccessToken action', () => {
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAccessToken'));
        expect(screen.getByTestId('accessToken').textContent).toBe('"mock-token"');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
    });

    test('updates state with SetAuthInfo action', () => {
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAuthInfo'));
        expect(screen.getByTestId('authInfo').textContent).toBe('{"provider":"openid"}');
    });

    test('updates state with SetAuthChoice action', () => {
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAuthChoice'));
        expect(screen.getByTestId('authChoice').textContent).toBe('"sso"');
    });

    test('renders children correctly', () => {
        render(
            <AuthProvider>
                <div data-testid="child">Child Content</div>
            </AuthProvider>
        );
        expect(screen.getByTestId('child').textContent).toBe('Child Content');
    });

    test('useAuth throws an error when used outside AuthProvider', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        expect(() => render(<TestUseAuthError/>)).toThrow('useAuth must be used within an AuthProvider');
        consoleErrorSpy.mockRestore();
    });

    test('useAuthDispatch throws an error when used outside AuthProvider', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        expect(() => render(<TestUseAuthDispatchError/>)).toThrow(
            'useAuthDispatch must be used within an AuthProvider'
        );
        consoleErrorSpy.mockRestore();
    });

    test('unknown action does not modify state', () => {
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('unknownAction'));
        expect(screen.getByTestId('user').textContent).toBe('null');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
        expect(screen.getByTestId('authChoice').textContent).toBe('null');
        expect(screen.getByTestId('authInfo').textContent).toBe('null');
        expect(screen.getByTestId('accessToken').textContent).toBe('null');
    });

    test('schedules token refresh with valid token', () => {
        decodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) + 60});
        refreshToken.mockResolvedValue('new-token');
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAccessToken'));
        expect(consoleLogSpy).toHaveBeenCalledWith('Token refresh scheduled in', expect.any(Number), 'seconds');
        expect(decodeToken).toHaveBeenCalledWith('mock-token');
        act(() => {
            jest.runAllTimers();
        });
        expect(refreshToken).toHaveBeenCalled();
        consoleLogSpy.mockRestore();
    });

    test('does not schedule refresh for expired token', () => {
        decodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) - 10});
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAccessToken'));
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Token already expired or too close to expiration, no refresh scheduled'
        );
        expect(refreshToken).not.toHaveBeenCalled();
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
        consoleWarnSpy.mockRestore();
    });

    test('cleans up timeout on component unmount', () => {
        decodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) + 60});
        refreshToken.mockResolvedValue('new-token');
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        const {unmount} = render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAccessToken'));
        unmount();
        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
    });

    test('does not initialize BroadcastChannel when undefined', () => {
        const originalBroadcastChannel = global.BroadcastChannel;
        delete global.BroadcastChannel;
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        render(
            <AuthProvider>
                <TestAuthComponent/>
            </AuthProvider>
        );
        expect(consoleLogSpy).not.toHaveBeenCalled();
        consoleLogSpy.mockRestore();
        global.BroadcastChannel = originalBroadcastChannel;
    });

    test('does not schedule refresh when no token is provided', () => {
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAccessTokenNull'));
        expect(consoleLogSpy).not.toHaveBeenCalledWith(
            'Token refresh scheduled in',
            expect.any(Number),
            'seconds'
        );
        expect(refreshToken).not.toHaveBeenCalled();
        consoleLogSpy.mockRestore();
    });

    test('does not schedule refresh when authChoice is openid', () => {
        decodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) + 60});
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAuthChoiceOpenid'));
        fireEvent.click(screen.getByTestId('setAccessToken'));
        expect(consoleLogSpy).not.toHaveBeenCalledWith(
            'Token refresh scheduled in',
            expect.any(Number),
            'seconds'
        );
        expect(refreshToken).not.toHaveBeenCalled();
        consoleLogSpy.mockRestore();
    });

    test('does not schedule refresh when token has no exp field', () => {
        decodeToken.mockReturnValue({});
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAccessToken'));
        expect(consoleLogSpy).not.toHaveBeenCalledWith(
            'Token refresh scheduled in',
            expect.any(Number),
            'seconds'
        );
        expect(refreshToken).not.toHaveBeenCalled();
        consoleLogSpy.mockRestore();
    });

    test('handles token refresh errors', async () => {
        // Token that expires in 10 seconds for testing
        decodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) + 10});
        refreshToken.mockRejectedValue(new Error('Refresh failed'));

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );

        // Set token in state
        act(() => {
            fireEvent.click(screen.getByTestId('setAccessToken'));
        });

        // Verify initial state after setAccessToken
        expect(screen.getByTestId('accessToken').textContent).toBe('"mock-token"');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');

        // Advance time to trigger refresh and handle error
        await act(async () => {
            jest.advanceTimersByTime(5100); // Advance by 5.1 seconds (5000ms + margin)
            // Use Promise.resolve() instead of flushPromises() with fake timers
            await Promise.resolve();
        });

        // Verify refresh was called and failed
        expect(refreshToken).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Token refresh error:', expect.any(Error));

        // Verify logout was triggered due to error
        expect(screen.getByTestId('accessToken').textContent).toBe('null');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
        expect(broadcastChannelInstance._messages).toContainEqual({type: 'logout'});

        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    test('handles tokenUpdated message from BroadcastChannel', async () => {
        decodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) + 60});
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAccessToken'));
        await act(async () => {
            broadcastChannelInstance.onmessage({data: {type: 'tokenUpdated', data: 'new-token'}});
        });
        expect(consoleLogSpy).toHaveBeenCalledWith('Token updated from another tab');
        expect(screen.getByTestId('accessToken').textContent).toBe('"new-token"');
        expect(decodeToken).toHaveBeenCalledWith('new-token');
        consoleLogSpy.mockRestore();
    });

    test('handles logout message from BroadcastChannel', async () => {
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('login'));
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
        await act(async () => {
            broadcastChannelInstance.onmessage({data: {type: 'logout'}});
        });
        expect(consoleLogSpy).toHaveBeenCalledWith('Logout triggered from another tab');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
        expect(screen.getByTestId('accessToken').textContent).toBe('null');
        consoleLogSpy.mockRestore();
    });

    test('ignores refresh if token is updated by another tab', () => {
        decodeToken.mockReturnValue({exp: Math.floor(Date.now() / 1000) + 60});
        refreshToken.mockResolvedValue('new-token');
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAccessToken'));
        localStorage.setItem('authToken', 'different-token');
        act(() => {
            jest.runAllTimers();
        });
        expect(consoleLogSpy).toHaveBeenCalledWith('Refresh skipped, token already updated by another tab');
        expect(decodeToken).toHaveBeenCalledWith('different-token');
        consoleLogSpy.mockRestore();
    });
});
