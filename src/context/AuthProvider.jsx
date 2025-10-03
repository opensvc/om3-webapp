import React, {createContext, useReducer, useContext, useEffect, useRef, useCallback} from 'react';
import {decodeToken, refreshToken as doRefreshToken} from '../components/Login';
import {updateEventSourceToken} from '../eventSourceManager';

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
            return {...state, user: action.data, isAuthenticated: true};
        case Logout:
            localStorage.removeItem('authToken');
            localStorage.removeItem('tokenExpiration');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('refreshTokenExpiration');
            return {...state, user: null, isAuthenticated: false, accessToken: null};
        case SetAccessToken:
            if (action.data) {
                localStorage.setItem('authToken', action.data);
                // Notify EventSource manager about token update
                updateEventSourceToken(action.data);
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('tokenExpiration');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('refreshTokenExpiration');
            }
            return {...state, accessToken: action.data, isAuthenticated: !!action.data};
        case SetAuthInfo:
            return {...state, authInfo: action.data};
        case SetAuthChoice:
            return {...state, authChoice: action.data};
        default:
            return state;
    }
};

const AuthContext = createContext(null);
const AuthDispatchContext = createContext(null);

export const AuthProvider = ({children}) => {
    const [auth, dispatch] = useReducer(authReducer, initialState);
    const refreshTimeout = useRef(null);
    const channel = useRef(null);
    const oidcUserManagerRef = useRef(null);

    // Safe access to window.oidcUserManager with browser check
    const getOidcUserManager = () => {
        return typeof window !== 'undefined' ? window.oidcUserManager : null;
    };

    // Multi-tab synchronization (only in browser)
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return;
        channel.current = new BroadcastChannel('auth-channel');
        channel.current.onmessage = (event) => {
            const {type, data} = event.data || {};
            if (type === 'tokenUpdated') {
                console.log('Token updated from another tab');
                dispatch({type: SetAccessToken, data});
                if (auth.authChoice !== 'openid') {
                    scheduleRefresh(data);
                }
            } else if (type === 'logout') {
                console.log('Logout triggered from another tab');
                dispatch({type: Logout});
            }
        };
        return () => channel.current?.close();
    }, [auth.authChoice]);

    // OpenID token refresh handler
    const setupOidcTokenRefresh = useCallback(() => {
        const userManager = getOidcUserManager();
        if (!userManager) return;

        const handleTokenExpired = () => {
            console.warn('OpenID token expired, attempting silent renew...');
            userManager.signinSilent()
                .then(user => {
                    const newToken = user.access_token;
                    dispatch({type: SetAccessToken, data: newToken});
                    localStorage.setItem('authToken', newToken);
                    localStorage.setItem('tokenExpiration', user.expires_at.toString());
                    if (typeof BroadcastChannel !== 'undefined' && channel.current) {
                        channel.current.postMessage({type: 'tokenUpdated', data: newToken});
                    }
                })
                .catch(err => {
                    console.error('Silent renew failed:', err);
                    dispatch({type: Logout});
                    if (typeof BroadcastChannel !== 'undefined' && channel.current) {
                        channel.current.postMessage({type: 'logout'});
                    }
                });
        };

        userManager.events.addAccessTokenExpired(handleTokenExpired);
        return () => {
            userManager.events.removeAccessTokenExpired(handleTokenExpired);
        };
    }, []);

    // Refresh function for non-OpenID
    const scheduleRefresh = useCallback((token) => {
        if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
        if (!token || auth.authChoice === 'openid') return;

        const payload = decodeToken(token);
        if (!payload?.exp) return;

        const expirationTime = payload.exp * 1000;
        const refreshTime = expirationTime - Date.now() - 5000;

        if (refreshTime > 0) {
            console.log('Token refresh scheduled in', Math.round(refreshTime / 1000), 'seconds');
            refreshTimeout.current = setTimeout(async () => {
                const latestToken = localStorage.getItem('authToken');
                if (latestToken && latestToken !== token) {
                    console.log('Refresh skipped, token already updated by another tab');
                    scheduleRefresh(latestToken);
                    return;
                }
                try {
                    const newToken = await doRefreshToken(dispatch);
                    if (newToken) {
                        if (typeof BroadcastChannel !== 'undefined' && channel.current) {
                            channel.current.postMessage({type: 'tokenUpdated', data: newToken});
                        }
                        scheduleRefresh(newToken);
                    }
                } catch (err) {
                    console.error('Token refresh error:', err);
                    dispatch({type: Logout});
                    if (typeof BroadcastChannel !== 'undefined' && channel.current) {
                        channel.current.postMessage({type: 'logout'});
                    }
                }
            }, refreshTime);
        } else {
            console.warn('Token already expired or too close to expiration, no refresh scheduled');
            dispatch({type: Logout});
            if (typeof BroadcastChannel !== 'undefined' && channel.current) {
                channel.current.postMessage({type: 'logout'});
            }
        }
    }, [auth.authChoice]);

    // Set up OIDC user manager reference
    useEffect(() => {
        if (auth.authChoice === 'openid') {
            const userManager = getOidcUserManager();
            if (userManager) {
                oidcUserManagerRef.current = userManager;
                const cleanup = setupOidcTokenRefresh();
                return cleanup;
            }
        }
    }, [auth.authChoice, setupOidcTokenRefresh]);

    // Reschedule refresh when token changes
    useEffect(() => {
        const token = auth.accessToken ?? localStorage.getItem('authToken');
        if (auth.authChoice !== 'openid') {
            scheduleRefresh(token);
        }
        return () => {
            if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
        };
    }, [auth.accessToken, auth.authChoice, scheduleRefresh]);

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
    if (context === null) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const useAuthDispatch = () => {
    const context = useContext(AuthDispatchContext);
    if (context === null) throw new Error('useAuthDispatch must be used within an AuthProvider');
    return context;
};
