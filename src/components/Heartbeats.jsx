import React, {useEffect} from "react";
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
import {closeEventSource} from "../eventSourceManager.jsx";

export const getStreamStatus = (stream) => {
    if (!stream) return {
        state: "Unknown",
        icon: <ErrorIcon color="disabled" data-testid="error-icon" />
    };

    const peer = Object.values(stream.peers || {})[0];
    const isBeating = peer?.is_beating;
    const state = stream.state;

    if (state !== "running") return {
        state: "Stopped",
        icon: <HeartBrokenIcon color="action" data-testid="heart-broken-icon" />
    };
    if (isBeating) return {
        state: "Beating",
        icon: <HeartIcon color="error" data-testid="heart-icon" />
    };
    return {
        state: "Idle",
        icon: <HourglassEmptyIcon color="disabled" data-testid="hourglass-icon" />
    };
};

const Heartbeats = () => {
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const nodes = Object.keys(heartbeatStatus || {});
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
    }, [fetchNodes, startEventReception]);

    return (
        <Box
            sx={{
                p: 4,
                display: "flex",
                justifyContent: "center",
            }}
            data-testid="heartbeats-container"
        >
            <Box sx={{width: "100%", maxWidth: 1000}}>
                <Paper elevation={3} sx={{p: 3, borderRadius: 2}}>
                    <Typography variant="h4" gutterBottom align="center" data-testid="heartbeats-title">
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
                                            data-testid={`node-row-${node}`}
                                        >
                                            <TableCell data-testid={`node-name-${node}`}>
                                                {node}
                                            </TableCell>
                                            <TableCell
                                                align="center"
                                                data-testid={`rx-status-${node}`}
                                                title={rxStatus.state}
                                            >
                                                <Tooltip title={rxStatus.state}>
                                                    <Box display="flex" justifyContent="center" alignItems="center">
                                                        {rxStatus.icon}
                                                    </Box>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell
                                                align="center"
                                                data-testid={`tx-status-${node}`}
                                                title={txStatus.state}
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