import logger from '../utils/logger.js';
import React, {useEffect, useState, useRef, useMemo, useCallback, memo} from "react";
import {useNavigate} from "react-router-dom";
import {Box, Typography} from "@mui/material";
import axios from "axios";
import useEventStore from "../hooks/useEventStore.js";
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

const MemoizedGridNodes = memo(GridNodes);
const MemoizedGridObjects = memo(GridObjects);
const MemoizedGridNamespaces = memo(GridNamespaces);
const MemoizedGridHeartbeats = memo(GridHeartbeats);
const MemoizedGridPools = memo(GridPools);
const MemoizedGridNetworks = memo(GridNetworks);

const ClusterOverview = () => {
    const navigate = useNavigate();

    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const objectStatus = useEventStore((state) => state.objectStatus);
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);

    const [poolCount, setPoolCount] = useState(0);
    const [networks, setNetworks] = useState([]);
    const isMounted = useRef(true);

    const handleNavigate = useCallback((path) => () => navigate(path), [navigate]);

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

    const nodeStats = useMemo(() => {
        const nodes = Object.values(nodeStatus);
        if (nodes.length === 0) {
            return {count: 0, frozen: 0, unfrozen: 0};
        }

        let frozen = 0;
        let unfrozen = 0;

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const isFrozen = node?.frozen_at && node?.frozen_at !== "0001-01-01T00:00:00Z";
            if (isFrozen) frozen++;
            else unfrozen++;
        }

        return {count: nodes.length, frozen, unfrozen};
    }, [nodeStatus]);

    const objectStats = useMemo(() => {
        const objectEntries = Object.entries(objectStatus);
        if (objectEntries.length === 0) {
            return {
                objectCount: 0,
                namespaceCount: 0,
                statusCount: {up: 0, down: 0, warn: 0, "n/a": 0, unprovisioned: 0},
                namespaceSubtitle: []
            };
        }

        const namespaces = new Set();
        const statusCount = {up: 0, down: 0, warn: 0, "n/a": 0, unprovisioned: 0};
        const objectsPerNamespace = {};
        const statusPerNamespace = {};

        const extractNamespace = (objectPath) => {
            const firstSlash = objectPath.indexOf('/');
            if (firstSlash === -1) return "root";

            const secondSlash = objectPath.indexOf('/', firstSlash + 1);
            if (secondSlash === -1) return "root";

            return objectPath.slice(0, firstSlash);
        };

        for (let i = 0; i < objectEntries.length; i++) {
            const [objectPath, status] = objectEntries[i];
            const ns = extractNamespace(objectPath);

            namespaces.add(ns);
            objectsPerNamespace[ns] = (objectsPerNamespace[ns] || 0) + 1;

            if (!statusPerNamespace[ns]) {
                statusPerNamespace[ns] = {up: 0, down: 0, warn: 0, "n/a": 0, unprovisioned: 0};
            }

            const s = status?.avail?.toLowerCase() || "n/a";
            if (s === "up" || s === "down" || s === "warn" || s === "n/a") {
                statusPerNamespace[ns][s]++;
                statusCount[s]++;
            } else {
                statusPerNamespace[ns]["n/a"]++;
                statusCount["n/a"]++;
            }

            // Count unprovisioned objects
            const provisioned = status?.provisioned;
            if (provisioned === "false" || provisioned === false) {
                statusPerNamespace[ns].unprovisioned++;
                statusCount.unprovisioned++;
            }
        }

        const namespaceSubtitle = [];
        for (const ns in objectsPerNamespace) {
            namespaceSubtitle.push({
                namespace: ns,
                count: objectsPerNamespace[ns],
                status: statusPerNamespace[ns]
            });
        }

        namespaceSubtitle.sort((a, b) => a.namespace.localeCompare(b.namespace));

        return {
            objectCount: objectEntries.length,
            namespaceCount: namespaces.size,
            statusCount,
            namespaceSubtitle
        };
    }, [objectStatus]);

    const heartbeatStats = useMemo(() => {
        const heartbeatValues = Object.values(heartbeatStatus);
        if (heartbeatValues.length === 0) {
            return {
                count: 0,
                beating: 0,
                stale: 0,
                stateCount: {running: 0, stopped: 0, failed: 0, warning: 0, unknown: 0}
            };
        }

        const heartbeatIds = new Set();
        let beating = 0;
        let stale = 0;
        const stateCount = {running: 0, stopped: 0, failed: 0, warning: 0, unknown: 0};

        for (let i = 0; i < heartbeatValues.length; i++) {
            const node = heartbeatValues[i];
            const streams = node.streams || [];

            for (let j = 0; j < streams.length; j++) {
                const stream = streams[j];
                const baseId = stream.id?.split('.')[0];
                if (baseId) heartbeatIds.add(baseId);

                const peer = Object.values(stream.peers || {})[0];
                if (peer?.is_beating) {
                    beating++;
                } else {
                    stale++;
                }

                const state = stream.state || 'unknown';
                if (stateCount.hasOwnProperty(state)) {
                    stateCount[state]++;
                } else {
                    stateCount.unknown++;
                }
            }
        }

        return {
            count: heartbeatIds.size,
            beating,
            stale,
            stateCount
        };
    }, [heartbeatStatus]);

    const handleObjectsClick = useCallback((globalState) => {
        navigate(globalState ? `/objects?globalState=${globalState}` : '/objects');
    }, [navigate]);

    const handleHeartbeatsClick = useCallback((status, state) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (state) params.append('state', state);
        navigate(`/heartbeats${params.toString() ? `?${params.toString()}` : ''}`);
    }, [navigate]);

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
                    {/* Left side - 2x3 grid */}
                    <Box sx={{
                        flex: 2,
                        display: 'grid',
                        gridTemplateColumns: {md: '1fr 1fr'},
                        gap: 3,
                        minHeight: '100%'
                    }}>
                        <Box>
                            <MemoizedGridNodes
                                nodeCount={nodeStats.count}
                                frozenCount={nodeStats.frozen}
                                unfrozenCount={nodeStats.unfrozen}
                                onClick={handleNavigate("/nodes")}
                            />
                        </Box>
                        <Box>
                            <MemoizedGridObjects
                                objectCount={objectStats.objectCount}
                                statusCount={objectStats.statusCount}
                                onClick={handleObjectsClick}
                            />
                        </Box>
                        <Box>
                            <MemoizedGridHeartbeats
                                heartbeatCount={heartbeatStats.count}
                                beatingCount={heartbeatStats.beating}
                                nonBeatingCount={heartbeatStats.stale}
                                stateCount={heartbeatStats.stateCount}
                                nodeCount={nodeStats.count}
                                onClick={handleHeartbeatsClick}
                            />
                        </Box>
                        <Box>
                            <MemoizedGridPools
                                poolCount={poolCount}
                                onClick={handleNavigate("/storage-pools")}
                            />
                        </Box>
                        <Box>
                            <MemoizedGridNetworks
                                networks={networks}
                                onClick={handleNavigate("/network")}
                            />
                        </Box>
                    </Box>

                    {/* Right side - Namespaces */}
                    <Box sx={{flex: 1}}>
                        <MemoizedGridNamespaces
                            namespaceCount={objectStats.namespaceCount}
                            namespaceSubtitle={objectStats.namespaceSubtitle}
                            onClick={(url) => navigate(url || "/namespaces")}
                        />
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
