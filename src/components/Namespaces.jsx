import React, {useEffect} from "react";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import {green, red, orange, grey} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import useEventStore from "../hooks/useEventStore.js";
import {useNavigate} from "react-router-dom";
import {closeEventSource} from "../eventSourceManager.jsx";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";

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
    const {fetchNodes, startEventReception} = useFetchDaemonStatus();

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            startEventReception(token);
        }
        return () => {
            closeEventSource();
        };
    }, []);

    const allObjectNames = Object.keys(objectStatus).filter(
        (key) => key && typeof objectStatus[key] === "object"
    );

    const statusByNamespace = {};

    allObjectNames.forEach((name) => {
        const ns = extractNamespace(name);
        const status = objectStatus[name]?.avail || "unknown";

        if (!statusByNamespace[ns]) {
            statusByNamespace[ns] = {up: 0, down: 0, warn: 0, unknown: 0};
        }

        if (statusByNamespace[ns][status] !== undefined) {
            statusByNamespace[ns][status]++;
        } else {
            statusByNamespace[ns].unknown++;
        }
    });

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
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell><strong>Namespace</strong></TableCell>
                                <TableCell align="center"><strong>Up</strong></TableCell>
                                <TableCell align="center"><strong>Down</strong></TableCell>
                                <TableCell align="center"><strong>Warn</strong></TableCell>
                                <TableCell align="center"><strong>Unknown</strong></TableCell>
                                <TableCell align="center"><strong>Total</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.entries(statusByNamespace).map(([namespace, counts]) => {
                                const total = counts.up + counts.down + counts.warn + counts.unknown;
                                return (
                                    <TableRow
                                        key={namespace}
                                        hover
                                        onClick={() => {
                                            navigate("/objects", {
                                                state: {
                                                    namespace: namespace
                                                }
                                            });
                                        }}
                                        sx={{cursor: "pointer"}}
                                    >
                                        <TableCell sx={{fontWeight: 500}}>
                                            {namespace}
                                        </TableCell>
                                        {["up", "down", "warn", "unknown"].map((status) => (
                                            <TableCell key={status} align="center">
                                                <Box display="flex" justifyContent="center" alignItems="center" gap={1}>
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
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        </Box>
    );
};

export default Namespaces;