import React, { useEffect } from "react";
import useEventStore from "../hooks/useEventStore.js";
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
    Tooltip,
} from "@mui/material";
import HeartIcon from "@mui/icons-material/Favorite";
import HeartBrokenIcon from "@mui/icons-material/FavoriteBorder";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ErrorIcon from "@mui/icons-material/Error";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";
import { closeEventSource } from "../eventSourceManager.jsx";

export const getStreamStatus = (stream) => {
    if (!stream) return {
        state: "Unknown",
        icon: <ErrorIcon color="disabled" aria-label="Unknown stream status" />
    };

    const peer = Object.values(stream.peers || {})[0];
    const isBeating = peer?.is_beating;
    const state = stream.state;

    if (state !== "running") return {
        state: "Stopped",
        icon: <HeartBrokenIcon color="action" aria-label="Stopped stream" />
    };
    if (isBeating) return {
        state: "Beating",
        icon: <HeartIcon color="error" aria-label="Beating stream" />
    };
    return {
        state: "Idle",
        icon: <HourglassEmptyIcon color="disabled" aria-label="Idle stream" />
    };
};

const Heartbeats = () => {
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const nodes = Object.keys(heartbeatStatus || {});
    const { fetchNodes, startEventReception } = useFetchDaemonStatus();

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            startEventReception(token);
        }
        return () => {
            closeEventSource();
        };
    }, [fetchNodes, startEventReception]);

    return (
        <Box
            sx={{
                p: 4,
                display: "flex",
                justifyContent: "center",
            }}
            aria-label="Heartbeats container"
        >
            <Box sx={{ width: "100%", maxWidth: 1000 }}>
                <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
                    <Typography variant="h4" gutterBottom align="center" aria-label="Heartbeats title">
                        Heartbeats
                    </Typography>

                    <TableContainer>
                        <Table aria-label="heartbeats table">
                            <TableHead>
                                <TableRow>
                                    <TableCell><strong>Node</strong></TableCell>
                                    <TableCell align="center"><strong>hb#1 RX</strong></TableCell>
                                    <TableCell align="center"><strong>hb#1 TX</strong></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {nodes.map((node) => {
                                    const heartbeat = heartbeatStatus[node];
                                    const streams = heartbeat?.streams || [];

                                    const rx = streams.find((s) => s.id === "hb#1.rx");
                                    const tx = streams.find((s) => s.id === "hb#1.tx");

                                    const rxStatus = getStreamStatus(rx);
                                    const txStatus = getStreamStatus(tx);

                                    return (
                                        <TableRow
                                            key={node}
                                            hover
                                            aria-label={`Node ${node} heartbeat row`}
                                        >
                                            <TableCell aria-label={`Node ${node} name`}>
                                                {node}
                                            </TableCell>
                                            <TableCell
                                                align="center"
                                                title={rxStatus.state}
                                                aria-label={`Node ${node} RX status: ${rxStatus.state}`}
                                            >
                                                <Tooltip title={rxStatus.state}>
                                                    <Box display="flex" justifyContent="center" alignItems="center">
                                                        {rxStatus.icon}
                                                    </Box>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell
                                                align="center"
                                                title={txStatus.state}
                                                aria-label={`Node ${node} TX status: ${txStatus.state}`}
                                            >
                                                <Tooltip title={txStatus.state}>
                                                    <Box display="flex" justifyContent="center" alignItems="center">
                                                        {txStatus.icon}
                                                    </Box>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Box>
        </Box>
    );
};

export default Heartbeats;