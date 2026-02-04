import React, {useEffect, useState, useMemo, useCallback, useRef, useDeferredValue} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {
    Box,
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
    Tooltip,
    IconButton,
    CircularProgress,
    Typography,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import HelpIcon from "@mui/icons-material/Help";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {green, yellow, red, grey} from "@mui/material/colors";

import useEventStore from "../hooks/useEventStore.js";
import {closeEventSource, startEventReception} from "../eventSourceManager.jsx";
import EventLogger from "../components/EventLogger";

const StateIcon = React.memo(({state}) => {
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
}, (prev, next) => prev.state === next.state);

const BeatingIcon = React.memo(({isBeating, isSingleNode}) => {
    if (isSingleNode) {
        return <CheckCircleIcon sx={{color: green[500]}}/>;
    }
    return isBeating ? (
        <CheckCircleIcon sx={{color: green[500]}}/>
    ) : (
        <CancelIcon sx={{color: red[500]}}/>
    );
}, (prev, next) => prev.isBeating === next.isBeating && prev.isSingleNode === next.isSingleNode);

const tableCellStyle = {
    padding: "8px 16px",
    textAlign: "center",
    verticalAlign: "middle",
};

const leftAlignedCellStyle = {
    ...tableCellStyle,
    textAlign: "left",
};

const HeartbeatRow = React.memo(({row, isSingleNode}) => {
    return (
        <TableRow key={`${row.node}-${row.id}-${row.peer}`} hover>
            <TableCell sx={tableCellStyle}>
                <Tooltip title={row.state} arrow>
                    <span><StateIcon state={row.state}/></span>
                </Tooltip>
            </TableCell>
            <TableCell sx={tableCellStyle}>
                <Tooltip
                    title={isSingleNode ? "Healthy (Single Node)" : row.isBeating ? "Beating" : "Stale"}
                    arrow
                >
                    <span><BeatingIcon isBeating={row.isBeating} isSingleNode={isSingleNode}/></span>
                </Tooltip>
            </TableCell>
            <TableCell sx={leftAlignedCellStyle}>{row.id}</TableCell>
            <TableCell sx={leftAlignedCellStyle}>{row.node}</TableCell>
            <TableCell sx={leftAlignedCellStyle}>{row.peer}</TableCell>
            <TableCell sx={leftAlignedCellStyle}>{row.type}</TableCell>
            <TableCell sx={leftAlignedCellStyle}>{row.desc}</TableCell>
            <TableCell sx={leftAlignedCellStyle}>{row.changedAt}</TableCell>
            <TableCell sx={leftAlignedCellStyle}>{row.lastBeatingAt}</TableCell>
        </TableRow>
    );
}, (prev, next) => {
    return (
        prev.row.id === next.row.id &&
        prev.row.node === next.row.node &&
        prev.row.peer === next.row.peer &&
        prev.row.isBeating === next.row.isBeating &&
        prev.row.state === next.row.state &&
        prev.isSingleNode === next.isSingleNode
    );
});

const Heartbeats = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const isMounted = useRef(true);
    const eventStarted = useRef(false);
    const tableContainerRef = useRef(null);

    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const [stoppedStreamsCache, setStoppedStreamsCache] = useState({});
    const [sortColumn, setSortColumn] = useState("node");
    const [sortDirection, setSortDirection] = useState("asc");
    const [showFilters, setShowFilters] = useState(true);
    const [visibleCount, setVisibleCount] = useState(30);
    const [loading, setLoading] = useState(false);

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
    const [filterId, setFilterId] = useState(
        rawId.startsWith("hb#") ? rawId.replace(/^hb#/, "") : rawId
    );

    const deferredFilterBeating = useDeferredValue(filterBeating);
    const deferredFilterNode = useDeferredValue(filterNode);
    const deferredFilterState = useDeferredValue(filterState);
    const deferredFilterId = useDeferredValue(filterId);
    const deferredSortColumn = useDeferredValue(sortColumn);
    const deferredSortDirection = useDeferredValue(sortDirection);

    const heartbeatEventTypes = useMemo(() => [
        "DaemonHeartbeatUpdated",
        "CONNECTION_OPENED",
        "CONNECTION_ERROR",
        "RECONNECTION_ATTEMPT",
        "MAX_RECONNECTIONS_REACHED",
        "CONNECTION_CLOSED"
    ], []);

    // Update URL when filters change
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isMounted.current) return;

            const currentParams = new URLSearchParams(location.search);
            const currentStatus = currentParams.get("status") || "all";
            const currentNode = currentParams.get("node") || "all";
            const currentState = currentParams.get("state") || "all";
            const currentId = currentParams.get("id") || "all";

            if (currentStatus === filterBeating &&
                currentNode === filterNode &&
                currentState === filterState &&
                currentId === filterId) {
                return;
            }

            const newQueryParams = new URLSearchParams();
            if (filterBeating !== "all") newQueryParams.set("status", filterBeating);
            if (filterNode !== "all") newQueryParams.set("node", filterNode);
            if (filterState !== "all") newQueryParams.set("state", filterState);
            if (filterId !== "all") newQueryParams.set("id", filterId);

            const queryString = newQueryParams.toString();
            const newUrl = `${location.pathname}${queryString ? `?${queryString}` : ""}`;

            if (newUrl !== location.pathname + location.search) {
                navigate(newUrl, {replace: true});
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [filterBeating, filterNode, filterState, filterId, navigate, location.pathname, location.search]);

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
            const entries = Object.entries(heartbeatStatus);

            for (let i = 0; i < entries.length; i++) {
                const [node, nodeData] = entries[i];
                const streams = nodeData.streams || [];

                if (!newCache[node]) newCache[node] = {};

                for (let j = 0; j < streams.length; j++) {
                    const stream = streams[j];
                    if (Object.keys(stream.peers || {}).length > 0 || stream.state === "stopped") {
                        newCache[node][stream.id] = {
                            ...stream,
                            peers: {...stream.peers},
                        };
                    }
                }
            }

            return newCache;
        });
    }, [heartbeatStatus]);

    // Start event reception with heartbeat-specific filters
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token && !eventStarted.current) {
            startEventReception(token, heartbeatEventTypes);
            eventStarted.current = true;
        }

        return () => {
            closeEventSource();
            eventStarted.current = false;
        };
    }, [heartbeatEventTypes]);

    const nodes = useMemo(() => {
        return [...new Set(Object.keys(heartbeatStatus))].sort();
    }, [heartbeatStatus]);

    const isSingleNode = nodes.length === 1;

    const availableStates = useMemo(() => {
        const states = new Set(["all"]);
        const values = Object.values(heartbeatStatus);

        for (let i = 0; i < values.length; i++) {
            const streams = values[i].streams || [];
            for (let j = 0; j < streams.length; j++) {
                if (streams[j].state) states.add(streams[j].state);
            }
        }

        return Array.from(states).sort();
    }, [heartbeatStatus]);

    const availableIds = useMemo(() => {
        const ids = new Set();
        const values = Object.values(heartbeatStatus);

        for (let i = 0; i < values.length; i++) {
            const streams = values[i].streams || [];
            for (let j = 0; j < streams.length; j++) {
                const stream = streams[j];
                if (stream.id && stream.id !== "all") {
                    const cleanedId = stream.id.replace(/^hb#/, "");
                    ids.add(cleanedId);
                }
            }
        }

        return Array.from(ids).sort();
    }, [heartbeatStatus]);

    const streamRows = useMemo(() => {
        const rows = [];
        const entries = Object.entries(heartbeatStatus);

        for (let i = 0; i < entries.length; i++) {
            const [node, nodeData] = entries[i];
            const streams = nodeData.streams || [];

            for (let j = 0; j < streams.length; j++) {
                const stream = streams[j];
                const cachedStream = stoppedStreamsCache[node]?.[stream.id] || {};
                const peers = stream.state === "stopped" && Object.keys(stream.peers || {}).length === 0
                    ? cachedStream.peers || {}
                    : stream.peers || {};

                const cleanedId = stream.id.replace(/^hb#/, "");

                if (Object.keys(peers).length === 0 && stream.state === "stopped") {
                    const cachedPeers = cachedStream.peers || {};
                    const firstPeerKey = Object.keys(cachedPeers)[0];
                    const firstPeer = cachedPeers[firstPeerKey];

                    rows.push({
                        id: cleanedId,
                        node: node,
                        peer: "N/A",
                        type: stream.type || cachedStream.type || "N/A",
                        desc: firstPeer?.desc || "N/A",
                        isBeating: false,
                        changedAt: firstPeer?.changed_at || "N/A",
                        lastBeatingAt: firstPeer?.last_beating_at || "N/A",
                        state: stream.state || "unknown",
                    });
                } else {
                    const peerEntries = Object.entries(peers);
                    for (let k = 0; k < peerEntries.length; k++) {
                        const [peerKey, peerData] = peerEntries[k];
                        rows.push({
                            id: cleanedId,
                            node,
                            peer: peerKey || "N/A",
                            type: stream.type || "N/A",
                            desc: peerData?.desc || "N/A",
                            isBeating: peerData?.is_beating || false,
                            changedAt: peerData?.changed_at || "N/A",
                            lastBeatingAt: peerData?.last_beating_at || "N/A",
                            state: stream.state || "unknown",
                        });
                    }
                }
            }
        }

        return rows;
    }, [heartbeatStatus, stoppedStreamsCache]);

    const sortedRows = useMemo(() => {
        const stateOrder = {running: 4, warning: 3, stopped: 2, failed: 1, unknown: 0};

        return [...streamRows].sort((a, b) => {
            let diff = 0;
            if (deferredSortColumn === "state") {
                diff = stateOrder[a.state] - stateOrder[b.state];
            } else if (deferredSortColumn === "beating") {
                diff = Number(a.isBeating) - Number(b.isBeating);
            } else if (deferredSortColumn === "id") {
                diff = a.id.localeCompare(b.id, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "node") {
                diff = a.node.localeCompare(b.node, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "peer") {
                diff = a.peer.localeCompare(b.peer, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "type") {
                diff = a.type.localeCompare(b.type, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "desc") {
                diff = a.desc.localeCompare(b.desc, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "changed_at") {
                diff = a.changedAt.localeCompare(b.changedAt, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "last_beating_at") {
                diff = a.lastBeatingAt.localeCompare(b.lastBeatingAt, undefined, {sensitivity: "base"});
            }
            return deferredSortDirection === "asc" ? diff : -diff;
        });
    }, [streamRows, deferredSortColumn, deferredSortDirection]);

    const filteredRows = useMemo(() => {
        return sortedRows.filter((row) => {
            return (
                (deferredFilterBeating === "all" ||
                    (deferredFilterBeating === "beating" && row.isBeating === true) ||
                    (deferredFilterBeating === "stale" && row.isBeating === false)) &&
                (deferredFilterNode === "all" || row.node === deferredFilterNode) &&
                (deferredFilterState === "all" || row.state === deferredFilterState) &&
                (deferredFilterId === "all" || row.id === deferredFilterId)
            );
        });
    }, [sortedRows, deferredFilterBeating, deferredFilterNode, deferredFilterState, deferredFilterId]);

    const visibleRows = useMemo(() => {
        return filteredRows.slice(0, visibleCount);
    }, [filteredRows, visibleCount]);

    const handleSort = useCallback((column) => {
        setSortColumn(prev => {
            if (prev === column) {
                setSortDirection(dir => dir === "asc" ? "desc" : "asc");
                return column;
            }
            setSortDirection("asc");
            return column;
        });
        setVisibleCount(30);
    }, []);

    const toggleShowFilters = useCallback(() => {
        setShowFilters(prev => !prev);
    }, []);

    const handleFilterChange = useCallback((setter) => (event) => {
        setter(event.target.value);
        setVisibleCount(30);
    }, []);

    const handleScroll = useCallback(() => {
        if (loading) return;

        const container = tableContainerRef.current;
        if (!container) return;

        const {scrollTop, scrollHeight, clientHeight} = container;
        const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

        if (scrollPercentage > 0.8 && visibleCount < filteredRows.length) {
            setLoading(true);
            setTimeout(() => {
                setVisibleCount(prev => Math.min(prev + 30, filteredRows.length));
                setLoading(false);
            }, 100);
        }
    }, [loading, visibleCount, filteredRows.length]);

    useEffect(() => {
        const container = tableContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    useEffect(() => {
        setVisibleCount(30);
    }, [filteredRows]);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const columns = [
        {label: "RUNNING", key: "state", align: "center"},
        {label: "BEATING", key: "beating", align: "center"},
        {label: "ID", key: "id", align: "left"},
        {label: "NODE", key: "node", align: "left"},
        {label: "PEER", key: "peer", align: "left"},
        {label: "TYPE", key: "type", align: "left"},
        {label: "DESC", key: "desc", align: "left"},
        {label: "CHANGED_AT", key: "changed_at", align: "left"},
        {label: "LAST_BEATING_AT", key: "last_beating_at", align: "left"}
    ];

    return (
        <Box
            sx={{
                height: "100vh",
                bgcolor: 'background.default',
                display: 'flex',
                flexDirection: 'column',
                p: 0,
                position: 'relative',
                width: '100vw',
                margin: 0,
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    bgcolor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    borderRadius: 0,
                    boxShadow: 3,
                    p: 3,
                    m: 0,
                    overflow: 'hidden',
                }}
            >
                <Box sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                    backgroundColor: "background.paper",
                    pb: 2,
                    mb: 2,
                    flexShrink: 0,
                }}>
                    <Box sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 2,
                    }}>
                        {/* Left section with Show Filters button and filters */}
                        <Box sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            flexGrow: 1,
                            overflowX: "auto",
                            py: 1
                        }}>
                            <Button
                                onClick={toggleShowFilters}
                                sx={{minWidth: 'auto', flexShrink: 0}}
                            >
                                {showFilters ? <ExpandLessIcon/> : <>Filters <ExpandMoreIcon/></>}
                            </Button>

                            {showFilters && (
                                <>
                                    <FormControl sx={{minWidth: 200, flexShrink: 0}}>
                                        <InputLabel>Filter by Running</InputLabel>
                                        <Select
                                            value={filterState}
                                            label="Filter by Running"
                                            onChange={handleFilterChange(setFilterState)}
                                        >
                                            <MenuItem value="all">All</MenuItem>
                                            {availableStates.filter(s => s !== "all").map(state => (
                                                <MenuItem key={state}
                                                          value={state}>{state.charAt(0).toUpperCase() + state.slice(1)}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>

                                    <FormControl sx={{minWidth: 200, flexShrink: 0}}>
                                        <InputLabel>Filter by Beating</InputLabel>
                                        <Select
                                            value={filterBeating}
                                            label="Filter by Beating"
                                            onChange={handleFilterChange(setFilterBeating)}
                                        >
                                            <MenuItem value="all">All</MenuItem>
                                            <MenuItem value="beating">Beating</MenuItem>
                                            <MenuItem value="stale">Stale</MenuItem>
                                        </Select>
                                    </FormControl>

                                    <FormControl sx={{minWidth: 200, flexShrink: 0}}>
                                        <InputLabel>Filter by Node</InputLabel>
                                        <Select
                                            value={filterNode}
                                            label="Filter by Node"
                                            onChange={handleFilterChange(setFilterNode)}
                                        >
                                            <MenuItem value="all">All</MenuItem>
                                            {nodes.map(node => <MenuItem key={node} value={node}>{node}</MenuItem>)}
                                        </Select>
                                    </FormControl>

                                    <FormControl sx={{minWidth: 200, flexShrink: 0}}>
                                        <InputLabel>Filter by ID</InputLabel>
                                        <Select
                                            value={filterId}
                                            label="Filter by ID"
                                            onChange={handleFilterChange(setFilterId)}
                                        >
                                            <MenuItem value="all">All</MenuItem>
                                            {availableIds.map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                </>
                            )}
                        </Box>
                    </Box>
                </Box>

                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                    flexShrink: 0
                }}>
                    <Typography variant="body2" color="textSecondary">
                        Showing {visibleRows.length} of {filteredRows.length} heartbeats
                    </Typography>
                </Box>

                <TableContainer
                    ref={tableContainerRef}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        overflow: "auto",
                        boxShadow: "none",
                        border: "none",
                        position: 'relative',
                    }}
                >
                    <Table size="small" sx={{position: 'relative'}}>
                        <TableHead sx={{
                            position: "sticky",
                            top: 0,
                            zIndex: 30,
                            backgroundColor: "background.paper"
                        }}>
                            <TableRow>
                                {columns.map(({label, key, align}) => (
                                    <TableCell
                                        key={label}
                                        sx={{
                                            fontWeight: "bold",
                                            textAlign: align,
                                            cursor: "pointer",
                                            paddingLeft: 2,
                                            paddingRight: 2,
                                        }}
                                        onClick={() => handleSort(key)}
                                    >
                                        <Box sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: align === "left" ? "flex-start" : "center"
                                        }}>
                                            {label}
                                            {sortColumn === key &&
                                                (sortDirection === "asc" ? <KeyboardArrowUpIcon fontSize="small"/> :
                                                    <KeyboardArrowDownIcon fontSize="small"/>)}
                                        </Box>
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visibleRows.map(row => (
                                <HeartbeatRow
                                    key={`${row.node}-${row.id}-${row.peer}`}
                                    row={row}
                                    isSingleNode={isSingleNode}
                                />
                            ))}
                        </TableBody>
                    </Table>
                    {loading && (
                        <Box sx={{display: 'flex', justifyContent: 'center', padding: 2}}>
                            <CircularProgress size={24}/>
                        </Box>
                    )}
                    {visibleRows.length === 0 && (
                        <Typography align="center" color="textSecondary" sx={{mt: 2, p: 3}}>
                            No heartbeats found matching the current filters.
                        </Typography>
                    )}
                </TableContainer>
            </Box>

            <EventLogger
                eventTypes={heartbeatEventTypes}
                title="Heartbeat Events Logger"
                buttonLabel="Heartbeat Events"
            />
        </Box>
    );
};

export default Heartbeats;
