import React, {useEffect, useCallback, lazy, Suspense, useRef} from "react";
import {Routes, Route, Navigate, useNavigate, useLocation, useParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import OidcCallback from "./OidcCallback";
import SilentRenew from "./SilentRenew.jsx";
import {attachOidcSession, isSessionGone, renewOidcSession} from "../context/oidcSession.js";
import AuthChoice from "./AuthChoice.jsx";
import Login from "./Login.jsx";
import '../styles/main.css';
import NavBar from './NavBar';
import {Sidebar, useSidebarOpen} from './Sidebar';
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
import {prepareForNavigation} from "../eventSourceManager";
import {PeekPanel} from "./PeekPanel";
import {PanelAnchor} from "../app/PanelAnchor";
import {PanelSideProvider} from "../app/PanelSideProvider";
import {usePanelSidePref} from "../app/panel-side-pref";
import {useRecordHistory} from "../app/record-history";
import {ShortcutsHelp} from "../app/ShortcutsHelp";
import {useShortcut} from "../ui/lib/shortcuts";

import {decodeToken as decodeTokenFromLogin} from "./Login.jsx";

// Lazy load components for code splitting
const NodesTable = lazy(() => import("./NodesTable"));
const Objects = lazy(() => import("./Objects"));
const Heartbeats = lazy(() => import("./Heartbeats"));
const Pools = lazy(() => import("./Pools"));
const Network = lazy(() => import("./Network"));
const WhoAmI = lazy(() => import("./WhoAmI"));

/*
 * The records had pages of their own; they open in a panel over their list now, as
 * in oc3 (`panel-search.ts`). The old addresses, bookmarked or shared, lead there.
 */
const ObjectRedirect = () => {
    const {objectName} = useParams();
    return <Navigate to={`/objects?${new URLSearchParams({sel: decodeURIComponent(objectName)})}`} replace/>;
};

const NetworkRedirect = () => {
    const {networkName} = useParams();
    return <Navigate to={`/network?${new URLSearchParams({sel: networkName})}`} replace/>;
};

/** An old page become a tab of the Objects page: there, its filter kept. */
const ObjectsTab = ({list}) => {
    const {search} = useLocation();
    const params = new URLSearchParams(search);
    params.set("list", list);
    return <Navigate to={`/objects?${params}`} replace/>;
};

// An instance is a column of the status board of its object.
const InstanceRedirect = () => {
    const {objectName} = useParams();
    return <Navigate to={`/objects?${new URLSearchParams({sel: decodeURIComponent(objectName)})}`} replace/>;
};

// Loading component for Suspense fallback
const Loading = () => {
    const {t} = useTranslation();
    return (
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
            <div style={{fontSize: '1.125rem'}}>{t("nav.loading")}</div>
        </div>
    );
};

const isTokenValid = (token) => {
    if (!token) {
        logger.debug("No token found in localStorage");
        return false;
    }

    const payload = decodeTokenFromLogin(token);
    if (!payload || !payload.exp) {
        return false
    }

    const now = Date.now() / 1000;
    const expiration = payload.exp;
    const isValid = expiration > now;
    logger.debug(`Token validation: expires_at=${expiration}, now=${now}, valid=${isValid}`);
    return isValid;
};

// Component to handle OIDC initialization
const OidcInitializer = ({children, authInfo}) => {
    const location = useLocation();
    const {userManager, recreateUserManager, isInitialized} = useOidc();
    const authDispatch = useAuthDispatch();
    const auth = useAuth();
    const navigate = useNavigate();
    const resumeCheckTimer = useRef(null); // debounce timer

    // The provider ended the session: sign in again. A token expired or a renewal
    // failing for a network blip is not that (oidcSession).
    const handleSignedOut = useCallback(() => {
        authDispatch?.({type: SetAccessToken, data: null});
        localStorage.removeItem('authToken');
        localStorage.removeItem('tokenExpiration');
        navigate('/auth-choice', {replace: true});
    }, [authDispatch, navigate]);

    const onUserRefreshed = useCallback((user) => {
        logger.info("User refreshed:", user.profile?.preferred_username, "expires_at:", user.expires_at);
        authDispatch?.({type: SetAccessToken, data: user.access_token});
        localStorage.setItem('authToken', user.access_token);
        localStorage.setItem('tokenExpiration', user.expires_at.toString());
    }, [authDispatch]);

    useEffect(() => {
        const init = async () => {
            const savedToken = localStorage.getItem('authToken');
            const savedAuthChoice = auth.authChoice || localStorage.getItem('authChoice');
            if (savedToken && savedAuthChoice === 'openid' && authInfo && !isInitialized) {
                logger.info("Initializing OIDC UserManager on app startup");
                try {
                    const config = await oidcConfiguration(authInfo);
                    recreateUserManager(config);
                    authDispatch?.({type: SetAuthChoice, data: 'openid'});
                    authDispatch?.({type: SetAccessToken, data: savedToken});
                } catch (error) {
                    logger.error("Failed to initialize OIDC on startup:", error);
                }
            }
        };
        init().catch((err) => logger.error("OIDC init error:", err));
    }, [authInfo, isInitialized, auth.authChoice, authDispatch, recreateUserManager]);

    // The session kept alive in one place (oidcSession): renewed, its renewal
    // tried again after a transient failure, ended only by the provider.
    useEffect(() => {
        if (!userManager || auth.authChoice !== 'openid') return undefined;
        logger.info("Attaching the OpenID session");
        const detach = attachOidcSession(userManager, {onUser: onUserRefreshed, onSignedOut: handleSignedOut});
        const signedIn = (user) => {
            onUserRefreshed(user);
            authDispatch?.({type: LoginAction, data: user.profile.preferred_username});
        };
        userManager.getUser().then(user => {
            if (user && !user.expired) {
                logger.info("Found existing valid user:", user.profile?.preferred_username);
                signedIn(user);
            } else if (user) {
                logger.debug("Found expired user, renewing the session");
                renewOidcSession(userManager).then(signedIn).catch((error) => {
                    if (isSessionGone(error)) handleSignedOut();
                    else logger.warn("Session renewal failed, kept for a retry:", error?.message ?? error);
                });
            }
        }).catch(err => {
            logger.error("Error getting user:", err);
        });
        return detach;
    }, [userManager, auth.authChoice, authDispatch, handleSignedOut, onUserRefreshed]);

    useEffect(() => {
        if (auth.authChoice) {
            localStorage.setItem('authChoice', auth.authChoice);
        }
    }, [auth.authChoice]);

    useEffect(() => {
        const handler = (e) => {
            const path = e?.detail || '/auth-choice';
            navigate(path, {replace: true});
        };
        window.addEventListener('om3:auth-redirect', handler);
        return () => window.removeEventListener('om3:auth-redirect', handler);
    }, [navigate]);

    useEffect(() => {
        const handleCheckAuthOnResume = () => {
            const authPaths = ['/auth-choice', '/auth/login', '/auth-callback', '/silent-renew'];
            if (authPaths.includes(location.pathname)) {
                return;
            }
            try {
                const authChoice = localStorage.getItem('authChoice');
                const token = localStorage.getItem('authToken');
                if (authChoice === 'openid') {
                    if (!token) {
                        logger.warn('No OIDC token found on resume, redirecting to /auth-choice');
                        navigate('/auth-choice', {replace: true});
                    } else if (!isTokenValid(token) && userManager) {
                        // Still initializing without a user manager: its start renews the session.
                        logger.warn('OIDC token expired on resume, renewing the session');
                        renewOidcSession(userManager).then((user) => {
                            logger.info('Session renewed on resume');
                            onUserRefreshed(user);
                        }).catch((error) => {
                            if (isSessionGone(error)) handleSignedOut();
                            else logger.warn('Session renewal failed on resume, kept for a retry:', error?.message ?? error);
                        });
                    }
                    return;
                }
                if (!isTokenValid(token)) {
                    logger.warn('Token invalid or expired on resume, redirecting to /auth-choice');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('tokenExpiration');
                    localStorage.removeItem('authChoice');
                    navigate('/auth-choice', {replace: true});
                }
            } catch (err) {
                logger.error('Error while checking auth on resume:', err);
            }
        };

        const debouncedCheck = () => {
            if (resumeCheckTimer.current) {
                clearTimeout(resumeCheckTimer.current);
            }
            resumeCheckTimer.current = setTimeout(handleCheckAuthOnResume, 500);
        };

        const visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                debouncedCheck();
            }
        };
        const focusHandler = () => {
            debouncedCheck();
        };

        document.addEventListener('visibilitychange', visibilityHandler);
        window.addEventListener('focus', focusHandler);

        return () => {
            document.removeEventListener('visibilitychange', visibilityHandler);
            window.removeEventListener('focus', focusHandler);
            if (resumeCheckTimer.current) {
                clearTimeout(resumeCheckTimer.current);
            }
        };
    }, [navigate, userManager, onUserRefreshed, handleSignedOut, location.pathname]);

    return children;
};

const ProtectedRoute = ({children}) => {
    const location = useLocation();
    const token = localStorage.getItem("authToken");
    const authChoice = localStorage.getItem('authChoice');

    const authPaths = ['/auth-choice', '/auth/login', '/auth-callback', '/silent-renew'];
    if (authPaths.includes(location.pathname)) {
        return children;
    }

    if (authChoice === 'openid') {
        if (!token) {
            logger.warn("No OIDC token found, redirecting to /auth-choice");
            return <Navigate to="/auth-choice" replace/>;
        }
        return children;
    }

    if (!isTokenValid(token)) {
        logger.warn("Invalid or expired token, redirecting to /auth-choice");
        localStorage.removeItem("authToken");
        localStorage.removeItem("tokenExpiration");
        localStorage.removeItem("authChoice");
        return <Navigate to="/auth-choice" replace/>;
    }

    return children;
};

const AUTH_PATHS = ['/auth', '/login', '/silent-renew'];

const App = () => {
    logger.info("App init");
    const location = useLocation();
    const mainRef = useRef(null);

    const authInfo = useAuthInfo();
    const [sidebarOpen, toggleSidebar] = useSidebarOpen();
    // The sign-in screens have no view to navigate to: no menu there.
    const showSidebar = !AUTH_PATHS.some((path) => location.pathname.startsWith(path));

    // "n", for navigation, moves the focus to the menu, on the entry of the view on
    // display, unfolding the menu first when it is folded: the focus waits for it to
    // leave `inert`.
    useShortcut("n", () => {
        if (!showSidebar) return false;
        if (!sidebarOpen) toggleSidebar();
        window.requestAnimationFrame(() => {
            const menu = document.getElementById("app-sidebar");
            const entry = menu?.querySelector('a[aria-current="page"]') ?? menu?.querySelector("a, button");
            entry?.focus();
        });
        return true;
    });

    // Another view starts at its top. Not a panel opening over the view, nor its
    // filters changing: those keep the place in the list.
    useEffect(() => {
        if (mainRef.current) {
            mainRef.current.scrollTop = 0;
        }
        prepareForNavigation();
    }, [location.pathname]);

    useEffect(() => {
        const checkTokenChange = () => {
            const newToken = localStorage.getItem("authToken");
            logger.debug("Storage event: newToken=", newToken);
        };
        window.addEventListener("storage", checkTokenChange);
        return () => window.removeEventListener("storage", checkTokenChange);
    }, []);

    const appContainerStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--surface)',
        color: 'var(--ink)',
    };

    // The anchor that brings the panels back stands on their edge of the window, over
    // the views: while there is a record to bring back, the views keep a gutter as
    // wide as it on that side, so that it covers nothing, an Actions menu at the end
    // of a toolbar included.
    const panelSide = usePanelSidePref().value;
    const historySize = useRecordHistory().entries.length;
    const anchorShown = showSidebar && historySize > 0;
    const mainStyle = {
        flex: 1,
        minWidth: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        width: '100%',
        ...(anchorShown ? {[panelSide === 'left' ? 'paddingLeft' : 'paddingRight']: '2.5rem'} : {}),
    };

    return (
        <AuthProvider>
            <OidcProvider>
                <OidcInitializer authInfo={authInfo}>
                    <PanelSideProvider>
                        <div id="app-root-container" style={appContainerStyle}>
                            <NavBar
                                sidebarOpen={sidebarOpen}
                                onToggleSidebar={toggleSidebar}
                                showSidebarToggle={showSidebar}
                            />
                            <div style={{display: 'flex', flex: 1, minHeight: 0}}>
                                {showSidebar && <Sidebar open={sidebarOpen}/>}
                                <main id="app-scroll-container" ref={mainRef} style={mainStyle}>
                                    <Suspense fallback={<Loading/>}>
                                        <Routes>
                                            <Route path="/" element={<Navigate to="/objects" replace/>}/>
                                            {/* Tabs of the Objects page now: an old link lands there. */}
                                            <Route path="/namespaces" element={<ObjectsTab list="namespaces"/>}/>
                                            <Route path="/kinds" element={<ObjectsTab list="any"/>}/>
                                            <Route path="/heartbeats" element={<Heartbeats/>}/>
                                            <Route path="/nodes" element={<ProtectedRoute><NodesTable/></ProtectedRoute>}/>
                                            <Route path="/pools" element={<ProtectedRoute><Pools/></ProtectedRoute>}/>
                                            <Route path="/network" element={<ProtectedRoute><Network/></ProtectedRoute>}/>
                                            <Route path="/network/:networkName" element={<NetworkRedirect/>}/>
                                            <Route path="/objects" element={<ProtectedRoute><Objects/></ProtectedRoute>}/>
                                            <Route path="/objects/:objectName" element={<ObjectRedirect/>}/>
                                            <Route path="/nodes/:node/objects/:objectName" element={<InstanceRedirect/>}/>
                                            <Route path="/whoami" element={<ProtectedRoute><WhoAmI/></ProtectedRoute>}/>
                                            <Route path="/silent-renew" element={<SilentRenew/>}/>
                                            <Route path="/auth-callback" element={<OidcCallback/>}/>
                                            <Route path="/auth-choice" element={<AuthChoice authInfo={authInfo}/>}/>
                                            <Route path="/auth/login" element={<Login/>}/>
                                            <Route path="*" element={<Navigate to="/"/>}/>
                                        </Routes>
                                        {/* The record opened from a badge or the history, whatever the
                                            view, and what brings the panels back once closed. */}
                                        {showSidebar && localStorage.getItem("authToken") && (
                                            <>
                                                <PeekPanel/>
                                                <PanelAnchor/>
                                                <ShortcutsHelp/>
                                            </>
                                        )}
                                    </Suspense>
                                </main>
                            </div>
                        </div>
                    </PanelSideProvider>
                </OidcInitializer>
            </OidcProvider>
        </AuthProvider>
    );
};

export default App;
