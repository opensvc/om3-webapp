/* eslint-disable no-unused-vars */

import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { OidcProvider, OidcSecure } from "@axa-fr/react-oidc-context";
import * as Oidc from "@axa-fr/react-oidc-context";
import oidcConfiguration from "../config/oidcConfiguration.jsx";
import useAuthInfo from "../hooks/AuthInfo.jsx";
import { useStateValue, StateProvider } from "../state";
import AuthChoice from "./Authchoice.jsx";
import Login from "./Login.jsx";
import NotAuthorized from "./NotAuthorized.jsx";
import NotAuthenticated from "./NotAuthenticated.jsx";
import Authenticating from "./Authenticating.jsx";
import LoginCallback from "./LoginCallback.jsx";
//import "../styles/App.css";
import '../styles/main.css'
//import 'tailwindcss/tailwind.css'
import NodesTable from "./NodesTable";

let enabled;

const isTokenValid = (token) => {
    if (!token) return false;

    try {
        const payload = JSON.parse(atob(token.split(".")[1])); // Decode the JWT token
        const now = Date.now() / 1000; // Current timestamp in seconds
        return payload.exp > now; // Check if the token is not expired
    } catch (error) {
        console.error("Error while verifying token:", error);
        return false; // Consider the token invalid if corrupted
    }
};


//const ProtectedRoute = ({ children }) => {
//  const token = localStorage.getItem("authToken");
//  return token ? children : <Navigate to="/login" replace />;
//};

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem("authToken");

    if (!isTokenValid(token)) {
        console.warn("🔴 Invalid or expired token, redirecting to /login");
        localStorage.removeItem("authToken"); // Remove the expired token
        return <Navigate to="/login" replace />;
    }

    return children;
};


const AppStateProvider = ({ children }) => {
    const initialTheme = localStorage.getItem("opensvc.theme");
    const initialState = {
        theme: initialTheme || "light",
        authChoice: localStorage.getItem("opensvc.authChoice"),
        cstat: {},
        user: {},
        basicLogin: {},
        alerts: [],
        eventSourceAlive: false,
        authInfo: null,
    };

    const reducer = (state, action) => {
        switch (action.type) {
            case "loadUser":
                return { ...state, user: action.data };

            case "setEventSourceAlive":
                return action.data === state.eventSourceAlive ? state : { ...state, eventSourceAlive: action.data };

            case "setBasicLogin":
                return { ...state, basicLogin: action.data };

            case "setAuthChoice":
                localStorage.setItem("opensvc.authChoice", action.data);
                return { ...state, authChoice: action.data };

            case "setTheme":
                localStorage.setItem("opensvc.theme", action.data);
                return { ...state, theme: action.data };

            case "loadCstat":
                if (!action.data.cluster) return state;
                document.title = action.data.cluster.name || "App";
                return { ...state, cstat: action.data };

            case "pushAlerts":
                return { ...state, alerts: [...state.alerts, ...action.data] };

            case "pushAlert":
                return { ...state, alerts: [...state.alerts, { ...action.data, date: new Date() }] };

            case "closeAlert":
                return { ...state, alerts: state.alerts.filter((_, i) => i !== action.i) };

            case "setAuthInfo":
                return { ...state, authInfo: action.data };

            default:
                return state;
        }
    };

    return <StateProvider initialState={initialState} reducer={reducer}>{children}</StateProvider>;
};

const AuthProvider = ({ children }) => {
    const authInfo = useAuthInfo();

    // Using configuration with oidcConfiguration
    const config = oidcConfiguration(authInfo);

    const location = useLocation();
    const [{ authChoice, user, basicLogin }, dispatch] = useStateValue();

    React.useEffect(() => {
        if (authInfo) {
            dispatch({ type: "setAuthInfo", data: authInfo });
        }
    }, [authInfo, dispatch]);


    const oidcUser = authInfo?.user;

    // 🔹 Token refresh management
    React.useEffect(() => {
        if (!oidcUser) return;

        const handleTokenExpiring = () => {
            console.log("🔄 Token expiring... Attempting renewal...");
            if (authInfo && authInfo.renewTokens) {
                authInfo.renewTokens()
                    .then(() => {
                        console.log("🎉 Token renewed!");
                    })
                    .catch((error) => {
                        console.error("Error while renewing token:", error);
                    });
            } else {
                console.warn("⚠️ Unable to renew token, 'renewTokens' is unavailable.");
            }
        };

        const handleTokenExpired = () => {
            console.log("⚠️ Token expired... Attempting logout...");
            if (authInfo?.logout) {
                authInfo.logout();
            } else {
                console.warn("⚠️ Unable to logout: logout method not available");
            }
        };

        window.addEventListener("tokenExpiring", handleTokenExpiring);
        window.addEventListener("tokenExpired", handleTokenExpired);

        return () => {
            window.removeEventListener("tokenExpiring", handleTokenExpiring);
            window.removeEventListener("tokenExpired", handleTokenExpired);
        };
    }, [oidcUser, authInfo]);

    if (!authInfo) return null;

    // 🔹 BASIC mode: Verify credentials are provided
    if (authChoice === "basic" && (!basicLogin.username || !basicLogin.password)) return <Login />;

    // 🔹 If no authentication method chosen and no OIDC user
    if (!authChoice && !oidcUser && location.pathname !== "/authentication/callback") return <AuthChoice />;

    // 🔹 Redirect to "NotAuthorized" if user is unauthenticated and tries to access a protected page
    if (!oidcUser && location.pathname !== "/authentication/callback" && user?.status === 401) return <NotAuthorized />;

    try {
        enabled = authChoice === "openid";
    } catch (e) {
        enabled = false;
    }

    // 🔹 If OIDC is not enabled, render children directly
    if (!enabled) return <>{children}</>;

    return (
        <OidcProvider
            userManager={config}
            notAuthenticated={<Login />}
            notAuthorized={NotAuthorized}
            authenticating={Authenticating}
            callbackComponentOverride={LoginCallback}
            isEnabled={enabled}
        >
            <OidcSecure>{children}</OidcSecure>
        </OidcProvider>
    );
};

// 🌍 Main Application
const App = () => {
    const [token, setToken] = useState(localStorage.getItem("authToken") || null);

    // 🔹 Monitor changes in `localStorage`
    useEffect(() => {
        const checkTokenChange = () => {
            const newToken = localStorage.getItem("authToken");
            if (newToken !== token) {
                setToken(newToken);
            }
        };

        window.addEventListener("storage", checkTokenChange);
        return () => window.removeEventListener("storage", checkTokenChange);
    }, [token]);

    return (
        <AppStateProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Navigate to="/nodes" replace />} />
                    <Route path="/nodes" element={<ProtectedRoute><NodesTable /></ProtectedRoute>} />
                    <Route
                        path="/login"
                        element={
                            <AuthProvider>
                                <Login />
                            </AuthProvider>
                        }
                    />
                    <Route path="/unauthorized" element={<NotAuthorized />} />
                    <Route path="*" element={<Navigate to="/" />} />
                    <Route path="/authentication/callback" element={<LoginCallback />} />
                </Routes>
            </Router>
        </AppStateProvider>
    );
};

export default App;