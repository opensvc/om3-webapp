
// Fonction pour créer l'EventSource
export const createEventSource = (url, token) => {

    if (!token) {
        console.error("❌ Token manquant pour l'EventSource !");
        return null;
    }

    console.log("🔗 Connexion à EventSource avec token", token);

    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
        console.log("✅ Connexion SSE établie !");
    };

    eventSource.onerror = (error) => {
        console.error("🚨 Erreur EventSource :", error);
        eventSource.close();

        // Reconnexion après 5 secondes
        setTimeout(() => {
            console.log("🔄 Tentative de reconnexion à EventSource...");
            createEventSource(url, token);
        }, 5000);
    };

    return eventSource;
};

// Fonction pour fermer l'EventSource
export const closeEventSource = (eventSource) => {
    if (eventSource) {
        console.log("🛑 Fermeture de l'EventSource");
        eventSource.close();
    }
};

// Hook personnalisé avec useEffect pour gérer l'EventSource
//export const useEventSource = (url, token) => {
//  useEffect(() => {
//    if (!token) {
//      console.error("❌ Aucun token fourni pour l'EventSource !");
//      return;
//    }
//
//    // Création de l'EventSource avec le token
//    const eventSource = createEventSource(url, token);
//
//    // Nettoyage lors du démontage du composant ou changement de token
//    return () => {
//      closeEventSource(eventSource);
//    };
//  }, [url, token]); // Redémarre l'EventSource si l'URL ou le token change
//};
//