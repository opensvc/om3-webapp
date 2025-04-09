import React, {useEffect, useState} from "react";
import {
    Box,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Tooltip
} from "@mui/material";
import {green, red, blue} from "@mui/material/colors";
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import useEventStore from "../store/useEventStore";
import {createEventSource} from "../eventSourceManager";

const Objects = () => {
    const [daemonStatus, setDaemonStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [token, setToken] = useState(null);

    const objectStatus = useEventStore((state) => state.objectStatus);

    useEffect(() => {
        const storedToken = localStorage.getItem("authToken");
        if (!storedToken) {
            setError("No auth token found.");
            setLoading(false);
            return;
        }

        setToken(storedToken);
        fetchDaemonStatus(storedToken);
        createEventSource("/sse", storedToken);
    }, []);

    const fetchDaemonStatus = async (authToken) => {
        try {
            const response = await fetch("/daemon/status", {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            if (!response.ok) throw new Error("Failed to fetch daemon status");

            const data = await response.json();
            console.log("✅ Daemon status response:", data);
            setDaemonStatus(data);
        } catch (error) {
            console.error("❌ Error fetching daemon status:", error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh"}}>
                <CircularProgress/>
            </Box>
        );
    }

    if (error) {
        return <Typography variant="h6" align="center" color="error">{error}</Typography>;
    }

    const objects = Object.keys(objectStatus).length > 0
        ? objectStatus
        : daemonStatus?.cluster?.object || {};

    const nodeList = daemonStatus?.cluster?.config?.nodes || [];

    const nodeNames = Array.isArray(nodeList)
        ? nodeList.map(n => typeof n === "string" ? n : n.name)
        : Object.keys(nodeList);

    const objectNames = Object.keys(objects).filter(
        (key) => key && typeof objects[key] === "object"
    );

    if (!objectNames.length || !nodeNames.length) {
        return <Typography variant="h6" align="center">No data available (empty objects or nodes)</Typography>;
    }

    return (
        <Box sx={{minHeight: "100vh", bgcolor: "background.default", p: 3}}>
            <Paper elevation={3} sx={{p: 3, borderRadius: 2}}>
                <Typography variant="h4" gutterBottom align="center">
                    Objects by Node
                </Typography>
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell><strong>Object</strong></TableCell>
                                <TableCell align="center"><strong>State</strong></TableCell>
                                {nodeNames.map((node) => (
                                    <TableCell key={node} align="center"><strong>{node}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {objectNames.map((objectName) => {
                                const obj = objects[objectName];
                                const scope = obj?.scope || [];
                                const avail = obj?.avail;
                                const frozen = obj?.frozen;

                                return (
                                    <TableRow key={objectName}>
                                        <TableCell>{objectName}</TableCell>
                                        <TableCell align="center">
                                            <Box display="flex" justifyContent="center" alignItems="center" gap={1}>
                                                {avail === "up" && <FiberManualRecordIcon sx={{color: green[500]}}/>}
                                                {avail === "down" && <FiberManualRecordIcon sx={{color: red[500]}}/>}
                                                {frozen === "frozen" ? (
                                                    <Tooltip title="Frozen">
                                                        <AcUnitIcon fontSize="small" sx={{color: blue[200]}}/>
                                                    </Tooltip>
                                                ) : frozen !== "unfrozen" && frozen ? (
                                                    <Typography variant="body2"
                                                                color="text.secondary">{frozen}</Typography>
                                                ) : null}
                                            </Box>
                                        </TableCell>
                                        {nodeNames.map((node) => (
                                            <TableCell key={node} align="center">
                                                <Box display="flex" justifyContent="center" alignItems="center">
                                                    <FiberManualRecordIcon
                                                        sx={{color: scope.includes(node) ? green[500] : red[500]}}
                                                    />
                                                </Box>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default Objects;
