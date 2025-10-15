import {useState, useRef, useCallback} from "react";
import {fetchDaemonStatus} from "../services/api";

const useFetchDaemonStatus = () => {
    const [nodes, setNodes] = useState([]);
    const [daemon, setDaemon] = useState({});
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const cacheRef = useRef([]);
    const [clusterStats, setClusterStats] = useState({});
    const [clusterName, setClusterName] = useState("");

    // Memoize refreshDaemonStatus with useCallback
    const refreshDaemonStatus = useCallback(async (token) => {
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
    }, []);

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
