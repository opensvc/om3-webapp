/* eslint-disable no-unused-vars */

import {useState, useRef} from "react";
import {createEventSource, closeEventSource} from "../eventSourceManager";
import {fetchDaemonStatus} from "../services/api";

const useFetchDaemonStatus = () => {
    const [nodes, setNodes] = useState([]);
    const [daemon, setDaemon] = useState({});
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const eventSourceRef = useRef(null);
    const cacheRef = useRef([]);
    const [clusterStats, setClusterStats] = useState({});

    // Function to fetch daemon statuses with token
    const refreshDaemonStatus = async (token) => {
        setLoading(true);
        setError("");
        try {
            const result = await fetchDaemonStatus(token);
            const nodesArray = Object.keys(result.cluster.node).map((key) => ({
                nodename: key,
                ...result.cluster.node[key],
            }));
            setDaemon(result.daemon);
            setNodes(nodesArray);
            setClusterStats({
                nodeCount: nodesArray.length,
            });
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

    return { daemon, nodes, clusterStats, error, loading, fetchNodes: refreshDaemonStatus, startEventReception };
};

export default useFetchDaemonStatus;