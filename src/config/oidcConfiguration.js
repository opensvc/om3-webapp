/* eslint-disable no-unused-vars */

const initData = {
    client_id: "om3",
    response_type: "code",
    scope: "openid profile email",
    accessTokenExpiringNotificationTimeInSeconds: 30,
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

    let baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))

    // Returns OIDC configuration with custom values
    return {
        ...initData,
        authority: authInfo.openid.authority,
        client_id: authInfo.openid.client_id,
        redirect_uri: baseUrl + "/auth-callback",
        silent_redirect_uri: baseUrl + "/auth-callback",
        post_logout_redirect_uri: baseUrl + "/",
    }
}

export default oidcConfiguration;