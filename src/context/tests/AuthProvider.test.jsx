import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Test component to consume useAuth
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

// Test component to consume useAuthDispatch
const TestDispatchComponent = () => {
    const dispatch = useAuthDispatch();
    return (
        <div>
            <button
                data-testid="login"
                onClick={() => dispatch({ type: Login, data: 'testuser' })}
            >
                Login
            </button>
            <button
                data-testid="logout"
                onClick={() => dispatch({ type: Logout })}
            >
                Logout
            </button>
            <button
                data-testid="setAccessToken"
                onClick={() => dispatch({ type: SetAccessToken, data: 'mock-token' })}
            >
                Set Access Token
            </button>
            <button
                data-testid="setAuthInfo"
                onClick={() => dispatch({ type: SetAuthInfo, data: { provider: 'openid' } })}
            >
                Set Auth Info
            </button>
            <button
                data-testid="setAuthChoice"
                onClick={() => dispatch({ type: SetAuthChoice, data: 'sso' })}
            >
                Set Auth Choice
            </button>
            <button
                data-testid="unknownAction"
                onClick={() => dispatch({ type: 'UNKNOWN_ACTION', data: 'invalid' })}
            >
                Unknown Action
            </button>
        </div>
    );
};

// Minimal test component to trigger an error with useAuth
const TestUseAuthError = () => {
    useAuth();
    return null;
};

// Minimal test component to trigger an error with useAuthDispatch
const TestUseAuthDispatchError = () => {
    useAuthDispatch();
    return null;
};

describe('AuthProvider', () => {
    test('provides initial auth state', () => {
        render(
            <AuthProvider>
                <TestAuthComponent />
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
                <TestAuthComponent />
                <TestDispatchComponent />
            </AuthProvider>
        );

        fireEvent.click(screen.getByTestId('login'));

        expect(screen.getByTestId('user').textContent).toBe('"testuser"');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
    });

    test('updates state with Logout action', () => {
        render(
            <AuthProvider>
                <TestAuthComponent />
                <TestDispatchComponent />
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
                <TestAuthComponent />
                <TestDispatchComponent />
            </AuthProvider>
        );

        fireEvent.click(screen.getByTestId('setAccessToken'));

        expect(screen.getByTestId('accessToken').textContent).toBe('"mock-token"');
    });

    test('updates state with SetAuthInfo action', () => {
        render(
            <AuthProvider>
                <TestAuthComponent />
                <TestDispatchComponent />
            </AuthProvider>
        );

        fireEvent.click(screen.getByTestId('setAuthInfo'));

        expect(screen.getByTestId('authInfo').textContent).toBe('{"provider":"openid"}');
    });

    test('updates state with SetAuthChoice action', () => {
        render(
            <AuthProvider>
                <TestAuthComponent />
                <TestDispatchComponent />
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

    test('useAuth throws error when used outside AuthProvider', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        expect(() => render(<TestUseAuthError />)).toThrow('useAuth must be used within an AuthProvider');

        consoleErrorSpy.mockRestore();
    });

    test('useAuthDispatch throws error when used outside AuthProvider', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        expect(() => render(<TestUseAuthDispatchError />)).toThrow('useAuthDispatch must be used within an AuthProvider');

        consoleErrorSpy.mockRestore();
    });

    test('unknown action does not modify state', () => {
        render(
            <AuthProvider>
                <TestAuthComponent />
                <TestDispatchComponent />
            </AuthProvider>
        );

        fireEvent.click(screen.getByTestId('unknownAction'));

        expect(screen.getByTestId('user').textContent).toBe('null');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
        expect(screen.getByTestId('authChoice').textContent).toBe('null');
        expect(screen.getByTestId('authInfo').textContent).toBe('null');
        expect(screen.getByTestId('accessToken').textContent).toBe('null');
    });
});
