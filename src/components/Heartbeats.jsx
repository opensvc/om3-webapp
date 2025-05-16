import React, {useEffect} from "react";
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
    Chip
} from "@mui/material";
import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";
import {closeEventSource} from "../eventSourceManager.jsx";

export const getStreamStatus = (stream) => {
    if (!stream) return {state: "Unknown"};
    const peer = Object.values(stream.peers || {})[0];
    if (stream.state !== "running") return {state: "Stopped"};
    return {state: peer?.is_beating ? "Beating" : "Idle"};
};

const extractHeartbeatIds = (streams = []) => {
    return [...new Set(streams.map(s => s.id.split('.')[0]))].sort();
};

const Heartbeats = () => {
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const nodes = Object.keys(heartbeatStatus || {});
    const {fetchNodes, startEventReception} = useFetchDaemonStatus();

    const columnCount = nodes[0] && heartbeatStatus[nodes[0]]?.streams?.length
        ? extractHeartbeatIds(heartbeatStatus[nodes[0]].streams).length
        : 0;

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            startEventReception(token);
        }
        return () => closeEventSource();
    }, []);

    return (
        <Box sx={{p: 4}}>
            <Paper elevation={3} sx={{p: 3, borderRadius: 2}}>
                <Typography variant="h4" gutterBottom align="center">
                    Heartbeats
                </Typography>

                <Box sx={{overflowX: "auto"}}>
                    <TableContainer>
                        <Table
                            size="small"
                            sx={{
                                tableLayout: "fixed",
                                minWidth: 200 + columnCount * 100,
                            }}
                        >
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{fontWeight: "bold"}}>Node</TableCell>
                                    {nodes[0] &&
                                        extractHeartbeatIds(heartbeatStatus[nodes[0]].streams).map(hbId => (
                                            <TableCell key={hbId} align="center" sx={{fontWeight: "bold"}}>
                                                {hbId}
                                            </TableCell>
                                        ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {nodes.map(node => {
                                    const heartbeatIds = extractHeartbeatIds(heartbeatStatus[node]?.streams);
                                    return (
                                        <TableRow key={node} hover>
                                            <TableCell>{node}</TableCell>
                                            {heartbeatIds.map(hbId => {
                                                const rx = heartbeatStatus[node].streams.find(s => s.id === `${hbId}.rx`);
                                                const tx = heartbeatStatus[node].streams.find(s => s.id === `${hbId}.tx`);

                                                return (
                                                    <TableCell
                                                        key={`${node}-${hbId}`}
                                                        align="center"
                                                        sx={{padding: '6px 4px'}}
                                                    >
                                                        <Box sx={{
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            gap: '8px',
                                                            flexWrap: 'wrap',
                                                        }}>
                                                            <Tooltip title={`rx: ${getStreamStatus(rx).state}`}>
                                                                <Chip
                                                                    size="small"
                                                                    label="rx"
                                                                    sx={{
                                                                        backgroundColor: getStreamStatus(rx).state === 'Beating' ? 'success.main' : 'error.main',
                                                                        color: 'white',
                                                                        height: 24,
                                                                        fontSize: '0.75rem',
                                                                        px: 1.5,
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                            <Tooltip title={`tx: ${getStreamStatus(tx).state}`}>
                                                                <Chip
                                                                    size="small"
                                                                    label="tx"
                                                                    sx={{
                                                                        backgroundColor: getStreamStatus(tx).state === 'Beating' ? 'success.main' : 'error.main',
                                                                        color: 'white',
                                                                        height: 24,
                                                                        fontSize: '0.75rem',
                                                                        px: 1.5,
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </Paper>
        </Box>
    );
};

export default Heartbeats;