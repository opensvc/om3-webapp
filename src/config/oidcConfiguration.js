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
    console.log("AuthInfo:", authInfo);

    // Vérifie si authInfo et authInfo.openid sont définis
    if (!authInfo || !authInfo.openid || !authInfo.openid.well_known_uri) {
        console.warn("OIDC Configuration fallback: 'authInfo.openid.well_known_uri' est manquant. Retour à la configuration par défaut.");
        return initData; // Retourne la configuration par défaut si la configuration OIDC est manquante
    }

    console.log("AuthInfo.openid:", authInfo.openid);
    console.log("AuthInfo.openid.well_known_uri:", authInfo.openid.well_known_uri);

    // Vérifie que l'URI bien formée
    try {
        const url = new URL(authInfo.openid.well_known_uri);
        if (!url.protocol || !url.host) {
            throw new Error('URI mal formée');
        }
    } catch (error) {
        console.error('URL bien formée nécessaire pour openid.well_known_uri', error);
        return initData; // Retourne la configuration par défaut si l'URI est invalide
    }

    // Retourne la configuration OIDC avec les valeurs personnalisées
    return {
        ...initData,
        authority: authInfo.openid.well_known_uri,
        client_id: authInfo.openid.client_id,
    };
}

export default oidcConfiguration;
