import React, {useEffect, useState} from "react";
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
import {green, red, orange, grey} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import useEventStore from "../hooks/useEventStore.js";
import {useNavigate, useLocation} from "react-router-dom";
import {closeEventSource, startEventReception} from "../eventSourceManager.jsx";

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

    // Read namespace parameter from URL
    const queryParams = new URLSearchParams(location.search);
    const urlNamespace = queryParams.get("namespace");
    const [selectedNamespace, setSelectedNamespace] = useState(urlNamespace || "all");

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            startEventReception(token, [
                'ObjectStatusUpdated',
                'InstanceStatusUpdated',
                'ObjectDeleted',
                'InstanceConfigUpdated'
            ]);
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
    const namespaces = Array.from(
        new Set(allObjectNames.map(extractNamespace))
    ).sort();

    const statusByNamespace = {};

    allObjectNames.forEach((name) => {
        const ns = extractNamespace(name);
        const status = objectStatus[name]?.avail || "n/a";

        if (!statusByNamespace[ns]) {
            statusByNamespace[ns] = {up: 0, down: 0, warn: 0, "n/a": 0};
        }

        if (statusByNamespace[ns][status] !== undefined) {
            statusByNamespace[ns][status]++;
        } else {
            statusByNamespace[ns]["n/a"]++;
        }
    });

    // Filter namespaces based on selected namespace
    const filteredNamespaces = Object.entries(statusByNamespace).filter(
        ([namespace]) => selectedNamespace === "all" || namespace === selectedNamespace
    );

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                display: "flex",
                justifyContent: "center",
                p: 3,
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    maxWidth: "1000px",
                    bgcolor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    borderRadius: 3,
                    boxShadow: 3,
                    p: 3,
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
                                <TableCell><strong>Namespace</strong></TableCell>
                                <TableCell align="center"><strong>Up</strong></TableCell>
                                <TableCell align="center"><strong>Down</strong></TableCell>
                                <TableCell align="center"><strong>Warn</strong></TableCell>
                                <TableCell align="center"><strong>N/A</strong></TableCell>
                                <TableCell align="center"><strong>Total</strong></TableCell>
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
                                                        <FiberManualRecordIcon
                                                            sx={{fontSize: 18, color: getColorByStatus(status)}}
                                                        />
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
            </Box>
        </Box>
    );
};

export default Namespaces;
