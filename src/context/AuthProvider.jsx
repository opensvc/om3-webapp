import React, {createContext, useReducer, useContext} from 'react';

const initialState = {
    user: null,
    isAuthenticated: false,
    authChoice: null,
    authInfo: null,
    accessToken: null,
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
            return {
                ...state,
                user: null,
                isAuthenticated: false,
                accessToken: null,
            };
        case SetAccessToken:
            return {
                ...state,
                accessToken: action.data,
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
            return {
                ...state,
            };
    }
};

const AuthContext = createContext(null);
const AuthDispatchContext = createContext(null);

export const AuthProvider = ({children}) => {
    const [auth, dispatch] = useReducer(authReducer, initialState);

    return (
        <AuthContext.Provider value={auth}>
            <AuthDispatchContext.Provider value={dispatch}>
                {children}
            </AuthDispatchContext.Provider>
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
export const useAuthDispatch = () => useContext(AuthDispatchContext);
