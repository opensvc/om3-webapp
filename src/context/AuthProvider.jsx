import React, {createContext, useReducer, useContext, useEffect, useRef} from 'react';
import {decodeToken, refreshToken as doRefreshToken} from '../components/Login';

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
            return {...state, user: null, isAuthenticated: false, accessToken: null};
        case SetAccessToken:
            if (action.data) {
                localStorage.setItem('authToken', action.data);
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('tokenExpiration');
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

    // Multi-tab synchronization
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return;

        channel.current = new BroadcastChannel('auth-channel');
        channel.current.onmessage = (event) => {
            const {type, data} = event.data || {};
            if (type === 'tokenUpdated') {
                console.log('Token updated from another tab');
                dispatch({type: SetAccessToken, data});
                scheduleRefresh(data);
            } else if (type === 'logout') {
                console.log('Logout triggered from another tab');
                dispatch({type: Logout});
            }
        };
        return () => channel.current?.close();
    }, []);

    // Refresh function
    const scheduleRefresh = (token) => {
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
                        channel.current?.postMessage({type: 'tokenUpdated', data: newToken});
                        scheduleRefresh(newToken);
                    }
                } catch (err) {
                    console.error('Token refresh error:', err);
                    dispatch({type: Logout});
                    channel.current?.postMessage({type: 'logout'});
                }
            }, refreshTime);
        } else {
            console.warn('Token already expired or too close to expiration, no refresh scheduled');
            dispatch({type: Logout});
            channel.current?.postMessage({type: 'logout'});
        }
    };

    // Reschedule refresh when token changes
    useEffect(() => {
        if (auth.authChoice !== 'openid') {
            const token = auth.accessToken ?? localStorage.getItem('authToken');
            scheduleRefresh(token);
        }
        return () => {
            if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
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
    if (context === null) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const useAuthDispatch = () => {
    const context = useContext(AuthDispatchContext);
    if (context === null) throw new Error('useAuthDispatch must be used within an AuthProvider');
    return context;
};
