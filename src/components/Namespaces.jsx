import React, {useEffect, useState, useMemo} from "react";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Autocomplete,
    TextField,
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {green, red, orange, grey} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import useEventStore from "../hooks/useEventStore.js";
import {useNavigate, useLocation} from "react-router-dom";
import {closeEventSource, startEventReception} from "../eventSourceManager.jsx";
import EventLogger from "../components/EventLogger";

const getColorByStatus = (status) => {
    switch (status) {
        case "up":
            return green[500];
        case "down":
            return red[500];
        case "warn":
            return orange[500];
        default:
            return grey[500];
    }
};

const extractNamespace = (objectName) => {
    const parts = objectName.split("/");
    return parts.length === 3 ? parts[0] : "root";
};

const Namespaces = () => {
    const objectStatus = useEventStore((state) => state.objectStatus);
    const navigate = useNavigate();
    const location = useLocation();
    const [sortColumn, setSortColumn] = useState("namespace");
    const [sortDirection, setSortDirection] = useState("asc");

    // Read namespace parameter from URL
    const queryParams = new URLSearchParams(location.search);
    const urlNamespace = queryParams.get("namespace");
    const [selectedNamespace, setSelectedNamespace] = useState(urlNamespace || "all");

    const namespaceEventTypes = [
        'ObjectStatusUpdated',
        'InstanceStatusUpdated',
        'ObjectDeleted',
        'InstanceConfigUpdated'
    ];

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            startEventReception(token, namespaceEventTypes);
        }
        return () => {
            closeEventSource();
        };
    }, []);

    // Update filter when URL changes
    useEffect(() => {
        setSelectedNamespace(urlNamespace || "all");
    }, [urlNamespace]);

    const allObjectNames = Object.keys(objectStatus).filter(
        (key) => key && typeof objectStatus[key] === "object"
    );

    // Get all unique namespaces
    const namespaces = useMemo(() => Array.from(
        new Set(allObjectNames.map(extractNamespace))
    ).sort(), [allObjectNames]);

    // Memoize statusByNamespace to prevent recreation on every render
    const statusByNamespace = useMemo(() => {
        const statusMap = {};
        allObjectNames.forEach((name) => {
            const ns = extractNamespace(name);
            const status = objectStatus[name]?.avail || "n/a";

            if (!statusMap[ns]) {
                statusMap[ns] = {up: 0, down: 0, warn: 0, "n/a": 0};
            }

            if (statusMap[ns][status] !== undefined) {
                statusMap[ns][status]++;
            } else {
                statusMap[ns]["n/a"]++;
            }
        });
        return statusMap;
    }, [allObjectNames, objectStatus]);

    // Filter and sort namespaces
    const filteredNamespaces = useMemo(() => {
        const filtered = Object.entries(statusByNamespace).filter(
            ([namespace]) => selectedNamespace === "all" || namespace === selectedNamespace
        );
        return filtered.sort((a, b) => {
            const [namespaceA, countsA] = a;
            const [namespaceB, countsB] = b;
            let diff = 0;
            if (sortColumn === "namespace") {
                diff = namespaceA.localeCompare(namespaceB);
            } else if (sortColumn === "up") {
                diff = countsA.up - countsB.up;
            } else if (sortColumn === "down") {
                diff = countsA.down - countsB.down;
            } else if (sortColumn === "warn") {
                diff = countsA.warn - countsB.warn;
            } else if (sortColumn === "n/a") {
                diff = countsA["n/a"] - countsB["n/a"];
            } else if (sortColumn === "total") {
                const totalA = countsA.up + countsA.down + countsA.warn + countsA["n/a"];
                const totalB = countsB.up + countsB.down + countsB.warn + countsB["n/a"];
                diff = totalA - totalB;
            }
            return sortDirection === "asc" ? diff : -diff;
        });
    }, [statusByNamespace, selectedNamespace, sortColumn, sortDirection]);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                display: "flex",
                justifyContent: "center",
                p: 0,
                position: 'relative',
                minHeight: '100vh',
                width: '100vw',
                margin: 0,
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    borderRadius: 0,
                    boxShadow: 3,
                    p: 3,
                    m: 0,
                }}
            >
                <Typography variant="h4" gutterBottom align="center">
                    Namespaces Status Overview
                </Typography>

                {/* Namespace Filter */}
                <Box sx={{mb: 3}}>
                    <Autocomplete
                        sx={{width: 300}}
                        options={["all", ...namespaces]}
                        value={selectedNamespace}
                        onChange={(e, val) => {
                            const newNamespace = val || "all";
                            setSelectedNamespace(newNamespace);
                            // Update URL when filter changes
                            if (newNamespace === "all") {
                                navigate("/namespaces");
                            } else {
                                navigate(`/namespaces?namespace=${newNamespace}`);
                            }
                        }}
                        renderInput={(params) => (
                            <TextField {...params} label="Filter by namespace"/>
                        )}
                    />
                </Box>

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell onClick={() => handleSort("namespace")} sx={{cursor: "pointer"}}>
                                    <Box sx={{display: "flex", alignItems: "center"}}>
                                        <strong>Namespace</strong>
                                        {sortColumn === "namespace" &&
                                            (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                <KeyboardArrowDownIcon/>)}
                                    </Box>
                                </TableCell>
                                <TableCell align="center" onClick={() => handleSort("up")} sx={{cursor: "pointer"}}>
                                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                                        <strong>Up</strong>
                                        {sortColumn === "up" &&
                                            (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                <KeyboardArrowDownIcon/>)}
                                    </Box>
                                </TableCell>
                                <TableCell align="center" onClick={() => handleSort("down")} sx={{cursor: "pointer"}}>
                                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                                        <strong>Down</strong>
                                        {sortColumn === "down" &&
                                            (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                <KeyboardArrowDownIcon/>)}
                                    </Box>
                                </TableCell>
                                <TableCell align="center" onClick={() => handleSort("warn")} sx={{cursor: "pointer"}}>
                                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                                        <strong>Warn</strong>
                                        {sortColumn === "warn" &&
                                            (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                <KeyboardArrowDownIcon/>)}
                                    </Box>
                                </TableCell>
                                <TableCell align="center" onClick={() => handleSort("n/a")} sx={{cursor: "pointer"}}>
                                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                                        <strong>N/A</strong>
                                        {sortColumn === "n/a" &&
                                            (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                <KeyboardArrowDownIcon/>)}
                                    </Box>
                                </TableCell>
                                <TableCell align="center" onClick={() => handleSort("total")} sx={{cursor: "pointer"}}>
                                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                                        <strong>Total</strong>
                                        {sortColumn === "total" &&
                                            (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                <KeyboardArrowDownIcon/>)}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredNamespaces.length > 0 ? (
                                filteredNamespaces.map(([namespace, counts]) => {
                                    const total = counts.up + counts.down + counts.warn + counts["n/a"];
                                    return (
                                        <TableRow
                                            key={namespace}
                                            hover
                                            onClick={() => {
                                                navigate(`/objects?namespace=${namespace}`);
                                            }}
                                            sx={{cursor: "pointer"}}
                                        >
                                            <TableCell sx={{fontWeight: 500}}>
                                                {namespace}
                                            </TableCell>
                                            {["up", "down", "warn", "n/a"].map((status) => (
                                                <TableCell
                                                    key={status}
                                                    align="center"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const url = `/objects?namespace=${namespace}&globalState=${status}`;
                                                        navigate(url);
                                                    }}
                                                    sx={{cursor: "pointer"}}
                                                >
                                                    <Box display="flex" justifyContent="center" alignItems="center"
                                                         gap={1}>
                                                        {status === "warn" ? (
                                                            <PriorityHighIcon
                                                                sx={{fontSize: 18, color: getColorByStatus(status)}}
                                                            />
                                                        ) : (
                                                            <FiberManualRecordIcon
                                                                sx={{fontSize: 18, color: getColorByStatus(status)}}
                                                            />
                                                        )}
                                                        <Typography variant="body1">{counts[status]}</Typography>
                                                    </Box>
                                                </TableCell>
                                            ))}
                                            <TableCell align="center">
                                                <Typography variant="body1" fontWeight={600}>
                                                    {total}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} align="center">
                                        <Typography data-testid="no-namespaces-message">
                                            {selectedNamespace !== "all"
                                                ? "No namespaces match the selected filter"
                                                : "No namespaces available"}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <EventLogger
                    eventTypes={namespaceEventTypes}
                    title="Namespaces Events Logger"
                    buttonLabel="Namespace Events"
                />
            </Box>
        </Box>
    );
};

export default Namespaces;
