import React, {useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {
    Box,
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
    Collapse,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import {
    RestartAlt,
    AcUnit,
    LockOpen,
    Delete,
    Settings,
    Block,
    CleaningServices,
    SwapHoriz,
    Undo,
    Cancel,
} from "@mui/icons-material";
import {green, red, blue, orange} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import {closeEventSource} from "../eventSourceManager";
import {URL_OBJECT} from '../config/apiPath.js';

const AVAILABLE_ACTIONS = [
    {name: "restart", icon: <RestartAlt/>},
    {name: "freeze", icon: <AcUnit/>},
    {name: "unfreeze", icon: <LockOpen/>},
    {name: "delete", icon: <Delete/>},
    {name: "provision", icon: <Settings/>},
    {name: "unprovision", icon: <Block/>},
    {name: "purge", icon: <CleaningServices/>},
    {name: "switch", icon: <SwapHoriz/>},
    {name: "giveback", icon: <Undo/>},
    {name: "abort", icon: <Cancel/>},
];

const Objects = () => {
    const location = useLocation();
    const initialNamespace = location.state?.namespace || "all";
    const navigate = useNavigate();

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

    // Use media query to determine if screen is wide enough
    const theme = useTheme();
    const isWideScreen = useMediaQuery(theme.breakpoints.up('lg')); // lg = 1200px

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
        setSnackbar({open: true, message: `Executing '${action}'...`, severity: "info"});
        let successCount = 0;
        let errorCount = 0;

        const promises = selectedObjects.map(async (objectName) => {
            const rawObj = objectStatus[objectName];
            if (!rawObj) return;
            const parts = objectName.split("/");
            const [namespace, kind, name] = parts.length === 3 ? parts : ["root", "svc", parts[0]];
            const obj = {...rawObj, namespace, kind, name};

            if ((action === "freeze" && obj.frozen === "frozen") || (action === "unfreeze" && obj.frozen === "unfrozen")) return;

            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/action/${action}`;
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
                });
                if (!response.ok) {
                    errorCount++;
                    return;
                }
                successCount++;
                if (action === "delete") removeObject(objectName);
            } catch {
                errorCount++;
            }
        });

        await Promise.all(promises);
        setSnackbar({
            open: true,
            message: successCount && !errorCount
                ? `✅ '${action}' succeeded on ${successCount} object(s).`
                : successCount
                    ? `⚠️ '${action}' partially succeeded: ${successCount} ok, ${errorCount} errors.`
                    : `❌ '${action}' failed on all objects.`,
            severity: successCount && !errorCount ? "success" : successCount ? "warning" : "error",
        });

        setSelectedObjects([]);
        setConfirmationDialogOpen(false);
        setSimpleConfirmDialogOpen(false);
    };

    const handleObjectClick = (objectName) => {
        if (objectInstanceStatus[objectName]) navigate(`/objects/${encodeURIComponent(objectName)}`);
    };

    const objects = Object.keys(objectStatus).length ? objectStatus : daemon?.cluster?.object || {};
    const allObjectNames = Object.keys(objects).filter((key) => key && typeof objects[key] === "object");
    const extractNamespace = (name) => name.split("/")[0] || "root";
    const extractKind = (name) => name.split("/")[1] || "svc";
    const namespaces = Array.from(new Set(allObjectNames.map(extractNamespace))).sort();
    const kinds = Array.from(new Set(allObjectNames.map(extractKind))).sort();
    const filteredObjectNames = allObjectNames.filter((name) => {
        return (selectedNamespace === "all" || extractNamespace(name) === selectedNamespace)
            && (selectedKind === "all" || extractKind(name) === selectedKind)
            && name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Get all unique nodes across all objects
    const allNodes = Array.from(
        new Set(
            Object.keys(objectInstanceStatus).flatMap((objectName) =>
                Object.keys(objectInstanceStatus[objectName] || {})
            )
        )
    ).sort();

    // Helper to get node state for a specific object and node
    const getNodeState = (objectName, node) => {
        const instanceStatus = objectInstanceStatus[objectName] || {};
        return {
            avail: instanceStatus[node]?.avail,
            frozen: instanceStatus[node]?.frozen_at && instanceStatus[node]?.frozen_at !== "0001-01-01T00:00:00Z" ? "frozen" : "unfrozen",
        };
    };

    return (
        <Box sx={{
            minHeight: "100vh",
            bgcolor: "background.default",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            p: 2
        }}>
            <Box sx={{
                width: "100%",
                maxWidth: isWideScreen ? "1600px" : "1000px",
                bgcolor: "background.paper",
                border: "2px solid",
                borderColor: "divider",
                borderRadius: 3,
                boxShadow: 3,
                p: 3
            }}>
                <Typography variant="h4" gutterBottom align="center">Objects</Typography>

                <Box sx={{
                    position: "sticky",
                    top: 64,
                    zIndex: 10,
                    backgroundColor: "background.paper",
                    pt: 2,
                    pb: 1,
                    mb: 2
                }}>
                    <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1}}>
                        <Button
                            onClick={() => setShowFilters(!showFilters)}
                            startIcon={showFilters ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                            data-testid="filter-toggle-button"
                        >
                            {showFilters ? "Hide filters" : "Show filters"}
                        </Button>
                        <Button variant="contained" color="primary" onClick={handleActionsMenuOpen}
                                disabled={!selectedObjects.length}>Actions on selected objects</Button>
                    </Box>

                    <Collapse in={showFilters} timeout="auto" unmountOnExit>
                        <Box sx={{display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", pb: 2}}>
                            <Autocomplete sx={{minWidth: 200}} options={["all", ...namespaces]}
                                          value={selectedNamespace}
                                          onChange={(e, val) => val && setSelectedNamespace(val)}
                                          renderInput={(params) => <TextField {...params} label="Namespace"/>}/>
                            <Autocomplete sx={{minWidth: 200}} options={["all", ...kinds]} value={selectedKind}
                                          onChange={(e, val) => val && setSelectedKind(val)}
                                          renderInput={(params) => <TextField {...params} label="Kind"/>}/>
                            <TextField label="Name" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                       sx={{minWidth: 200}}/>
                        </Box>
                    </Collapse>

                    <Menu anchorEl={actionsMenuAnchor} open={Boolean(actionsMenuAnchor)}
                          onClose={handleActionsMenuClose}>
                        {AVAILABLE_ACTIONS.map(({name, icon}) => (
                            <MenuItem key={name} onClick={() => handleActionClick(name)}>
                                <ListItemIcon>{icon}</ListItemIcon>
                                <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                            </MenuItem>
                        ))}
                    </Menu>
                </Box>

                <TableContainer sx={{boxShadow: "none", border: "none"}}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell><Checkbox checked={selectedObjects.length === filteredObjectNames.length}
                                                     onChange={(e) => setSelectedObjects(e.target.checked ? filteredObjectNames : [])}/></TableCell>
                                <TableCell><strong>Object</strong></TableCell>
                                <TableCell align="center"><strong>Global</strong></TableCell>
                                {isWideScreen && allNodes.map((node) => (
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
                                                {avail === "up" && <FiberManualRecordIcon data-testid="FiberManualRecordIcon-up" sx={{color: green[500]}} />}
                                                {avail === "down" && <FiberManualRecordIcon data-testid="FiberManualRecordIcon-down" sx={{color: red[500]}} />}
                                                {avail === "warn" && <WarningAmberIcon data-testid="WarningAmberIcon" sx={{color: orange[500]}} />}
                                                {frozen === "frozen" && <AcUnit data-testid="AcUnitIcon" sx={{color: blue[200]}} />}
                                            </Box>
                                        </TableCell>
                                        {isWideScreen && allNodes.map((node) => {
                                            const {avail: nodeAvail, frozen: nodeFrozen} = getNodeState(objectName, node);
                                            return (
                                                <TableCell key={node} align="center">
                                                    <Box display="flex" justifyContent="center" alignItems="center" gap={0.5}>
                                                        {nodeAvail ? (
                                                            <>
                                                                {nodeAvail === "up" && <FiberManualRecordIcon sx={{color: green[500]}} />}
                                                                {nodeAvail === "down" && <FiberManualRecordIcon sx={{color: red[500]}} />}
                                                                {nodeAvail === "warn" && <WarningAmberIcon sx={{color: orange[500]}} />}
                                                                {nodeFrozen === "frozen" && <AcUnit sx={{color: blue[200]}} />}
                                                            </>
                                                        ) : (
                                                            <Typography variant="caption" color="textSecondary">-</Typography>
                                                        )}
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
        </Box>
    );
};

export default Objects;