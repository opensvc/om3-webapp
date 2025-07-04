/* eslint-disable no-unused-vars */

const DEFAULT_SCOPES = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "opensvc:om3",
    "opensvc:om3:root",
    "opensvc:om3:guest",
    "opensvc:badscope",
];

const initData = {
    client_id: "om3",
    response_type: "code",
    accessTokenExpiringNotificationTimeInSeconds: 30,
    automaticSilentRenew: true,
    monitorSession: true,
};

/**
 * Filters the DEFAULT_SCOPES based on a list of allowed scopes from the well-known configuration.
 * @param {string[]} allowedScopes - Scopes allowed from well-known config
 * @returns {string} space-separated filtered scopes
 */
function filterScopes(allowedScopes) {
    if (!Array.isArray(allowedScopes) || allowedScopes.length === 0) {
        return DEFAULT_SCOPES.join(" ");
    }

    return DEFAULT_SCOPES.filter(scope => allowedScopes.includes(scope)).join(" ");
}

async function oidcConfiguration(authInfo) {
    let scopesSupported = DEFAULT_SCOPES;
    if (!authInfo?.openid?.issuer) {
        console.warn("OIDC Configuration fallback: 'authInfo.openid.issuer' is missing. Falling back to default configuration.");
        return initData;
    }

    try {
        const url = new URL(authInfo.openid.issuer);
        if (!url.protocol || !url.host) {
            throw new Error("Malformed URI");
        }
        const wellKnownUrl = new URL('.well-known/openid-configuration', url);
        const response = await fetch(wellKnownUrl);

        if (response.ok) {
            const wellKnown = await response.json();
            scopesSupported = wellKnown.scopes_supported;
        } else {
            console.warn("Failed to fetch .well-known/openid-configuration:", response.status);
        }
    } catch (error) {
        console.error("Well-formed URL required for openid.issuer", error);
        return initData;
    }

    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));

    const finalScope = filterScopes(scopesSupported);
    return {
        ...initData,
        authority: authInfo.openid.issuer,
        client_id: authInfo.openid.client_id,
        scope: finalScope,
        redirect_uri: `${baseUrl}/auth-callback`,
        silent_redirect_uri: `${baseUrl}/auth-callback`,
        post_logout_redirect_uri: `${baseUrl}/`,
    };
}

export default oidcConfiguration;
