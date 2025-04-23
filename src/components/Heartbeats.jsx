import React from "react";
import useEventStore from "../store/useEventStore";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Tooltip,
} from "@mui/material";
import HeartIcon from "@mui/icons-material/Favorite";
import HeartBrokenIcon from "@mui/icons-material/FavoriteBorder";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ErrorIcon from "@mui/icons-material/Error";

const getStreamStatus = (stream) => {
    if (!stream) return { state: "Unknown", icon: <ErrorIcon /> };

    const peer = Object.values(stream.peers || {})[0];
    const isBeating = peer?.is_beating;
    const state = stream.state;

    if (state !== "running") return { state: "Stopped", icon: <HeartBrokenIcon /> };
    if (isBeating)
        return { state: "Beating", icon: <HeartIcon color="error" /> };
    return { state: "Idle", icon: <HourglassEmptyIcon color="disabled" /> };
};

const Heartbeats = () => {
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const nodes = Object.keys(heartbeatStatus);

    return (
        <Box className="p-6">
            <Typography
                variant="h5"
                className="mb-4 font-semibold text-gray-800 text-center"
            >
                🔄 Heartbeat Status Monitor
            </Typography>

            <TableContainer component={Paper} className="shadow-md rounded-lg">
                <Table>
                    <TableHead>
                        <TableRow className="bg-gray-100">
                            <TableCell className="font-semibold">Node</TableCell>
                            <TableCell className="font-semibold" align="center">
                                hb#1 RX
                            </TableCell>
                            <TableCell className="font-semibold" align="center">
                                hb#1 TX
                            </TableCell>
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
                                <TableRow key={node} hover>
                                    <TableCell>{node}</TableCell>
                                    <TableCell align="center">
                                        <Tooltip title={rxStatus.state} arrow>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    alignItems: "center",
                                                    height: "100%",
                                                }}
                                            >
                                                {rxStatus.icon}
                                            </Box>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title={txStatus.state} arrow>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    alignItems: "center",
                                                    height: "100%",
                                                }}
                                            >
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
        </Box>
    );
};

export default Heartbeats;