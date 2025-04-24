/* eslint-disable no-unused-vars */

//const baseUrl = window.location.protocol + "//" + window.location.host;

const baseUrl = window.location.origin;

const initData = {
    client_id: "om3",
    redirect_uri: baseUrl + "/auth-callback",
    silent_redirect_uri: baseUrl + "/auth-callback",
    response_type: "code",
    scope: "openid profile email",
    accessTokenExpiringNotificationTimeInSeconds: 30,
    post_logout_redirect_uri: baseUrl + "/",
    automaticSilentRenew: true,
};

function oidcConfiguration(authInfo) {
    // Check if authInfo and authInfo.openid are defined
    if (!authInfo?.openid?.authority) {
        console.warn("OIDC Configuration fallback: 'authInfo.openid.authority' is missing. Falling back to default configuration.");
        return initData; // Returns default configuration if OIDC configuration is missing
    }

    // Verify the URI is well-formed
    try {
        const url = new URL(authInfo.openid.authority);
        if (!url.protocol || !url.host) {
            throw new Error('Malformed URI');
        }
    } catch (error) {
        console.error('Well-formed URL required for openid.authority', error);
        return initData; // Returns default configuration if URI is invalid
    }

    // Returns OIDC configuration with custom values
    return {
        ...initData,
        authority: authInfo.openid.authority,
        client_id: authInfo.openid.client_id,
    }
}

export default oidcConfiguration;