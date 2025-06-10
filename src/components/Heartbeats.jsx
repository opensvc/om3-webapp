import React, {useEffect, useState, useMemo} from "react";
import {useLocation} from "react-router-dom";
import {
    Box,
    Paper,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Collapse,
    Tooltip
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

const getStatusIcon = (isBeating) => {
    return isBeating ? (
        <CheckCircleIcon sx={{color: green[500]}}/>
    ) : (
        <CancelIcon sx={{color: red[500]}}/>
    );
};

const tableCellStyle = {
    padding: "8px 16px",
    textAlign: "center",
    verticalAlign: "middle"
};

const leftAlignedCellStyle = {
    ...tableCellStyle,
    textAlign: "left"
};

const Heartbeats = () => {
    const location = useLocation();
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);

    const initialFilters = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const status = params.get("status");
        const state = params.get("state");
        return {
            status: ["all", "beating", "non-beating"].includes(status) ? status : "all",
            state: state || "all"
        };
    }, [location.search]);

    const [filterBeating, setFilterBeating] = useState(initialFilters.status);
    const [filterNode, setFilterNode] = useState("all");
    const [filterState, setFilterState] = useState(initialFilters.state);
    const [showFilters, setShowFilters] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            startEventReception(token);
        }
        return () => closeEventSource();
    }, []);

    const nodes = [...new Set(Object.keys(heartbeatStatus))].sort();

    const availableStates = useMemo(() => {
        const states = new Set(["all"]);
        Object.values(heartbeatStatus).forEach((nodeData) => {
            (nodeData.streams || []).forEach((stream) => {
                if (stream.state) {
                    states.add(stream.state);
                }
            });
        });
        return Array.from(states).sort();
    }, [heartbeatStatus]);

    const streamRows = [];
    Object.entries(heartbeatStatus).forEach(([node, nodeData]) => {
        (nodeData.streams || []).forEach((stream) => {
            const peerKey = Object.keys(stream.peers || {})[0];
            const peerData = stream.peers?.[peerKey];
            streamRows.push({
                id: stream.id,
                node: node,
                peer: peerKey || "N/A",
                type: stream.type || "N/A",
                desc: peerData?.desc || "N/A",
                isBeating: peerData?.is_beating || false,
                lastAt: peerData?.last_at || "N/A",
                state: stream.state || "unknown"
            });
        });
    });

    const filteredRows = streamRows.filter((row) => {
        const matchesBeating =
            filterBeating === "all" ||
            (filterBeating === "beating" && row.isBeating === true) ||
            (filterBeating === "non-beating" && row.isBeating === false);
        const matchesNode = filterNode === "all" || row.node === filterNode;
        const matchesState = filterState === "all" || row.state === filterState;
        return matchesBeating && matchesNode && matchesState;
    });

    return (
        <Box sx={{p: 4}}>
            <Paper elevation={3} sx={{p: 3, borderRadius: 2}}>
                <Typography variant="h4" gutterBottom align="center">
                    Heartbeats
                </Typography>

                {/* Sticky Filters + Header */}
                <Box
                    sx={{
                        position: "sticky",
                        top: 64,
                        zIndex: 20,
                        backgroundColor: "background.paper",
                        pb: 2,
                        mb: 2
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
                                mb: 2
                            }}
                        >
                            <FormControl sx={{minWidth: 200}}>
                                <InputLabel>Filter by State</InputLabel>
                                <Select
                                    value={filterState}
                                    label="Filter by State"
                                    onChange={(e) => setFilterState(e.target.value)}
                                >
                                    {availableStates.map((state) => (
                                        <MenuItem key={state} value={state}>
                                            {state.charAt(0).toUpperCase() + state.slice(1)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl sx={{minWidth: 200}}>
                                <InputLabel>Filter by Status</InputLabel>
                                <Select
                                    value={filterBeating}
                                    label="Filter by Status"
                                    onChange={(e) => setFilterBeating(e.target.value)}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="beating">Beating</MenuItem>
                                    <MenuItem value="non-beating">Non-Beating</MenuItem>
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
                        </Box>
                    </Collapse>

                    {/* Table Header */}
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                {[
                                    "RUNNING",
                                    "BEATING",
                                    "ID",
                                    "NODE",
                                    "PEER",
                                    "TYPE",
                                    "DESC",
                                    "LAST_AT"
                                ].map((label) => (
                                    <TableCell
                                        key={label}
                                        sx={{
                                            backgroundColor: "white",
                                            fontWeight: "bold",
                                            textAlign: ["ID", "NODE", "PEER", "TYPE", "DESC", "LAST_AT"].includes(label) ? "left" : "center",
                                            borderBottom: "2px solid #ccc"
                                        }}
                                    >
                                        {label}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                    </Table>
                </Box>

                {/* Table Body */}
                <Table size="small">
                    <TableBody>
                        {filteredRows.map((row, index) => (
                            <TableRow key={index} hover>
                                <TableCell sx={tableCellStyle}>
                                    <Tooltip title={row.state} arrow>
                                        <span>{getStateIcon(row.state)}</span>
                                    </Tooltip>
                                </TableCell>
                                <TableCell sx={tableCellStyle}>
                                    <Tooltip title={row.isBeating ? "Beating" : "Non-Beating"} arrow>
                                        <span>{getStatusIcon(row.isBeating)}</span>
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
            </Paper>
        </Box>
    );
};

export default Heartbeats;
