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
    Tooltip,
    Button,
    Menu,
    MenuItem,
    Checkbox,
    Autocomplete,
    TextField,
    Snackbar,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel
} from "@mui/material";
import {green, red, grey, blue, orange} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {useNavigate} from "react-router-dom";
import useEventStore from "../store/useEventStore";

const AVAILABLE_ACTIONS = ["restart", "freeze", "unfreeze"];

const Objects = () => {
    const [daemonStatus, setDaemonStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedObjects, setSelectedObjects] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [selectedNamespace, setSelectedNamespace] = useState("all");
    const [selectedKind, setSelectedKind] = useState("all");
    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "info"});

    const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
    const [confirmationChecked, setConfirmationChecked] = useState(false);
    const [pendingAction, setPendingAction] = useState("");
    const [simpleConfirmDialogOpen, setSimpleConfirmDialogOpen] = useState(false);

    const objectStatus = useEventStore((state) => state.objectStatus);
    const objectInstanceStatus = useEventStore((state) => state.objectInstanceStatus);

    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (!token) {
            setError("No auth token found.");
            setLoading(false);
            return;
        }
        fetchDaemonStatus(token);
    }, []);

    const fetchDaemonStatus = async (authToken) => {
        try {
            const response = await fetch("/daemon/status", {
                headers: {Authorization: `Bearer ${authToken}`},
            });
            if (!response.ok) throw new Error("Failed to fetch daemon status");
            const data = await response.json();
            setDaemonStatus(data);
        } catch (error) {
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

    const handleActionClick = (action) => {
        setPendingAction(action);
        if (action === "freeze") {
            setConfirmationChecked(false);
            setConfirmationDialogOpen(true);
        } else {
            setSimpleConfirmDialogOpen(true);
        }
        handleActionsMenuClose();
    };

    const handleExecuteActionOnSelected = async (action) => {
        const token = localStorage.getItem("authToken");
        setSnackbar({
            open: true,
            message: `Executing action '${action}'...`,
            severity: "info",
        });

        let successCount = 0;
        let errorCount = 0;

        const promises = selectedObjects.map(async (objectName) => {
            const rawObj = objectStatus[objectName];
            if (!rawObj) return;

            const parts = objectName.split("/");
            let namespace, kind, name;
            if (parts.length === 3) {
                [namespace, kind, name] = parts;
            } else {
                namespace = "root";
                kind = "svc";
                name = parts[0];
            }

            const obj = {...rawObj, namespace, kind, name};
            if (action === "freeze" && obj.frozen === "frozen") return;
            if (action === "unfreeze" && obj.frozen === "unfrozen") return;

            const url = `/object/path/${namespace}/${kind}/${name}/action/${action}`;
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });
                if (!response.ok) {
                    errorCount++;
                    return;
                }
                successCount++;
            } catch {
                errorCount++;
            }
        });

        await Promise.all(promises);

        if (successCount && !errorCount) {
            setSnackbar({
                open: true,
                message: `✅ Action '${action}' succeeded on ${successCount} object(s).`,
                severity: "success",
            });
        } else if (successCount && errorCount) {
            setSnackbar({
                open: true,
                message: `⚠️ Action '${action}' partially succeeded: ${successCount} ok, ${errorCount} failure(s).`,
                severity: "warning",
            });
        } else {
            setSnackbar({
                open: true,
                message: `❌ Action '${action}' failed on all objects.`,
                severity: "error",
            });
        }

        setSelectedObjects([]);
        setConfirmationDialogOpen(false);
        setSimpleConfirmDialogOpen(false);
    };

    const handleObjectClick = (objectName) => {
        const objectInstance = objectInstanceStatus[objectName];
        if (objectInstance) {
            navigate(`/objects/${encodeURIComponent(objectName)}`);
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
        return (
            <Typography variant="h6" align="center" color="error">
                {error}
            </Typography>
        );
    }

    const objects =
        Object.keys(objectStatus).length > 0
            ? objectStatus
            : daemonStatus?.cluster?.object || {};
    const allObjectNames = Object.keys(objects).filter(
        (key) => key && typeof objects[key] === "object"
    );

    const extractNamespace = (objectName) => {
        const parts = objectName.split("/");
        return parts.length === 3 ? parts[0] : "root";
    };

    const extractKind = (objectName) => {
        const parts = objectName.split("/");
        return parts.length === 3 ? parts[1] : "svc";
    };

    const namespaces = Array.from(new Set(allObjectNames.map(extractNamespace))).sort();
    const kinds = Array.from(new Set(allObjectNames.map(extractKind))).sort();

    const filteredObjectNames = allObjectNames.filter((name) => {
        const nsMatch = selectedNamespace === "all" || extractNamespace(name) === selectedNamespace;
        const kindMatch = selectedKind === "all" || extractKind(name) === selectedKind;
        return nsMatch && kindMatch;
    });

    const nodeList = daemonStatus?.cluster?.config?.nodes || [];
    const nodeNames = Array.isArray(nodeList)
        ? nodeList.map((n) => (typeof n === "string" ? n : n.name))
        : Object.keys(nodeList);

    if (!allObjectNames.length || !nodeNames.length) {
        return (
            <Typography variant="h6" align="center">
                No data available (empty objects or nodes)
            </Typography>
        );
    }

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "background.default",
                p: 3,
                display: "flex",
                justifyContent: "center",
            }}
        >
            <Box sx={{width: "100%", maxWidth: "1000px"}}>
                <Paper elevation={3} sx={{p: 3, borderRadius: 2}}>
                    <Typography variant="h4" gutterBottom align="center">
                        Objects by Node
                    </Typography>

                    <Box sx={{display: "flex", flexWrap: "wrap", gap: 2, mb: 3}}>
                        <Autocomplete
                            sx={{minWidth: 200}}
                            options={["all", ...namespaces]}
                            value={selectedNamespace}
                            onChange={(event, newValue) => newValue && setSelectedNamespace(newValue)}
                            renderInput={(params) => <TextField {...params} label="Namespace"/>}
                        />
                        <Autocomplete
                            sx={{minWidth: 200}}
                            options={["all", ...kinds]}
                            value={selectedKind}
                            onChange={(event, newValue) => newValue && setSelectedKind(newValue)}
                            renderInput={(params) => <TextField {...params} label="Kind"/>}
                        />
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
                            {AVAILABLE_ACTIONS.map((action) => (
                                <MenuItem key={action} onClick={() => handleActionClick(action)}>
                                    {action.charAt(0).toUpperCase() + action.slice(1)}
                                </MenuItem>
                            ))}
                        </Menu>
                    </Box>

                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedObjects.length === filteredObjectNames.length}
                                            onChange={(e) =>
                                                setSelectedObjects(
                                                    e.target.checked ? filteredObjectNames : []
                                                )
                                            }
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <strong>Object</strong>
                                    </TableCell>
                                    <TableCell align="center">
                                        <strong>Global</strong>
                                    </TableCell>
                                    {nodeNames.map((node) => (
                                        <TableCell key={node} align="center">
                                            <strong>{node}</strong>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredObjectNames.map((objectName) => {
                                    const obj = objects[objectName] || {};
                                    const avail = obj?.avail;
                                    const frozen = obj?.frozen;
                                    const instances = objectInstanceStatus[objectName] || {};

                                    return (
                                        <TableRow
                                            key={objectName}
                                            onClick={() => handleObjectClick(objectName)}
                                            sx={{cursor: "pointer"}}
                                        >
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedObjects.includes(objectName)}
                                                    onChange={(e) =>
                                                        handleSelectObject(e, objectName)
                                                    }
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </TableCell>
                                            <TableCell>{objectName}</TableCell>
                                            <TableCell align="center">
                                                <Box
                                                    display="flex"
                                                    justifyContent="center"
                                                    alignItems="center"
                                                    gap={1}
                                                >
                                                    {avail === "up" && (
                                                        <Tooltip title="Available">
                                                            <FiberManualRecordIcon
                                                                sx={{color: green[500]}}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                    {avail === "down" && (
                                                        <Tooltip title="Unavailable">
                                                            <FiberManualRecordIcon
                                                                sx={{color: red[500]}}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                    {avail === "warn" && (
                                                        <Tooltip title="Warning">
                                                            <WarningAmberIcon sx={{color: orange[500]}}/>
                                                        </Tooltip>
                                                    )}
                                                    {frozen === "frozen" && (
                                                        <Tooltip title="Frozen">
                                                            <AcUnitIcon
                                                                fontSize="small"
                                                                sx={{color: blue[200]}}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            {nodeNames.map((node) => {
                                                const instance = instances[node];
                                                let color = grey[500];
                                                if (instance?.avail === "up") color = green[500];
                                                else if (instance?.avail === "down") color = red[500];
                                                else if (instance?.avail === "warn") color = orange[500];

                                                return (
                                                    <TableCell key={node} align="center">
                                                        {instance?.avail === "warn" ? (
                                                            <Tooltip title="Warning">
                                                                <WarningAmberIcon sx={{color: orange[500]}}/>
                                                            </Tooltip>
                                                        ) : (
                                                            <FiberManualRecordIcon sx={{color}}/>
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Box>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({...snackbar, open: false})}
                anchorOrigin={{vertical: "bottom", horizontal: "center"}}
            >
                <Alert
                    severity={snackbar.severity}
                    onClose={() => setSnackbar({...snackbar, open: false})}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Dialog for freeze */}
            <Dialog
                open={confirmationDialogOpen}
                onClose={() => setConfirmationDialogOpen(false)}
            >
                <DialogTitle>Freeze selected objects</DialogTitle>
                <DialogContent>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={confirmationChecked}
                                onChange={(e) => setConfirmationChecked(e.target.checked)}
                            />
                        }
                        label="I understand the selected services orchestration will be paused."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmationDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => handleExecuteActionOnSelected(pendingAction)}
                        disabled={!confirmationChecked}
                        variant="contained"
                        color="primary"
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog for other actions */}
            <Dialog
                open={simpleConfirmDialogOpen}
                onClose={() => setSimpleConfirmDialogOpen(false)}
            >
                <DialogTitle>Confirm action</DialogTitle>
                <DialogContent>
                    Are you sure you want to execute{" "}
                    <strong>{pendingAction}</strong> on the selected objects?
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSimpleConfirmDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => handleExecuteActionOnSelected(pendingAction)}
                        variant="contained"
                        color="primary"
                    >
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Objects;