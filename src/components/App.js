/* eslint-disable no-unused-vars */

import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { OidcProvider, OidcSecure } from "@axa-fr/react-oidc-context";
import * as Oidc from "@axa-fr/react-oidc-context";
import oidcConfiguration from "../config/oidcConfiguration.js";
import useAuthInfo from "../hooks/AuthInfo.jsx";
import { useStateValue, StateProvider } from "../state";
import AuthChoice from "./Authchoice.js";
import Login from "./Login.js";
import NotAuthorized from "./NotAuthorized.js";
import NotAuthenticated from "./NotAuthenticated.js";
import Authenticating from "./Authenticating.js";
import LoginCallback from "./LoginCallback.js";
import "../styles/App.css";
import NodesTable from "./NodesTable";
import useSSE from "../hooks/useSSE";

let enabled;

console.log("Oidc:", Oidc);
console.log("OidcProvider:", OidcProvider);

const isTokenValid = (token) => {
    if (!token) return false;

    try {
        const payload = JSON.parse(atob(token.split(".")[1])); // Décoder le token JWT
        const now = Date.now() / 1000; // Timestamp actuel en secondes
        return payload.exp > now; // Vérifie si le token n'est pas expiré
    } catch (error) {
        console.error("Erreur lors de la vérification du token:", error);
        return false; // Considère le token comme invalide s'il est corrompu
    }
};


//const ProtectedRoute = ({ children }) => {
//  const token = localStorage.getItem("authToken");
//  return token ? children : <Navigate to="/login" replace />;
//};

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem("authToken");

    if (!isTokenValid(token)) {
        console.warn("🔴 Token invalide ou expiré, redirection vers /login");
        localStorage.removeItem("authToken"); // Supprime le token périmé
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
                console.log("Mise à jour de basicLogin avec les données :", action.data);
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
    console.log("AuthInfo:", authInfo);

    // Utilisation de la configuration avec oidcConfiguration
    const config = oidcConfiguration(authInfo);
    console.log("oidcConfiguration(authInfo):", config);

    const location = useLocation();
    const [{ authChoice, user, basicLogin }, dispatch] = useStateValue();
    console.log("basicLogin:", basicLogin);



    React.useEffect(() => {
        if (authInfo) {
            console.log("Mise à jour du state avec authInfo:", authInfo);
            dispatch({ type: "setAuthInfo", data: authInfo });
        }
    }, [authInfo, dispatch]);

    console.log("AuthProvider:", authChoice, user, basicLogin);

    const oidcUser = authInfo?.user;

    // 🔹 Gestion du rafraîchissement du token
    React.useEffect(() => {
        if (!oidcUser) return;

        const handleTokenExpiring = () => {
            console.log("🔄 Token expiring... Tentative de renouvellement...");
            if (authInfo && authInfo.renewTokens) {
                authInfo.renewTokens()
                    .then(() => {
                        console.log("🎉 Token renouvelé !");
                    })
                    .catch((error) => {
                        console.error("Erreur lors du renouvellement du token:", error);
                    });
            } else {
                console.warn("⚠️ Impossible de renouveler le token, 'renewTokens' est indisponible.");
            }
        };

        const handleTokenExpired = () => {
            console.log("⚠️ Token expiré... Tentative de déconnexion...");
            if (authInfo?.logout) {
                authInfo.logout();
            } else {
                console.warn("⚠️ Impossible de se déconnecter : méthode logout non disponible");
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

    // 🔹 Mode BASIC : Vérifie que les identifiants sont fournis
    if (authChoice === "basic" && (!basicLogin.username || !basicLogin.password)) return <Login />;

    // 🔹 Si aucune méthode d'authentification choisie et pas d'utilisateur OIDC
    if (!authChoice && !oidcUser && location.pathname !== "/authentication/callback") return <AuthChoice />;

    // 🔹 Redirige vers "NotAuthorized" si l'utilisateur est non authentifié et tente d'accéder à une page protégée
    if (!oidcUser && location.pathname !== "/authentication/callback" && user?.status === 401) return <NotAuthorized />;

    try {
        enabled = authChoice === "openid";
    } catch (e) {
        enabled = false;
    }

    // 🔹 Si OIDC n'est pas activé, on affiche les enfants directement
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


// 🌍 Application principale
const App = () => {
    const [token, setToken] = useState(localStorage.getItem("authToken") || null);

    // Fonction pour établir la connexion SSE
    const initSSEConnection = async () => {
        if (!token) {
            console.log("Aucun token trouvé. Connexion SSE non établie.");
            return;
        }

        try {
            console.log("Token trouvé, initialisation de la connexion SSE...");
            const response = await fetch("/sse", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (response.ok) {
                console.log("Connexion SSE réussie!");
            } else {
                console.error("Erreur lors de la connexion SSE.");
            }
        } catch (error) {
            console.error("Erreur de connexion SSE:", error);
        }
    };

    // 🔹 Établir la connexion SSE au chargement ET lorsqu'un nouveau token est détecté
    useEffect(() => {
        initSSEConnection();
    }, [token]);

    // 🔹 Surveiller les changements dans `localStorage`
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
