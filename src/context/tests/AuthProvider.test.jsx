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

// Simuler BroadcastChannel
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

// Simuler decodeToken et refreshToken
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
            <button data-testid="login" onClick={() => dispatch({type: Login, data: 'testuser'})}>Login</button>
            <button data-testid="logout" onClick={() => dispatch({type: Logout})}>Logout</button>
            <button data-testid="setAccessToken"
                    onClick={() => dispatch({type: SetAccessToken, data: 'mock-token'})}>Set Access Token
            </button>
            <button data-testid="setAccessTokenNull" onClick={() => dispatch({type: SetAccessToken, data: null})}>Set
                Access Token Null
            </button>
            <button data-testid="setAuthInfo"
                    onClick={() => dispatch({type: SetAuthInfo, data: {provider: 'openid'}})}>Set Auth Info
            </button>
            <button data-testid="setAuthChoice" onClick={() => dispatch({type: SetAuthChoice, data: 'sso'})}>Set Auth
                Choice
            </button>
            <button data-testid="setAuthChoiceOpenid"
                    onClick={() => dispatch({type: SetAuthChoice, data: 'openid'})}>Set Auth Choice Openid
            </button>
            <button data-testid="unknownAction"
                    onClick={() => dispatch({type: 'UNKNOWN_ACTION', data: 'invalid'})}>Unknown Action
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

// Fonction utilitaire pour vider les promesses
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

    test('fournit l’état d’authentification initial', () => {
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

    test('met à jour l’état avec l’action Login', () => {
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

    test('met à jour l’état avec l’action Logout', () => {
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

    test('met à jour l’état avec l’action SetAccessToken', () => {
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

    test('met à jour l’état avec l’action SetAuthInfo', () => {
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAuthInfo'));
        expect(screen.getByTestId('authInfo').textContent).toBe('{"provider":"openid"}');
    });

    test('met à jour l’état avec l’action SetAuthChoice', () => {
        render(
            <AuthProvider>
                <TestAuthComponent/>
                <TestDispatchComponent/>
            </AuthProvider>
        );
        fireEvent.click(screen.getByTestId('setAuthChoice'));
        expect(screen.getByTestId('authChoice').textContent).toBe('"sso"');
    });

    test('rend les enfants correctement', () => {
        render(
            <AuthProvider>
                <div data-testid="child">Child Content</div>
            </AuthProvider>
        );
        expect(screen.getByTestId('child').textContent).toBe('Child Content');
    });

    test('useAuth lève une erreur lorsqu’utilisé hors d’AuthProvider', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        expect(() => render(<TestUseAuthError/>)).toThrow('useAuth must be used within an AuthProvider');
        consoleErrorSpy.mockRestore();
    });

    test('useAuthDispatch lève une erreur lorsqu’utilisé hors d’AuthProvider', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        expect(() => render(<TestUseAuthDispatchError/>)).toThrow(
            'useAuthDispatch must be used within an AuthProvider'
        );
        consoleErrorSpy.mockRestore();
    });

    test('une action inconnue ne modifie pas l’état', () => {
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

    test('planifie le rafraîchissement du jeton avec un jeton valide', () => {
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

    test('ne planifie pas de rafraîchissement pour un jeton expiré', () => {
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

    test('nettoie le timeout lors du démontage du composant', () => {
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

    test('n’initialise pas BroadcastChannel lorsqu’il est indéfini', () => {
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

    test('ne planifie pas de rafraîchissement lorsqu’aucun jeton n’est fourni', () => {
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

    test('ne planifie pas de rafraîchissement lorsque authChoice est openid', () => {
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

    test('ne planifie pas de rafraîchissement lorsque le jeton n’a pas de champ exp', () => {
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

    test('gère les erreurs de rafraîchissement du jeton', async () => {
        // Jeton qui expire dans 10 secondes pour permettre le test
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

        // Définir le jeton dans l’état
        act(() => {
            fireEvent.click(screen.getByTestId('setAccessToken'));
        });

        // Vérifier l’état initial après setAccessToken
        expect(screen.getByTestId('accessToken').textContent).toBe('"mock-token"');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');

        // Avancer le temps pour déclencher le rafraîchissement et gérer l’erreur
        await act(async () => {
            jest.advanceTimersByTime(5100); // Avancer de 5,1 secondes (5000ms + marge)
            // Utiliser Promise.resolve() au lieu de flushPromises() avec les timers simulés
            await Promise.resolve();
        });

        // Vérifier que le rafraîchissement a été appelé et a échoué
        expect(refreshToken).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Token refresh error:', expect.any(Error));

        // Vérifier que la déconnexion a été déclenchée suite à l’erreur
        expect(screen.getByTestId('accessToken').textContent).toBe('null');
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
        expect(broadcastChannelInstance._messages).toContainEqual({type: 'logout'});

        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    test('gère le message tokenUpdated depuis BroadcastChannel', async () => {
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

    test('gère le message logout depuis BroadcastChannel', async () => {
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

    test('ignore le rafraîchissement si le jeton est mis à jour par un autre onglet', () => {
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
