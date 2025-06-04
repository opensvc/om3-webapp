import React, {useEffect, useState, useMemo} from "react";
import {useLocation} from "react-router-dom";
import {
    Box,
    Paper,
    Typography,
    TableContainer,
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
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";
import {closeEventSource} from "../eventSourceManager.jsx";

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

// Style constant pour les cellules du tableau
const tableCellStyle = {
    padding: '8px 16px',
    textAlign: 'center',
    verticalAlign: 'middle',
};

const leftAlignedCellStyle = {
    ...tableCellStyle,
    textAlign: 'left',
};

const Heartbeats = () => {
    const location = useLocation();
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const {fetchNodes, startEventReception} = useFetchDaemonStatus();

    // Get initial status from URL
    const initialStatus = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const status = params.get("status");
        return ["all", "beating", "non-beating"].includes(status) ? status : "all";
    }, [location.search]);

    const [filterBeating, setFilterBeating] = useState(initialStatus);
    const [filterNode, setFilterNode] = useState("all");
    const [filterState, setFilterState] = useState("all");
    const [showFilters, setShowFilters] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            startEventReception(token);
        }
        return () => closeEventSource();
    }, []);

    const nodes = [...new Set(Object.keys(heartbeatStatus))].sort();

    // Extraction dynamique des états disponibles
    const availableStates = useMemo(() => {
        const states = new Set(["all"]); // 'all' est toujours présent
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
                state: stream.state || "unknown",
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

                <Box
                    sx={{
                        position: "sticky",
                        top: 64,
                        zIndex: 10,
                        backgroundColor: "background.paper",
                        pt: 2,
                        pb: 1,
                        mb: 2,
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1,
                        }}
                    >
                        <Button
                            onClick={() => setShowFilters(!showFilters)}
                            startIcon={showFilters ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                        >
                            {showFilters ? "Hide filters" : "Show filters"}
                        </Button>
                    </Box>

                    <Collapse in={showFilters} timeout="auto" unmountOnExit>
                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 2,
                                alignItems: "center",
                                pb: 2,
                            }}
                        >
                            <FormControl sx={{minWidth: 200}}>
                                <InputLabel id="filter-state-label">Filter by State</InputLabel>
                                <Select
                                    labelId="filter-state-label"
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
                                <InputLabel id="filter-beating-label">Filter by Status</InputLabel>
                                <Select
                                    labelId="filter-beating-label"
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
                                <InputLabel id="filter-node-label">Filter by Node</InputLabel>
                                <Select
                                    labelId="filter-node-label"
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
                </Box>

                <TableContainer>
                    <Table size="small" sx={{minWidth: 650}}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{fontWeight: "bold", ...tableCellStyle}}>STATE</TableCell>
                                <TableCell sx={{fontWeight: "bold", ...tableCellStyle}}>STATUS</TableCell>
                                <TableCell sx={{fontWeight: "bold", ...leftAlignedCellStyle}}>ID</TableCell>
                                <TableCell sx={{fontWeight: "bold", ...leftAlignedCellStyle}}>NODE</TableCell>
                                <TableCell sx={{fontWeight: "bold", ...leftAlignedCellStyle}}>PEER</TableCell>
                                <TableCell sx={{fontWeight: "bold", ...leftAlignedCellStyle}}>TYPE</TableCell>
                                <TableCell sx={{fontWeight: "bold", ...leftAlignedCellStyle}}>DESC</TableCell>
                                <TableCell sx={{fontWeight: "bold", ...leftAlignedCellStyle}}>LAST_AT</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredRows.map((row, index) => (
                                <TableRow key={index} hover>
                                    <TableCell sx={tableCellStyle}>{getStateIcon(row.state)}</TableCell>
                                    <TableCell sx={tableCellStyle}>{getStatusIcon(row.isBeating)}</TableCell>
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