import React, {useEffect, useState} from "react";
import {
    Box, CircularProgress, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Typography, Tooltip,
    Button, Menu, MenuItem, Checkbox, IconButton
} from "@mui/material";
import {green, red, blue} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import useEventStore from "../store/useEventStore";
import {createEventSource} from "../eventSourceManager";

const Objects = () => {
    const [daemonStatus, setDaemonStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedObjects, setSelectedObjects] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);

    const objectStatus = useEventStore((state) => state.objectStatus);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (!token) {
            setError("No auth token found.");
            setLoading(false);
            return;
        }

        fetchDaemonStatus(token);
        createEventSource("/sse", token);
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

    const handleSelectObject = (event, objectName) => {
        if (event.target.checked) {
            setSelectedObjects((prev) => [...prev, objectName]);
        } else {
            setSelectedObjects((prev) => prev.filter((obj) => obj !== objectName));
        }
    };

    const handleActionsMenuOpen = (event) => {
        setActionsMenuAnchor(event.currentTarget);
    };

    const handleActionsMenuClose = () => {
        setActionsMenuAnchor(null);
    };

    const handleExecuteActionOnSelected = async (action) => {
        const token = localStorage.getItem("authToken");

        for (let objectName of selectedObjects) {
            const rawObj = objectStatus[objectName];

            if (!rawObj) {
                console.error(`❌ Object ${objectName} is undefined`);
                continue;
            }

            const parts = objectName.split("/");
            let namespace, kind, name;

            if (parts.length === 3) {
                [namespace, kind, name] = parts;
            } else if (parts.length === 1) {
                namespace = "root";
                kind = "svc";
                name = parts[0];
            } else {
                console.error(`❌ Invalid object format: ${objectName}`);
                continue;
            }

            const obj = {...rawObj, namespace, kind, name};

            if (action === "freeze" && obj.frozen === "frozen") continue;
            if (action === "unfreeze" && obj.frozen === "unfrozen") continue;

            const url = `/object/path/${namespace}/${kind}/${name}/action/${action}`;

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                });

                if (!response.ok) {
                    throw new Error(`Failed to ${action} object ${objectName}`);
                }
                console.log(`✅ Object ${objectName} ${action}d successfully`);
            } catch (error) {
                console.error("🚨 Error performing action:", error);
            }
        }

        setSelectedObjects([]);
        handleActionsMenuClose();
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
        ? nodeList.map((n) => typeof n === "string" ? n : n.name)
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

                <Box sx={{mb: 3}}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleActionsMenuOpen}
                        disabled={selectedObjects.length === 0}
                    >
                        Actions on selected objects
                    </Button>
                    <Menu
                        anchorEl={actionsMenuAnchor}
                        open={Boolean(actionsMenuAnchor)}
                        onClose={handleActionsMenuClose}
                    >
                        <MenuItem onClick={() => handleExecuteActionOnSelected("freeze")}>
                            Freeze
                        </MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("unfreeze")}>
                            Unfreeze
                        </MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("restart")}>
                            Restart
                        </MenuItem>
                    </Menu>
                </Box>

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedObjects.length === objectNames.length}
                                        onChange={(e) =>
                                            setSelectedObjects(e.target.checked ? objectNames : [])
                                        }
                                    />
                                </TableCell>
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
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedObjects.includes(objectName)}
                                                onChange={(e) => handleSelectObject(e, objectName)}
                                            />
                                        </TableCell>
                                        <TableCell>{objectName}</TableCell>
                                        <TableCell align="center">
                                            <Box display="flex" justifyContent="center" alignItems="center" gap={1}>
                                                {avail === "up" && <FiberManualRecordIcon sx={{color: green[500]}}/>}
                                                {avail === "down" && <FiberManualRecordIcon sx={{color: red[500]}}/>}
                                                {frozen === "frozen" && (
                                                    <Tooltip title="Frozen">
                                                        <AcUnitIcon fontSize="small" sx={{color: blue[200]}}/>
                                                    </Tooltip>
                                                )}
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
