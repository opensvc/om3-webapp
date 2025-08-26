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
    };

    const handleTokenExpired = () => {
        console.warn('Access token expired, redirecting to /auth-choice');
        authDispatch({type: SetAccessToken, data: null});
        localStorage.removeItem('authToken');
        localStorage.removeItem('tokenExpiration');
        navigate('/auth-choice');
    };

    const handleSilentRenewError = (error) => {
        console.error('Silent renew failed:', error);
        authDispatch({type: SetAccessToken, data: null});
        localStorage.removeItem('authToken');
        localStorage.removeItem('tokenExpiration');
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
            console.log("Handling signinRedirectCallback");
            userManager.signinRedirectCallback()
                .then((user) => {
                    onUserRefreshed(user);
                    authDispatch({type: SetAuthChoice, data: "openid"});
                    authDispatch({type: Login, data: user.profile.preferred_username});

                    // Subscribe to events
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
        }
    }, [userManager, authDispatch, navigate]);

    return <>Logging ...</>;
};

export default OidcCallback;
