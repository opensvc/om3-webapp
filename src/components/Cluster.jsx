import logger from '../utils/logger.js';
import React, {useEffect, useState, useRef, useMemo, useCallback, memo} from "react";
import {useNavigate} from "react-router-dom";
import {Box, Typography} from "@mui/material";
import axios from "axios";
import {
    GridNodes,
    GridObjects,
    GridNamespaces,
    GridHeartbeats,
    GridPools,
    GridNetworks
} from "./ClusterStatGrids.jsx";
import {URL_POOL, URL_NETWORK} from "../config/apiPath.js";
import {startEventReception, DEFAULT_FILTERS} from "../eventSourceManager";
import EventLogger from "../components/EventLogger";
import {useNodeStats, useObjectStats, useHeartbeatStats} from "../hooks/useClusterData";

const CLUSTER_EVENT_TYPES = [
    "NodeStatusUpdated",
    "NodeMonitorUpdated",
    "NodeStatsUpdated",
    "DaemonHeartbeatUpdated",
    "ObjectStatusUpdated",
    "InstanceStatusUpdated",
    "ObjectDeleted",
    "InstanceMonitorUpdated",
    "CONNECTION_OPENED",
    "CONNECTION_ERROR",
    "RECONNECTION_ATTEMPT",
    "MAX_RECONNECTIONS_REACHED",
    "CONNECTION_CLOSED"
];

const ClusterOverview = () => {
    const navigate = useNavigate();
    const isMounted = useRef(true);

    const nodeStats = useNodeStats();
    const objectStats = useObjectStats();
    const heartbeatStats = useHeartbeatStats();

    const [poolCount, setPoolCount] = useState(0);
    const [networks, setNetworks] = useState([]);

    const handleNavigate = useCallback((path) => () => navigate(path), [navigate]);
    const handleObjectsClick = useCallback((globalState) => {
        navigate(globalState ? `/objects?globalState=${globalState}` : '/objects');
    }, [navigate]);
    const handleHeartbeatsClick = useCallback((status, state) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (state) params.append('state', state);
        navigate(`/heartbeats${params.toString() ? `?${params.toString()}` : ''}`);
    }, [navigate]);

    useEffect(() => {
        isMounted.current = true;
        const token = localStorage.getItem("authToken");

        if (token) {
            startEventReception(token, DEFAULT_FILTERS);

            const fetchData = async () => {
                try {
                    const [poolsRes, networksRes] = await Promise.all([
                        axios.get(URL_POOL, {
                            headers: {Authorization: `Bearer ${token}`},
                            timeout: 5000
                        }),
                        axios.get(URL_NETWORK, {
                            headers: {Authorization: `Bearer ${token}`},
                            timeout: 5000
                        })
                    ]);

                    if (!isMounted.current) return;

                    const poolItems = poolsRes.data?.items || [];
                    const networkItems = networksRes.data?.items || [];

                    setPoolCount(poolItems.length);
                    setNetworks(networkItems);
                } catch (error) {
                    if (!isMounted.current) return;
                    logger.error('Failed to fetch cluster data:', error.message);
                    setPoolCount(0);
                    setNetworks([]);
                }
            };

            fetchData();
        }

        return () => {
            isMounted.current = false;
        };
    }, []);

    const gridNodesProps = useMemo(() => ({
        nodeCount: nodeStats.count,
        frozenCount: nodeStats.frozen,
        unfrozenCount: nodeStats.unfrozen,
        onClick: handleNavigate("/nodes")
    }), [nodeStats.count, nodeStats.frozen, nodeStats.unfrozen, handleNavigate]);

    const gridObjectsProps = useMemo(() => ({
        objectCount: objectStats.objectCount,
        statusCount: objectStats.statusCount,
        onClick: handleObjectsClick
    }), [objectStats.objectCount, objectStats.statusCount, handleObjectsClick]);

    const gridHeartbeatsProps = useMemo(() => ({
        heartbeatCount: heartbeatStats.count,
        beatingCount: heartbeatStats.beating,
        nonBeatingCount: heartbeatStats.stale,
        stateCount: heartbeatStats.stateCount,
        nodeCount: nodeStats.count,
        onClick: handleHeartbeatsClick
    }), [heartbeatStats.count, heartbeatStats.beating, heartbeatStats.stale, heartbeatStats.stateCount, nodeStats.count, handleHeartbeatsClick]);

    const gridNamespacesProps = useMemo(() => ({
        namespaceCount: objectStats.namespaceCount,
        namespaceSubtitle: objectStats.namespaceSubtitle,
        onClick: (url) => navigate(url || "/namespaces")
    }), [objectStats.namespaceCount, objectStats.namespaceSubtitle, navigate]);

    const gridPoolsProps = useMemo(() => ({
        poolCount,
        onClick: handleNavigate("/storage-pools")
    }), [poolCount, handleNavigate]);

    const gridNetworksProps = useMemo(() => ({
        networks,
        onClick: handleNavigate("/network")
    }), [networks, handleNavigate]);

    return (
        <Box sx={{
            p: 0,
            width: '100vw',
            margin: 0,
            minHeight: '100vh',
            bgcolor: 'background.default',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start'
        }}>
            <Box sx={{
                width: "100%",
                bgcolor: "background.paper",
                border: "2px solid",
                borderColor: "divider",
                borderRadius: 0,
                boxShadow: 3,
                p: 3,
                m: 0,
            }}>
                <Typography variant="h4" gutterBottom sx={{mb: 4}}>
                    Cluster Overview
                </Typography>

                <Box sx={{
                    display: 'flex',
                    flexDirection: {xs: 'column', md: 'row'},
                    gap: 3,
                    alignItems: 'stretch'
                }}>
                    <Box sx={{
                        flex: 2,
                        display: 'grid',
                        gridTemplateColumns: {md: '1fr 1fr'},
                        gap: 3,
                        minHeight: '100%'
                    }}>
                        <Box>
                            <GridNodes {...gridNodesProps} />
                        </Box>
                        <Box>
                            <GridObjects {...gridObjectsProps} />
                        </Box>
                        <Box>
                            <GridHeartbeats {...gridHeartbeatsProps} />
                        </Box>
                        <Box>
                            <GridPools {...gridPoolsProps} />
                        </Box>
                        <Box>
                            <GridNetworks {...gridNetworksProps} />
                        </Box>
                    </Box>

                    <Box sx={{flex: 1}}>
                        <GridNamespaces {...gridNamespacesProps} />
                    </Box>
                </Box>

                <EventLogger
                    eventTypes={CLUSTER_EVENT_TYPES}
                    title="Cluster Events Logger"
                    buttonLabel="Cluster Events"
                />
            </Box>
        </Box>
    );
};

export default memo(ClusterOverview);
