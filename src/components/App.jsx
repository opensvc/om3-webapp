import React, {useEffect, useCallback} from "react";
import {Routes, Route, Navigate} from "react-router-dom";
import OidcCallback from "./OidcCallback";
import AuthChoice from "./AuthChoice.jsx";
import Login from "./Login.jsx";
import '../styles/main.css';
import NodesTable from "./NodesTable";
import Objects from "./Objects";
import ObjectDetails from "./ObjectDetails";
import ClusterOverview from "./Cluster";
import NavBar from './NavBar';
import Namespaces from "./Namespaces";
import Heartbeats from "./Heartbeats";
import Pools from "./Pools";
import Network from "./Network";
import NetworkDetails from "./NetworkDetails";
import WhoAmI from "./WhoAmI";
import {OidcProvider, useOidc} from "../context/OidcAuthContext.tsx";
import {
    AuthProvider,
    useAuth,
    useAuthDispatch,
    SetAccessToken,
    SetAuthChoice,
    Login as LoginAction
} from "../context/AuthProvider";
import oidcConfiguration from "../config/oidcConfiguration.js";
import useAuthInfo from "../hooks/AuthInfo.jsx";

import logger from "../utils/logger.js";

const isTokenValid = (token) => {
    if (!token) {
        logger.debug("No token found in localStorage");
        return false;
    }

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const now = Date.now() / 1000;
        const expiration = payload.exp;
        const isValid = expiration > now;
        logger.debug(`Token validation: expires_at=${expiration}, now=${now}, valid=${isValid}`);
        return isValid;
    } catch (error) {
        logger.error("Error while verifying token:", error);
        return false;
    }
};

// Component to handle OIDC initialization
const OidcInitializer = ({children}) => {
    const {userManager, recreateUserManager, isInitialized} = useOidc();
    const authDispatch = useAuthDispatch();
    const auth = useAuth();
    const authInfo = useAuthInfo();

    const handleTokenExpired = useCallback(() => {
        logger.warn('Access token expired, redirecting to /ui/auth-choice');
        authDispatch({type: SetAccessToken, data: null});
        localStorage.removeItem('authToken');
        localStorage.removeItem('tokenExpiration');
        window.location.href = '/ui/auth-choice';
    }, [authDispatch]);

    const handleSilentRenewError = useCallback((error) => {
        logger.error('Silent renew failed:', error);
        authDispatch({type: SetAccessToken, data: null});
        localStorage.removeItem('authToken');
        localStorage.removeItem('tokenExpiration');
        window.location.href = '/ui/auth-choice';
    }, [authDispatch]);

    const onUserRefreshed = useCallback((user) => {
        logger.info("User refreshed:", user.profile?.preferred_username, "expires_at:", user.expires_at);
        authDispatch({type: SetAccessToken, data: user.access_token});
        localStorage.setItem('authToken', user.access_token);
        localStorage.setItem('tokenExpiration', user.expires_at.toString());
    }, [authDispatch]);

    // Initialize OIDC on startup if we have a token and auth choice is OIDC
    useEffect(() => {
        const initializeOidcOnStartup = async () => {
            const savedToken = localStorage.getItem('authToken');
            const savedAuthChoice = auth.authChoice || localStorage.getItem('authChoice');

                if (savedToken && savedAuthChoice === 'openid' && authInfo && !isInitialized) {
                logger.info("Initializing OIDC UserManager on app startup");
                try {
                    const config = await oidcConfiguration(authInfo);
                    recreateUserManager(config);

                    // Update authentication state
                    authDispatch({type: SetAuthChoice, data: 'openid'});
                    authDispatch({type: SetAccessToken, data: savedToken});
                } catch (error) {
                    logger.error("Failed to initialize OIDC on startup:", error);
                }
            }
        };

        initializeOidcOnStartup();
    }, [authInfo, isInitialized, auth.authChoice, authDispatch, recreateUserManager]);

    // Set up OIDC event listeners once the UserManager is created
    useEffect(() => {
            if (userManager && auth.authChoice === 'openid') {
            logger.info("Setting up OIDC event listeners");

            // Remove old listeners
            userManager.events.removeUserLoaded(onUserRefreshed);
            userManager.events.removeAccessTokenExpired(handleTokenExpired);
            userManager.events.removeSilentRenewError(handleSilentRenewError);

            // Add new listeners
            userManager.events.addUserLoaded(onUserRefreshed);
            userManager.events.addAccessTokenExpiring(() => {
                logger.debug('Access token is about to expire, attempting silent renew...');
            });
            userManager.events.addAccessTokenExpired(handleTokenExpired);
            userManager.events.addSilentRenewError(handleSilentRenewError);

            // Check for existing user
            userManager.getUser().then(user => {
                    if (user && !user.expired) {
                    logger.info("Found existing valid user:", user.profile?.preferred_username);
                    onUserRefreshed(user);
                    authDispatch({type: LoginAction, data: user.profile.preferred_username});
                } else if (user && user.expired) {
                    logger.debug("Found expired user, will attempt silent renew");
                }
            }).catch(err => {
                logger.error("Error getting user:", err);
            });
        }
    }, [userManager, auth.authChoice, authDispatch, handleTokenExpired, handleSilentRenewError, onUserRefreshed]);

    // Save auth choice to localStorage
    useEffect(() => {
        if (auth.authChoice) {
            localStorage.setItem('authChoice', auth.authChoice);
        }
    }, [auth.authChoice]);

    return children;
};

const ProtectedRoute = ({children}) => {
    const token = localStorage.getItem("authToken");
    const authChoice = localStorage.getItem('authChoice');

    // For OIDC, rely on UserManager to handle expiration
    if (authChoice === 'openid') {
        if (!token) {
            logger.warn("No OIDC token found, redirecting to /auth-choice");
            return <Navigate to="/auth-choice" replace/>;
        }
        return children;
    }

    // For other auth methods, validate the token
    if (!isTokenValid(token)) {
        logger.warn("Invalid or expired token, redirecting to /auth-choice");
        localStorage.removeItem("authToken");
        localStorage.removeItem("tokenExpiration");
        localStorage.removeItem("authChoice");
        return <Navigate to="/auth-choice" replace/>;
    }

    return children;
};

const App = () => {
    logger.info("App init");

    useEffect(() => {
        const checkTokenChange = () => {
            const newToken = localStorage.getItem("authToken");
            logger.debug("Storage event: newToken=", newToken);
        };

        window.addEventListener("storage", checkTokenChange);
        return () => window.removeEventListener("storage", checkTokenChange);
    }, []);

    return (
        <AuthProvider>
            <OidcProvider>
                <OidcInitializer>
                    <NavBar/>
                    <Routes>
                        <Route path="/" element={<Navigate to="/cluster" replace/>}/>
                        <Route path="/cluster" element={<ProtectedRoute><ClusterOverview/></ProtectedRoute>}/>
                        <Route path="/namespaces" element={<ProtectedRoute><Namespaces/></ProtectedRoute>}/>
                        <Route path="/heartbeats" element={<Heartbeats/>}/>
                        <Route path="/nodes" element={<ProtectedRoute><NodesTable/></ProtectedRoute>}/>
                        <Route path="/storage-pools" element={<ProtectedRoute><Pools/></ProtectedRoute>}/>
                        <Route path="/network" element={<ProtectedRoute><Network/></ProtectedRoute>}/>
                        <Route path="/network/:networkName"
                               element={<ProtectedRoute><NetworkDetails/></ProtectedRoute>}/>
                        <Route path="/objects" element={<ProtectedRoute><Objects/></ProtectedRoute>}/>
                        <Route path="/objects/:objectName" element={<ProtectedRoute><ObjectDetails/></ProtectedRoute>}/>
                        <Route path="/whoami" element={<ProtectedRoute><WhoAmI/></ProtectedRoute>}/>
                        <Route path="/auth-callback" element={<OidcCallback/>}/>
                        <Route path="/auth-choice" element={<AuthChoice/>}/>
                        <Route path="/auth/login" element={<Login/>}/>
                        <Route path="*" element={<Navigate to="/"/>}/>
                    </Routes>
                </OidcInitializer>
            </OidcProvider>
        </AuthProvider>
    );
};

export default App;
