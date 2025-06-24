import React, {useEffect, useState, useMemo} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {
    Box,
    Paper,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableContainer,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Collapse,
    Tooltip,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import HelpIcon from "@mui/icons-material/Help";
import {green, yellow, red, grey} from "@mui/material/colors";

import useEventStore from "../hooks/useEventStore.js";
import {closeEventSource, startEventReception} from "../eventSourceManager.jsx";

const getStateIcon = (state) => {
    switch (state) {
        case "running":
            return <CheckCircleIcon sx={{color: green[500]}}/>;
        case "stopped":
            return <PauseCircleIcon sx={{color: yellow[700]}}/>;
        case "failed":
            return <ErrorIcon sx={{color: red[500]}}/>;
        case "warning":
            return <WarningIcon sx={{color: yellow[800]}}/>;
        default:
            return <HelpIcon sx={{color: grey[500]}}/>;
    }
};

// Modified getStatusIcon to handle single-node clusters
const getStatusIcon = (isBeating, isSingleNode) => {
    if (isSingleNode) {
        return <CheckCircleIcon sx={{color: green[500]}}/>;
    }
    // Otherwise, use the existing logic
    return isBeating ? (
        <CheckCircleIcon sx={{color: green[500]}}/>
    ) : (
        <CancelIcon sx={{color: red[500]}}/>
    );
};

const tableCellStyle = {
    padding: "8px 16px",
    textAlign: "center",
    verticalAlign: "middle",
};

const leftAlignedCellStyle = {
    ...tableCellStyle,
    textAlign: "left",
};

const Heartbeats = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const [stoppedStreamsCache, setStoppedStreamsCache] = useState({});

    // Read query parameters
    const queryParams = new URLSearchParams(location.search);
    const rawStatus = queryParams.get("status") || "all";
    const rawNode = queryParams.get("node") || "all";
    const rawState = queryParams.get("state") || "all";
    const rawId = queryParams.get("id") || "all";

    const [filterBeating, setFilterBeating] = useState(
        ["all", "beating", "stale"].includes(rawStatus) ? rawStatus : "all"
    );
    const [filterNode, setFilterNode] = useState(rawNode);
    const [filterState, setFilterState] = useState(rawState);
    // Remove "hb#" prefix from rawId if present
    const [filterId, setFilterId] = useState(
        rawId.startsWith("hb#") ? rawId.replace(/^hb#/, "") : rawId
    );
    const [showFilters, setShowFilters] = useState(true);

    // Update URL when filters change
    useEffect(() => {
        const newQueryParams = new URLSearchParams();
        if (filterBeating !== "all") newQueryParams.set("status", filterBeating);
        if (filterNode !== "all") newQueryParams.set("node", filterNode);
        if (filterState !== "all") newQueryParams.set("state", filterState);
        if (filterId !== "all") newQueryParams.set("id", filterId);

        navigate(`${location.pathname}${newQueryParams.toString() ? `?${newQueryParams.toString()}` : ""}`, {
            replace: true,
        });
    }, [filterBeating, filterNode, filterState, filterId, navigate, location.pathname]);

    // Initialize filter states from URL
    useEffect(() => {
        setFilterBeating(["all", "beating", "stale"].includes(rawStatus) ? rawStatus : "all");
        setFilterNode(rawNode);
        setFilterState(rawState);
        setFilterId(rawId.startsWith("hb#") ? rawId.replace(/^hb#/, "") : rawId);
    }, [location.search, rawStatus, rawNode, rawState, rawId]);

    // Cache stopped streams with their last known peers
    useEffect(() => {
        setStoppedStreamsCache((prev) => {
            const newCache = {...prev};
            Object.entries(heartbeatStatus).forEach(([node, nodeData]) => {
                (nodeData.streams || []).forEach((stream) => {
                    if (!newCache[node]) newCache[node] = {};
                    if (Object.keys(stream.peers || {}).length > 0 || stream.state === "stopped") {
                        newCache[node][stream.id] = {
                            ...stream,
                            peers: {...stream.peers},
                        };
                    }
                });
            });
            return newCache;
        });
    }, [heartbeatStatus]);

    // Start event reception with only DaemonHeartbeatUpdated filter
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            startEventReception(token, ['DaemonHeartbeatUpdated']);
        }
        return () => closeEventSource();
    }, []);

    const nodes = [...new Set(Object.keys(heartbeatStatus))].sort();
    const isSingleNode = nodes.length === 1;

    const availableStates = useMemo(() => {
        const states = new Set(["all"]);
        Object.values(heartbeatStatus).forEach((nodeData) => {
            (nodeData.streams || []).forEach((stream) => {
                if (stream.state) states.add(stream.state);
            });
        });
        return Array.from(states).sort();
    }, [heartbeatStatus]);

    const availableIds = useMemo(() => {
        const ids = new Set();
        Object.values(heartbeatStatus).forEach((nodeData) => {
            (nodeData.streams || []).forEach((stream) => {
                if (stream.id && stream.id !== "all") {
                    // Remove "hb#" prefix from ID
                    const cleanedId = stream.id.replace(/^hb#/, "");
                    ids.add(cleanedId);
                }
            });
        });
        return Array.from(ids).sort();
    }, [heartbeatStatus]);

    const streamRows = [];
    Object.entries(heartbeatStatus).forEach(([node, nodeData]) => {
        (nodeData.streams || []).forEach((stream) => {
            const cachedStream = stoppedStreamsCache[node]?.[stream.id] || {};
            const peers = stream.state === "stopped" && Object.keys(stream.peers || {}).length === 0
                ? cachedStream.peers || {}
                : stream.peers || {};

            // Remove "hb#" prefix from stream ID
            const cleanedId = stream.id.replace(/^hb#/, "");

            if (Object.keys(peers).length === 0 && stream.state === "stopped") {
                streamRows.push({
                    id: cleanedId,
                    node: node,
                    peer: "N/A",
                    type: stream.type || cachedStream.type || "N/A",
                    desc: cachedStream.peers?.[Object.keys(cachedStream.peers || {})[0]]?.desc || "N/A",
                    isBeating: false,
                    lastAt: cachedStream.peers?.[Object.keys(cachedStream.peers || {})[0]]?.last_at || "N/A",
                    state: stream.state || "unknown",
                });
            } else {
                Object.entries(peers).forEach(([peerKey, peerData]) => {
                    streamRows.push({
                        id: cleanedId,
                        node,
                        peer: peerKey || "N/A",
                        type: stream.type || "N/A",
                        desc: peerData?.desc || "N/A",
                        isBeating: peerData?.is_beating || false,
                        lastAt: peerData?.last_at || "N/A",
                        state: stream.state || "unknown",
                    });
                });
            }
        });
    });

    // Sort streamRows by node, then id, then peer
    streamRows.sort((a, b) => {
        const nodeCompare = a.node.localeCompare(b.node, undefined, {sensitivity: "base"});
        if (nodeCompare !== 0) return nodeCompare;
        const idCompare = a.id.localeCompare(b.id, undefined, {sensitivity: "base"});
        if (idCompare !== 0) return idCompare;
        return a.peer.localeCompare(b.peer, undefined, {sensitivity: "base"});
    });

    const filteredRows = streamRows.filter((row) => {
        return (
            (filterBeating === "all" ||
                (filterBeating === "beating" && row.isBeating === true) ||
                (filterBeating === "stale" && row.isBeating === false)) &&
            (filterNode === "all" || row.node === filterNode) &&
            (filterState === "all" || row.state === filterState) &&
            (filterId === "all" || row.id === filterId)
        );
    });

    return (
        <Box sx={{p: 4}}>
            <Paper elevation={3} sx={{p: 3, borderRadius: 2}}>
                <Typography variant="h4" gutterBottom align="center">
                    Heartbeats
                </Typography>

                {/* Sticky Filters */}
                <Box
                    sx={{
                        position: "sticky",
                        top: 64,
                        zIndex: 20,
                        backgroundColor: "background.paper",
                        pb: 2,
                        mb: 2,
                    }}
                >
                    <Box sx={{display: "flex", justifyContent: "space-between", mb: 1}}>
                        <Button
                            onClick={() => setShowFilters(!showFilters)}
                            startIcon={showFilters ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                        >
                            {showFilters ? "Hide filters" : "Show filters"}
                        </Button>
                    </Box>

                    <Collapse in={showFilters}>
                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 2,
                                alignItems: "center",
                                mb: 2,
                            }}
                        >
                            <FormControl sx={{minWidth: 200}}>
                                <InputLabel>Filter by Running</InputLabel>
                                <Select
                                    id="state-filter-select"
                                    value={filterState}
                                    label="Filter by Running"
                                    onChange={(e) => setFilterState(e.target.value)}
                                    MenuProps={{
                                        PaperProps: {
                                            style: {
                                                maxHeight: 300,
                                            },
                                        },
                                    }}
                                >
                                    <MenuItem value="all" key="all-state">
                                        All
                                    </MenuItem>
                                    {availableStates
                                        .filter(state => state !== "all")
                                        .map((state) => (
                                            <MenuItem key={`state-${state}`} value={state}>
                                                {state.charAt(0).toUpperCase() + state.slice(1)}
                                            </MenuItem>
                                        ))}
                                </Select>
                            </FormControl>

                            <FormControl sx={{minWidth: 200}}>
                                <InputLabel>Filter by Beating</InputLabel>
                                <Select
                                    value={filterBeating}
                                    label="Filter by Beating"
                                    onChange={(e) => setFilterBeating(e.target.value)}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="beating">Beating</MenuItem>
                                    <MenuItem value="stale">Stale</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControl sx={{minWidth: 200}}>
                                <InputLabel>Filter by Node</InputLabel>
                                <Select
                                    value={filterNode}
                                    label="Filter by Node"
                                    onChange={(e) => setFilterNode(e.target.value)}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    {nodes.map((node) => (
                                        <MenuItem key={node} value={node}>
                                            {node}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl sx={{minWidth: 200}}>
                                <InputLabel>Filter by ID</InputLabel>
                                <Select
                                    value={filterId}
                                    label="Filter by ID"
                                    onChange={(e) => setFilterId(e.target.value)}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    {availableIds.map((id) => (
                                        <MenuItem key={id} value={id}>
                                            {id}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    </Collapse>
                </Box>

                {/* Table with Sticky Headers */}
                <TableContainer sx={{maxHeight: "60vh", overflow: "auto", boxShadow: "none", border: "none"}}>
                    <Table size="small">
                        <TableHead sx={{position: "sticky", top: 0, zIndex: 1, backgroundColor: "background.paper"}}>
                            <TableRow>
                                {[
                                    "RUNNING",
                                    "BEATING",
                                    "ID",
                                    "NODE",
                                    "PEER",
                                    "TYPE",
                                    "DESC",
                                    "LAST_AT",
                                ].map((label) => (
                                    <TableCell
                                        key={label}
                                        sx={{
                                            fontWeight: "bold",
                                            textAlign: ["ID", "NODE", "PEER", "TYPE", "DESC", "LAST_AT"].includes(label)
                                                ? "left"
                                                : "center",
                                            borderBottom: "2px solid #ccc",
                                        }}
                                    >
                                        {label}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredRows.map((row) => (
                                <TableRow key={`${row.node}-${row.id}-${row.peer}`} hover>
                                    <TableCell sx={tableCellStyle}>
                                        <Tooltip title={row.state} arrow>
                                            <span>{getStateIcon(row.state)}</span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell sx={tableCellStyle}>
                                        <Tooltip
                                            title={isSingleNode ? "Healthy (Single Node)" : row.isBeating ? "Beating" : "Stale"}
                                            arrow
                                        >
                                            <span>{getStatusIcon(row.isBeating, isSingleNode)}</span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell sx={leftAlignedCellStyle}>{row.id}</TableCell>
                                    <TableCell sx={leftAlignedCellStyle}>{row.node}</TableCell>
                                    <TableCell sx={leftAlignedCellStyle}>{row.peer}</TableCell>
                                    <TableCell sx={leftAlignedCellStyle}>{row.type}</TableCell>
                                    <TableCell sx={leftAlignedCellStyle}>{row.desc}</TableCell>
                                    <TableCell sx={leftAlignedCellStyle}>{row.lastAt}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default Heartbeats;
