import { useEffect, useState } from "react";
import useFetchNodes from "../hooks/useFetchNodes";
import { createEventSource } from "../eventSourceManager";
import { FaSnowflake, FaWifi } from "react-icons/fa"; // Import des icônes

const NodesTable = () => {
    const { nodes, fetchNodes } = useFetchNodes();
    const [token, setToken] = useState("");
    const [eventNodes, setEventNodes] = useState([]);
    const [daemonNode, setDaemonNode] = useState(null); // Stocke daemon.nodename

    useEffect(() => {
        const storedToken = localStorage.getItem("authToken");
        if (storedToken) {
            setToken(storedToken);
            fetchNodes(storedToken);
            createEventSource("/sse", storedToken, setEventNodes);
        }
    }, []);

    useEffect(() => {
        if (nodes.length > 0) {
            // Trouver daemon.nodename dans la réponse API
            const daemonData = nodes.find((node) => node.daemon?.nodename);
            if (daemonData) {
                setDaemonNode(daemonData.daemon.nodename);
            }
        }
    }, [nodes]);

    // Fusionner les données statiques avec les données reçues via SSE
    const mergedNodes = nodes.map((node) => {
        const updatedNode = eventNodes.find((n) => n.node === node.nodename);
        return updatedNode
            ? {
                ...node,
                status: {
                    ...node.status,
                    frozen_at: updatedNode.node_status?.frozen_at,
                },
            }
            : node;
    });

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Node Status</h2>
            {mergedNodes.length === 0 ? (
                <div>Loading...</div>
            ) : (
                <table className="w-full border-collapse border border-gray-300">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">Name</th>
                        <th className="border p-2">State</th>
                        <th className="border p-2">Score</th>
                        <th className="border p-2">Load (15m)</th>
                        <th className="border p-2">Mem Avail</th>
                        <th className="border p-2">Swap Avail</th>
                        <th className="border p-2">Version</th>
                    </tr>
                    </thead>
                    <tbody>
                    {mergedNodes.map((node, index) => (
                        <tr key={index} className="text-center border">
                            <td className="border p-2">{node.nodename || "-"}</td>
                            <td className="border p-2">
                                {daemonNode === node.nodename && (
                                    <FaWifi className="inline ml-2 text-green-500" size={20} />
                                )}

                                {node.status?.frozen_at && node.status.frozen_at !== "0001-01-01T00:00:00Z" && (
                                    <FaSnowflake className="inline ml-2" style={{ color: "#66ccff" }} size={20} />
                                )}
                            </td>

                            <td className="border p-2">{node.stats?.score || "N/A"}</td>
                            <td className="border p-2">{node.stats?.load_15m || "N/A"}</td>
                            <td className="border p-2">{node.stats?.mem_avail || "N/A"}%</td>
                            <td className="border p-2">{node.stats?.swap_avail || "N/A"}%</td>
                            <td className="border p-2">{node.status?.agent || "N/A"}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default NodesTable;
