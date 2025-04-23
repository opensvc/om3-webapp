import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

import {useAuthDispatch, SetAccessToken, SetAuthChoice, Login,} from "../context/AuthProvider.jsx";
import oidcConfiguration from "../config/oidcConfiguration.js";
import useAuthInfo from "../hooks/AuthInfo.jsx";
import {useOidc} from "../context/OidcAuthContext.js";

const OidcCallback = () => {
    const {userManager, recreateUserManager} = useOidc();
    const authDispatch = useAuthDispatch()
    const authInfo = useAuthInfo();
    const navigate = useNavigate();

    const onUserRefreshed = (user) => {
        authDispatch({type: SetAccessToken, data: user.access_token})
        localStorage.setItem('authToken', user.access_token);
        localStorage.setItem('tokenExpiration', user.expires_at)
        console.log("user: ", user.profile.preferred_username, "expires_at:", user.expires_at);
    }

    useEffect(() => {
        if (authInfo && !userManager) {
            console.log("OidcCallback recreate user manager")
            recreateUserManager(oidcConfiguration(authInfo))
        } else if (userManager) {
            console.log("OidcCallback signinRedirectCallback")
            userManager.signinRedirectCallback()
                .then((user) => {
                    onUserRefreshed(user)
                    authDispatch({type: SetAuthChoice, data: "openid"});
                    authDispatch({type: Login, data: user.profile.preferred_username});
                    console.log("OidcCallback signinRedirectCallback subscribes events.addUserLoaded")
                    userManager.events.addUserLoaded(user => {
                        console.log("🎉 user loaded renewed!")
                        onUserRefreshed(user)
                    })
                    userManager.events.addAccessTokenExpiring(() => {
                        console.log('⚠️ Access token is about to expire...');
                    });
                    console.log("OidcCallback signinRedirectCallback navigate /")
                    navigate('/');
                })
                .catch((err) => {
                    console.error("OidcCallback signinRedirectCallback failed:", err)
                });
        }
    }, [authInfo, userManager]);

    return <>Logging ...</>;
}

export default OidcCallback;
