import React, {createContext, useReducer, useContext, useEffect, useRef} from 'react';
import {decodeToken, refreshToken} from '../components/Login';

const initialState = {
    user: null,
    isAuthenticated: false,
    authChoice: null,
    authInfo: null,
    accessToken: localStorage.getItem('authToken') || null,
};

export const Login = 'Login';
export const Logout = 'Logout';
export const SetAuthInfo = 'SetAuthInfo';
export const SetAccessToken = 'SetAccessToken';
export const SetAuthChoice = 'SetAuthChoice';

const authReducer = (state, action) => {
    switch (action.type) {
        case Login:
            return {
                ...state,
                user: action.data,
                isAuthenticated: true,
            };
        case Logout:
            localStorage.removeItem('authToken');
            localStorage.removeItem('tokenExpiration');
            return {
                ...state,
                user: null,
                isAuthenticated: false,
                accessToken: null,
            };
        case SetAccessToken:
            if (action.data) {
                localStorage.setItem('authToken', action.data);
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('tokenExpiration');
            }
            return {
                ...state,
                accessToken: action.data,
                isAuthenticated: !!action.data, // true if token is not null
            };
        case SetAuthInfo:
            return {
                ...state,
                authInfo: action.data,
            };
        case SetAuthChoice:
            return {
                ...state,
                authChoice: action.data,
            };
        default:
            return state;
    }
};

const AuthContext = createContext(null);
const AuthDispatchContext = createContext(null);

export const AuthProvider = ({children}) => {
    const [auth, dispatch] = useReducer(authReducer, initialState);
    const refreshTimeout = useRef(null);

    // Schedule a token refresh before it expires (only for non-OIDC tokens)
    const scheduleRefresh = (token) => {
        if (refreshTimeout.current) {
            clearTimeout(refreshTimeout.current);
        }
        if (!token || auth.authChoice === 'openid') return; // Don't schedule refresh for OIDC tokens

        const payload = decodeToken(token);
        if (!payload?.exp) return;

        const expirationTime = payload.exp * 1000;
        const refreshTime = expirationTime - Date.now() - 5000; // 5 seconds before expiration

        if (refreshTime > 0) {
            console.log('🔁 Token refresh scheduled in', Math.round(refreshTime / 1000), 'seconds');
            refreshTimeout.current = setTimeout(() => {
                refreshToken(dispatch)
                    .then(() => {
                        // Get the new token and reschedule the refresh
                        const newToken = localStorage.getItem('authToken');
                        scheduleRefresh(newToken);
                    })
                    .catch((err) => {
                        console.error('Token refresh error:', err);
                    });
            }, refreshTime);
        } else {
            console.warn('⚠️ Token already expired or too close to expiration, no refresh scheduled');
        }
    };

    // On every token change, reschedule the refresh (only for non-OIDC tokens)
    useEffect(() => {
        if (auth.authChoice !== 'openid') {
            const token = auth.accessToken ?? localStorage.getItem('authToken');
            scheduleRefresh(token);
        }

        return () => {
            if (refreshTimeout.current) {
                clearTimeout(refreshTimeout.current);
            }
        };
    }, [auth.accessToken, auth.authChoice]);

    return (
        <AuthContext.Provider value={auth}>
            <AuthDispatchContext.Provider value={dispatch}>
                {children}
            </AuthDispatchContext.Provider>
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === null) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const useAuthDispatch = () => {
    const context = useContext(AuthDispatchContext);
    if (context === null) {
        throw new Error('useAuthDispatch must be used within an AuthProvider');
    }
    return context;
};
