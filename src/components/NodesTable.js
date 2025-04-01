/* eslint-disable no-unused-vars */

import { useEffect, useState } from "react";
import useFetchNodes from "../hooks/useFetchNodes";

const NodesTable = () => {
    const { nodes, fetchNodes, startEventReception } = useFetchNodes();
    const [token, setToken] = useState("");

    useEffect(() => {
        const storedToken = localStorage.getItem("authToken");
        if (storedToken) {
            setToken(storedToken);
            fetchNodes(storedToken);
            startEventReception(storedToken);
        }
    }, []);

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">État des Nœuds</h2>
            {nodes.length === 0 ? (
                <div>Chargement...</div>
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
                    {nodes.map((node, index) => (
                        <tr key={index} className="text-center border">
                            <td className="border p-2">{node.nodename || "-"}</td>
                            <td className="border p-2">{node.status?.state || "N/A"}</td>
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
