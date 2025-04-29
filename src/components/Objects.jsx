import React, {useEffect, useState} from "react";
import {useLocation} from "react-router-dom";
import {
    Box,
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
    FormControlLabel,
    Collapse
} from "@mui/material";
import {green, red, blue, orange} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {useNavigate} from "react-router-dom";
import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import {closeEventSource} from "../eventSourceManager";
import {URL_OBJECT} from '../config/apiPath.js';

const AVAILABLE_ACTIONS = ["restart", "freeze", "unfreeze", "delete", "provision", "unprovision", "purge"];

const Objects = () => {
    const location = useLocation();
    const initialNamespace = location.state?.namespace || "all";

    const {daemon, fetchNodes, startEventReception} = useFetchDaemonStatus();
    const objectStatus = useEventStore((state) => state.objectStatus);
    const objectInstanceStatus = useEventStore((state) => state.objectInstanceStatus);
    const removeObject = useEventStore((state) => state.removeObject);

    const [selectedObjects, setSelectedObjects] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [selectedNamespace, setSelectedNamespace] = useState(initialNamespace);
    const [selectedKind, setSelectedKind] = useState("all");
    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "info"});
    const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
    const [confirmationChecked, setConfirmationChecked] = useState(false);
    const [pendingAction, setPendingAction] = useState("");
    const [simpleConfirmDialogOpen, setSimpleConfirmDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showFilters, setShowFilters] = useState(true);

    const navigate = useNavigate();

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

            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/action/${action}`;
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

                if (action === "delete") {
                    removeObject(objectName);
                }

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

    const objects = Object.keys(objectStatus).length > 0
        ? objectStatus
        : daemon?.cluster?.object || {};

    const allObjectNames = Object.keys(objects).filter((key) => key && typeof objects[key] === "object");

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
        const searchMatch = name.toLowerCase().includes(searchQuery.toLowerCase());
        return nsMatch && kindMatch && searchMatch;
    });

    return (
        <Box sx={{minHeight: "100vh", bgcolor: "background.default", p: 3, display: "flex", justifyContent: "center"}}>
            <Box sx={{width: "100%", maxWidth: "1000px"}}>
                <Paper elevation={3} sx={{p: 3, borderRadius: 2}}>
                    <Typography variant="h4" gutterBottom align="center">
                        Objects
                    </Typography>
                    <Box
                        sx={{
                            position: "sticky",
                            top: "64px",
                            zIndex: 10,
                            backgroundColor: "background.paper",
                            pt: 2,
                            pb: 1,
                            mb: 2,
                            borderBottom: "1px solid",
                            borderColor: "divider",
                        }}
                    >
                        <Button
                            onClick={() => setShowFilters(!showFilters)}
                            startIcon={showFilters ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                            sx={{mb: 1}}
                        >
                            {showFilters ? "Hide filters" : "Show filters"}
                        </Button>

                        <Collapse in={showFilters} timeout="auto" unmountOnExit>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 2,
                                    alignItems: "center",
                                    pb: 2
                                }}
                            >
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
                                <TextField
                                    label="Name"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    sx={{minWidth: 200}}
                                />
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={handleActionsMenuOpen}
                                    disabled={selectedObjects.length === 0}
                                >
                                    Actions on selected objects
                                </Button>
                            </Box>
                        </Collapse>

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
                                            onChange={(e) => setSelectedObjects(e.target.checked ? filteredObjectNames : [])}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <strong>Object</strong>
                                    </TableCell>
                                    <TableCell align="center">
                                        <strong>Global</strong>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredObjectNames.map((objectName) => {
                                    const obj = objects[objectName] || {};
                                    const avail = obj?.avail;
                                    const frozen = obj?.frozen;

                                    return (
                                        <TableRow key={objectName} onClick={() => handleObjectClick(objectName)}
                                                  sx={{cursor: "pointer"}}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedObjects.includes(objectName)}
                                                    onChange={(e) => handleSelectObject(e, objectName)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </TableCell>
                                            <TableCell>{objectName}</TableCell>
                                            <TableCell align="center">
                                                <Box display="flex" justifyContent="center" alignItems="center" gap={1}>
                                                    {avail === "up" && (
                                                        <Tooltip title="Available">
                                                            <FiberManualRecordIcon sx={{color: green[500]}}/>
                                                        </Tooltip>
                                                    )}
                                                    {avail === "down" && (
                                                        <Tooltip title="Unavailable">
                                                            <FiberManualRecordIcon sx={{color: red[500]}}/>
                                                        </Tooltip>
                                                    )}
                                                    {avail === "warn" && (
                                                        <Tooltip title="Warning">
                                                            <WarningAmberIcon sx={{color: orange[500]}}/>
                                                        </Tooltip>
                                                    )}
                                                    {frozen === "frozen" && (
                                                        <Tooltip title="Frozen">
                                                            <AcUnitIcon fontSize="small" sx={{color: blue[200]}}/>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            </TableCell>
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
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({...snackbar, open: false})}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Dialog for freeze */}
            <Dialog open={confirmationDialogOpen} onClose={() => setConfirmationDialogOpen(false)}>
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
                    <Button onClick={() => setConfirmationDialogOpen(false)}>Cancel</Button>
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
            <Dialog open={simpleConfirmDialogOpen} onClose={() => setSimpleConfirmDialogOpen(false)}>
                <DialogTitle>Confirm action</DialogTitle>
                <DialogContent>
                    Are you sure you want to execute <strong>{pendingAction}</strong> on the selected objects?
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSimpleConfirmDialogOpen(false)}>Cancel</Button>
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