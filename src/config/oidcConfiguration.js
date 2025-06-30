/* eslint-disable no-unused-vars */

const initData = {
    client_id: "om3",
    response_type: "code",
    accessTokenExpiringNotificationTimeInSeconds: 30,
    automaticSilentRenew: true,
    monitorSession: true,
};

function oidcConfiguration(authInfo) {
    if (!authInfo?.openid?.authority) {
        console.warn("OIDC Configuration fallback: 'authInfo.openid.authority' is missing. Falling back to default configuration.");
        return initData;
    }

    try {
        const url = new URL(authInfo.openid.authority);
        if (!url.protocol || !url.host) {
            throw new Error('Malformed URI');
        }
    } catch (error) {
        console.error('Well-formed URL required for openid.authority', error);
        return initData;
    }

    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));

    return {
        ...initData,
        authority: authInfo.openid.authority,
        client_id: authInfo.openid.client_id,
        scope: authInfo.openid.scope || "openid profile email offline_access grant",
        redirect_uri: baseUrl + "/auth-callback",
        silent_redirect_uri: baseUrl + "/auth-callback",
        post_logout_redirect_uri: baseUrl + "/",
    };
}

export default oidcConfiguration;