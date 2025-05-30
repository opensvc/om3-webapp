import React, {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {Box, Grid2, Typography} from "@mui/material";
import axios from "axios";

import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import {
    GridNodes,
    GridObjects,
    GridNamespaces,
    GridHeartbeats,
    GridPools
} from "./ClusterStatGrids.jsx";
import {URL_POOL} from "../config/apiPath.js";

const ClusterOverview = () => {
    const navigate = useNavigate();
    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const objectStatus = useEventStore((state) => state.objectStatus);
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const {fetchNodes, startEventReception} = useFetchDaemonStatus();

    const [poolCount, setPoolCount] = useState(0);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            startEventReception(token);

            axios.get(URL_POOL, {
                headers: {Authorization: `Bearer ${token}`}
            })
                .then((res) => {
                    const items = res.data?.items || [];
                    setPoolCount(items.length);
                })
                .catch((error) => {
                    console.error('Failed to fetch pools:', error.message);
                    setPoolCount(0);
                });
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
    const statusCount = {up: 0, down: 0, warn: 0, unknown: 0};
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

    const namespaceSubtitle = Object.entries(objectsPerNamespace)
        .map(([ns, count]) => `${ns}: ${count}`)
        .join(" | ");

    const heartbeatIds = new Set();
    Object.values(heartbeatStatus).forEach(node => {
        (node.streams || []).forEach(stream => {
            const baseId = stream.id.split('.')[0];
            heartbeatIds.add(baseId);
        });
    });
    const heartbeatCount = heartbeatIds.size;

    return (
        <Box sx={{p: 3}}>
            <Typography variant="h4" gutterBottom sx={{mb: 4}}>
                Cluster Overview
            </Typography>

            <Grid2 container spacing={3}>
                <GridNodes
                    nodeCount={nodeCount}
                    frozenCount={frozenCount}
                    unfrozenCount={unfrozenCount}
                    onClick={() => navigate("/nodes")}
                />
                <GridObjects
                    objectCount={Object.keys(objectStatus).length}
                    statusCount={statusCount}
                    onClick={(globalState) => {
                        const url = globalState ? `/objects?globalState=${globalState}` : '/objects';
                        console.log('[ClusterOverview] Navigating to:', url);
                        navigate(url);
                    }}
                />
                <GridNamespaces
                    namespaceCount={namespaceCount}
                    namespaceSubtitle={namespaceSubtitle}
                    onClick={() => navigate("/namespaces")}
                />
                <GridHeartbeats
                    heartbeatCount={heartbeatCount}
                    onClick={() => navigate("/heartbeats")}
                />
                <GridPools
                    poolCount={poolCount}
                    onClick={() => navigate("/storage-pools")}
                />
            </Grid2>
        </Box>
    );
};

export default ClusterOverview;