/* eslint-disable no-unused-vars */

import {useState, useRef} from "react";
import {createEventSource, closeEventSource} from "../eventSourceManager";
import {fetchDaemonStatus} from "../services/api";
import {URL_NODE_EVENT} from "../config/apiPath.js";

const useFetchDaemonStatus = () => {
    const [nodes, setNodes] = useState([]);
    const [daemon, setDaemon] = useState({});
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const eventSourceRef = useRef(null);
    const cacheRef = useRef([]);
    const [clusterStats, setClusterStats] = useState({});
    const [clusterName, setClusterName] = useState("");

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
            setClusterName(result.cluster.config.name || "Cluster");
            cacheRef.current = nodesArray;
        } catch (err) {
            console.error("Error while fetching daemon statuses:", err);
            setError("Failed to retrieve daemon statuses.");
        } finally {
            setLoading(false);
        }
    };


    return {
        daemon,
        nodes,
        clusterStats,
        clusterName,
        error,
        loading,
        fetchNodes: refreshDaemonStatus,
    };
};

export default useFetchDaemonStatus;
