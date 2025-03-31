/* eslint-disable no-unused-vars */

import { useState, useRef } from "react";
import { createEventSource, closeEventSource } from "../../eventSourceManager";
import { fetchData } from "../services/api";

const useFetchNodes = () => {
    const [nodes, setNodes] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const eventSourceRef = useRef(null);
    const cacheRef = useRef([]);

    // Fonction pour récupérer les daemon statuses avec le token
    const fetchNodes = async (token) => {
        setLoading(true);
        setError("");
        try {
            const result = await fetchData(token);
            const nodesArray = Object.keys(result.cluster.node).map((key) => ({
                nodename: key,
                ...result.cluster.node[key],
            }));
            setNodes(nodesArray);
            cacheRef.current = nodesArray;
        } catch (err) {
            console.error("Erreur lors de la récupération des daemon statuses :", err);
            setError("Impossible de récupérer les daemon status.");
        } finally {
            setLoading(false);
        }
    };

    // Fonction pour démarrer SSE avec un token
    const startEventReception = (token) => {
        if (!token) {
            console.error("❌ Aucun token fourni pour SSE !");
            return;
        }

        console.log("🔗 Connexion SSE avec le token...", token);

        // Fermer la connexion précédente avant d'en ouvrir une nouvelle
        if (eventSourceRef.current) {
            closeEventSource(eventSourceRef.current);
        }

        // Créer une nouvelle connexion SSE
        eventSourceRef.current = createEventSource("/sse", token);
    };

    return { nodes, error, loading, fetchNodes, startEventReception };
};

export default useFetchNodes;
