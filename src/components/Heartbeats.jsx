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
import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";
import {closeEventSource} from "../eventSourceManager.jsx";

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
            });
        });
    });

    const filteredRows = streamRows.filter((row) => {
        const matchesBeating =
            filterBeating === "all" ||
            (filterBeating === "beating" && row.isBeating === true) ||
            (filterBeating === "non-beating" && row.isBeating === false);
        const matchesNode = filterNode === "all" || row.node === filterNode;
        return matchesBeating && matchesNode;
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
                            aria-label={showFilters ? "Hide filters" : "Show filters"}
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
                            <FormControl sx={{minWidth: 200}} id="filter-beating-control">
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
                                <TableCell sx={{fontWeight: "bold"}}>STATUS</TableCell>
                                <TableCell sx={{fontWeight: "bold"}}>ID</TableCell>
                                <TableCell sx={{fontWeight: "bold"}}>NODE</TableCell>
                                <TableCell sx={{fontWeight: "bold"}}>PEER</TableCell>
                                <TableCell sx={{fontWeight: "bold"}}>TYPE</TableCell>
                                <TableCell sx={{fontWeight: "bold"}}>DESC</TableCell>
                                <TableCell sx={{fontWeight: "bold"}}>LAST_AT</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredRows.map((row, index) => (
                                <TableRow key={index} hover>
                                    <TableCell>{row.isBeating ? "✅" : "❌"}</TableCell>
                                    <TableCell>{row.id}</TableCell>
                                    <TableCell>{row.node}</TableCell>
                                    <TableCell>{row.peer}</TableCell>
                                    <TableCell>{row.type}</TableCell>
                                    <TableCell>{row.desc}</TableCell>
                                    <TableCell>{row.lastAt}</TableCell>
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