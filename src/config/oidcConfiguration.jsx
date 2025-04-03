/* eslint-disable no-unused-vars */

//const baseUrl = window.location.protocol + "//" + window.location.host;

const baseUrl = window.location.origin;

console.log("redirect_uri:", baseUrl + "/nodes");
console.log("silent_redirect_uri:", baseUrl + "/authentication/silent_callback");

const initData = {
    client_id: "ringfs",
    redirect_uri: baseUrl + "/authentication/callback",
    //redirect_uri: baseUrl + "/nodes",
    response_type: "id_token token",
    scope: "openid profile email",
    //silent_redirect_uri: baseUrl + "/authentication/silent_callback",
    silent_redirect_uri: baseUrl + '/authentication/callback',
    accessTokenExpiringNotificationTime: 60,
    automaticSilentRenew: true,
    //loadUserInfo: false,
    loadUserInfo: true,
    triggerAuthFlow: true,
    post_logout_redirect_uri: baseUrl + "/",
    authority: "",
};

function oidcConfiguration(authInfo) {

    // Check if authInfo and authInfo.openid are defined
    if (!authInfo || !authInfo.openid || !authInfo.openid.well_known_uri) {
        console.warn("OIDC Configuration fallback: 'authInfo.openid.well_known_uri' is missing. Falling back to default configuration.");
        return initData; // Returns default configuration if OIDC configuration is missing
    }

    // Verify the URI is well-formed
    try {
        const url = new URL(authInfo.openid.well_known_uri);
        if (!url.protocol || !url.host) {
            throw new Error('Malformed URI');
        }
    } catch (error) {
        console.error('Well-formed URL required for openid.well_known_uri', error);
        return initData; // Returns default configuration if URI is invalid
    }

    // Returns OIDC configuration with custom values
    return {
        ...initData,
        authority: authInfo.openid.well_known_uri,
        client_id: authInfo.openid.client_id,
    };
}

export default oidcConfiguration;