/* eslint-disable no-unused-vars */

import { useState, useRef } from "react";
import { createEventSource, closeEventSource } from "../eventSourceManager";
import { fetchData } from "../services/api";

const useFetchNodes = () => {
    const [nodes, setNodes] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const eventSourceRef = useRef(null);
    const cacheRef = useRef([]);

    // Function to fetch daemon statuses with token
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
            console.error("Error while fetching daemon statuses:", err);
            setError("Failed to retrieve daemon statuses.");
        } finally {
            setLoading(false);
        }
    };

    // Function to start SSE with a token
    const startEventReception = (token) => {
        if (!token) {
            console.error("❌ No token provided for SSE!");
            return;
        }

        console.log("🔗 Connecting SSE with token...", token);

        // Close previous connection before opening a new one
        if (eventSourceRef.current) {
            closeEventSource(eventSourceRef.current);
        }

        // Create new SSE connection
        eventSourceRef.current = createEventSource("/sse", token);
    };

    return { nodes, error, loading, fetchNodes, startEventReception };
};

export default useFetchNodes;