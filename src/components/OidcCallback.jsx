import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuthDispatch, SetAccessToken, SetAuthChoice, Login} from "../context/AuthProvider.jsx";
import oidcConfiguration from "../config/oidcConfiguration.js";
import useAuthInfo from "../hooks/AuthInfo.jsx";
import {useOidc} from "../context/OidcAuthContext.tsx";

const OidcCallback = () => {
    const {userManager, recreateUserManager} = useOidc();
    const authDispatch = useAuthDispatch();
    const authInfo = useAuthInfo();
    const navigate = useNavigate();

    const onUserRefreshed = (user) => {
        console.log("User refreshed:", user.profile.preferred_username, "expires_at:", user.expires_at);
        authDispatch({type: SetAccessToken, data: user.access_token});
        localStorage.setItem('authToken', user.access_token);
        localStorage.setItem('tokenExpiration', user.expires_at.toString());

        // Use BroadcastChannel only if available (browser environment)
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('auth-channel');
            channel.postMessage({type: 'tokenUpdated', data: user.access_token, expires_at: user.expires_at});
            channel.close();
        }
    };

    const handleTokenExpired = () => {
        console.warn('Access token expired, redirecting to /auth-choice');
        authDispatch({type: SetAccessToken, data: null});
        localStorage.removeItem('authToken');
        localStorage.removeItem('tokenExpiration');
        localStorage.removeItem('authChoice');

        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('auth-channel');
            channel.postMessage({type: 'logout'});
            channel.close();
        }
        navigate('/auth-choice');
    };

    const handleSilentRenewError = (error) => {
        console.error('Silent renew failed:', error);
        authDispatch({type: SetAccessToken, data: null});
        localStorage.removeItem('authToken');
        localStorage.removeItem('tokenExpiration');
        localStorage.removeItem('authChoice');

        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('auth-channel');
            channel.postMessage({type: 'logout'});
            channel.close();
        }
        navigate('/auth-choice');
    };

    useEffect(() => {
        const initializeUserManager = async () => {
            if (authInfo && !userManager) {
                console.log("Initializing UserManager with authInfo");
                try {
                    const config = await oidcConfiguration(authInfo);
                    recreateUserManager(config);
                } catch (error) {
                    console.error("Failed to initialize OIDC config:", error);
                    navigate('/auth-choice');
                }
            }
        };
        initializeUserManager();
    }, [authInfo, userManager, recreateUserManager, navigate]);

    useEffect(() => {
        if (userManager) {
            console.log("Handling OIDC callback or session check");

            // Use getUser only if it exists (for testing compatibility)
            if (typeof userManager.getUser === 'function') {
                userManager.getUser().then((user) => {
                    if (user && !user.expired) {
                        console.log("Existing user session found:", user.profile.preferred_username);
                        onUserRefreshed(user);
                        userManager.events.addUserLoaded(onUserRefreshed);
                        userManager.events.addAccessTokenExpiring(() => {
                            console.log('Access token is about to expire, attempting silent renew...');
                        });
                        userManager.events.addAccessTokenExpired(handleTokenExpired);
                        userManager.events.addSilentRenewError(handleSilentRenewError);
                        navigate('/');
                    } else {
                        handleSigninRedirect();
                    }
                }).catch((err) => {
                    console.error("Failed to get user:", err);
                    handleSigninRedirect();
                });
            } else {
                // Fallback for testing environment
                handleSigninRedirect();
            }
        }
    }, [userManager, authDispatch, navigate]);

    const handleSigninRedirect = () => {
        userManager.signinRedirectCallback()
            .then((user) => {
                onUserRefreshed(user);
                authDispatch({type: SetAuthChoice, data: "openid"});
                authDispatch({type: Login, data: user.profile.preferred_username});
                userManager.events.addUserLoaded(onUserRefreshed);
                userManager.events.addAccessTokenExpiring(() => {
                    console.log('Access token is about to expire, attempting silent renew...');
                });
                userManager.events.addAccessTokenExpired(handleTokenExpired);
                userManager.events.addSilentRenewError(handleSilentRenewError);
                navigate('/');
            })
            .catch((err) => {
                console.error("signinRedirectCallback failed:", err);
                navigate('/auth-choice');
            });
    };

    useEffect(() => {
        // Only set up BroadcastChannel in browser environment
        if (typeof BroadcastChannel === 'undefined') return;

        const channel = new BroadcastChannel('auth-channel');
        channel.onmessage = (event) => {
            const {type, data, expires_at} = event.data || {};
            if (type === 'logout') {
                console.log('Logout triggered from another tab');
                authDispatch({type: SetAccessToken, data: null});
                localStorage.removeItem('authToken');
                localStorage.removeItem('tokenExpiration');
                localStorage.removeItem('authChoice');
                navigate('/auth-choice');
            } else if (type === 'tokenUpdated' && data && expires_at) {
                console.log('Token updated from another tab');
                authDispatch({type: SetAccessToken, data});
                localStorage.setItem('authToken', data);
                localStorage.setItem('tokenExpiration', expires_at.toString());
            }
        };
        return () => channel.close();
    }, [authDispatch, navigate]);

    return <>Logging ...</>;
};

export default OidcCallback;
