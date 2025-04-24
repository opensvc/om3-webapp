import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {Box, Grid2, Typography} from "@mui/material";
import axios from "axios";

import useEventStore from "../store/useEventStore";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import {StatCard} from "./StatCard.jsx";

const ClusterOverview = () => {
    const navigate = useNavigate();
    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const objectStatus = useEventStore((state) => state.objectStatus);
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const { fetchNodes, startEventReception } = useFetchDaemonStatus();

    const [poolCount, setPoolCount] = useState(0);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            startEventReception(token);

            axios.get("/pool", {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then((res) => {
                    const items = res.data?.items || [];
                    setPoolCount(items.length);
                })
        }
    }, []);

    const nodeCount = Object.keys(nodeStatus).length;

    let frozenCount = 0;
    let unfrozenCount = 0;

    Object.values(nodeStatus).forEach((node) => {
        const isFrozen = node?.frozen_at && node?.frozen_at !== "0001-01-01T00:00:00Z";
        if (isFrozen) frozenCount++;
        else unfrozenCount++;
    });

    const namespaces = new Set();
    const statusCount = { up: 0, down: 0, warn: 0, unknown: 0 };
    const objectsPerNamespace = {};

    const extractNamespace = (objectPath) => {
        const parts = objectPath.split("/");
        return parts.length === 3 ? parts[0] : "root";
    };

    Object.entries(objectStatus).forEach(([objectPath, status]) => {
        const ns = extractNamespace(objectPath);
        namespaces.add(ns);
        objectsPerNamespace[ns] = (objectsPerNamespace[ns] || 0) + 1;

        const s = status?.avail?.toLowerCase();
        if (s === "up" || s === "down" || s === "warn") statusCount[s]++;
        else statusCount.unknown++;
    });

    const namespaceCount = namespaces.size;
    const objectCount = Object.keys(objectStatus).length;

    const namespaceSubtitle = Object.entries(objectsPerNamespace)
        .map(([ns, count]) => `${ns}: ${count}`)
        .join(" | ");

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                Cluster Overview
            </Typography>

            <Grid2 container spacing={3}>
                <Grid2 item xs={12} md={4}>
                    <StatCard
                        title="Nodes"
                        value={nodeCount}
                        subtitle={`Frozen: ${frozenCount} | Unfrozen: ${unfrozenCount}`}
                        onClick={() => navigate("/nodes")}
                    />
                </Grid2>
                <Grid2 item xs={12} md={4}>
                    <StatCard
                        title="Objects"
                        value={objectCount}
                        subtitle={`🟢 ${statusCount.up} | 🟡 ${statusCount.warn} | 🔴 ${statusCount.down}`}
                        onClick={() => navigate("/objects")}
                    />
                </Grid2>
                <Grid2 item xs={12} md={4}>
                    <StatCard
                        title="Namespaces"
                        value={namespaceCount}
                        subtitle={namespaceSubtitle}
                        onClick={() => navigate("/namespaces")}
                    />
                </Grid2>
                <Grid2 item xs={12} md={4}>
                    <StatCard
                        title="Heartbeats"
                        value={Object.keys(heartbeatStatus).length}
                        onClick={() => navigate("/heartbeats")}
                    />
                </Grid2>
                <Grid2 item xs={12} md={4}>
                    <StatCard
                        title="Pools"
                        value={poolCount}
                        onClick={() => navigate("/pools")}
                    />
                </Grid2>
            </Grid2>
        </Box>
    );
};

export default ClusterOverview;