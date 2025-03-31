import { useEffect } from "react";
import { useStateValue } from "../state";

const useSSE = (token) => {
    const [, dispatch] = useStateValue();

    useEffect(() => {
        if (!token) return;

        console.log("🔄 Tentative de connexion au SSE avec token :", token);
        const eventSource = new EventSource("/sse", {
            headers: { "Authorization": `Bearer ${token}` },
        });

        eventSource.onopen = () => {
            console.log("✅ SSE connecté !");
            dispatch({ type: "setEventSourceAlive", data: true });
        };

        eventSource.onerror = (error) => {
            console.error("❌ Erreur SSE :", error);
            dispatch({ type: "setEventSourceAlive", data: false });
            eventSource.close();
        };

        eventSource.onmessage = (event) => {
            console.log("📩 SSE message reçu :", event.data);
        };

        return () => {
            console.log("❌ Fermeture de la connexion SSE.");
            eventSource.close();
        };
    }, [token, dispatch]);
};

export default useSSE;
