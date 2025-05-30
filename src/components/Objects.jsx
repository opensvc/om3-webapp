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
    Stop,
    PlayArrow,
} from "@mui/icons-material";
import {green, red, blue, orange, grey} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import {closeEventSource} from "../eventSourceManager";
import {URL_OBJECT} from "../config/apiPath.js";
import {
    FreezeDialog,
    StopDialog,
    UnprovisionDialog,
    PurgeDialog,
    SimpleConfirmDialog,
} from "./ActionDialogs";

const AVAILABLE_ACTIONS = [
    {name: "start", icon: <PlayArrow sx={{fontSize: 24}}/>},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>},
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
    const navigate = useNavigate();

    // Read query parameters
    const queryParams = new URLSearchParams(location.search);
    const globalStates = ["all", "up", "down", "warn", "unknown"];
    const rawGlobalState = queryParams.get("globalState");
    const initialGlobalState = globalStates.includes(rawGlobalState)
        ? rawGlobalState
        : "all";

    const {daemon, fetchNodes, startEventReception} = useFetchDaemonStatus();
    const objectStatus = useEventStore((state) => state.objectStatus);
    const objectInstanceStatus = useEventStore(
        (state) => state.objectInstanceStatus
    );
    const instanceMonitor = useEventStore((state) => state.instanceMonitor);
    const removeObject = useEventStore((state) => state.removeObject);

    const [selectedObjects, setSelectedObjects] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [selectedNamespace, setSelectedNamespace] = useState("all");
    const [selectedKind, setSelectedKind] = useState("all");
    const [selectedGlobalState, setSelectedGlobalState] =
        useState(initialGlobalState);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "info",
    });
    const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [unprovisionDialogOpen, setUnprovisionDialogOpen] = useState(false);
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const [simpleConfirmDialogOpen, setSimpleConfirmDialogOpen] = useState(false);
    const [confirmationChecked, setConfirmationChecked] = useState(false);
    const [purgeCheckboxes, setPurgeCheckboxes] = useState({
        dataLoss: false,
        configLoss: false,
        serviceInterruption: false,
    });
    const [pendingAction, setPendingAction] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [showFilters, setShowFilters] = useState(true);

    const theme = useTheme();
    const isWideScreen = useMediaQuery(theme.breakpoints.up("lg"));

    // Debug objectStatus and state
    useEffect(() => {
        console.log("[Objects] objectStatus:", JSON.stringify(objectStatus, null, 2));
        console.log("[Objects] Query params:", Object.fromEntries(queryParams));
        console.log("[Objects] Raw globalState:", rawGlobalState);
        console.log("[Objects] Initial global state:", initialGlobalState);
        console.log("[Objects] selectedGlobalState:", selectedGlobalState);
        console.log("[Objects] Initial namespace:", queryParams.get("namespace"));
        console.log("[Objects] selectedNamespace:", selectedNamespace);
        setSelectedGlobalState(initialGlobalState);
        setSelectedNamespace(
            namespaces.includes(queryParams.get("namespace"))
                ? queryParams.get("namespace")
                : "all"
        );
    }, [location.search, objectStatus]);

    // Helper functions
    const extractNamespace = (name) => {
        const parts = name.split("/");
        return parts.length === 3 ? parts[0] : "root";
    };

    const extractKind = (name) => {
        const parts = name.split("/");
        const objName = parts.length === 3 ? parts[2] : parts[0];
        return objName === "cluster" ? "ccfg" : parts.length === 3 ? parts[1] : "svc";
    };

    // Objects and namespaces
    const objects = Object.keys(objectStatus).length
        ? objectStatus
        : daemon?.cluster?.object || {};
    const allObjectNames = Object.keys(objects).filter(
        (key) => key && typeof objects[key] === "object"
    );
    const namespaces = Array.from(new Set(allObjectNames.map(extractNamespace))).sort();

    const getObjectStatus = (objectName) => {
        const obj = objects[objectName] || {};
        const rawAvail = obj?.avail;
        const validStatuses = ["up", "down", "warn"];
        const avail = validStatuses.includes(rawAvail) ? rawAvail : "unknown";
        const frozen = obj?.frozen;
        const nodes = Object.keys(objectInstanceStatus[objectName] || {});
        let globalExpect = null;
        for (const node of nodes) {
            const monitorKey = `${node}:${objectName}`;
            const monitor = instanceMonitor[monitorKey] || {};
            if (monitor.global_expect && monitor.global_expect !== "none") {
                globalExpect = monitor.global_expect;
                break;
            }
        }
        console.log(
            `[Objects] getObjectStatus for ${objectName}: rawAvail=${JSON.stringify(
                rawAvail
            )}, normalized avail=${avail}, typeof rawAvail=${typeof rawAvail}`
        );
        return {avail, frozen, globalExpect};
    };

    const getNodeState = (objectName, node) => {
        const instanceStatus = objectInstanceStatus[objectName] || {};
        const monitorKey = `${node}:${objectName}`;
        const monitor = instanceMonitor[monitorKey] || {};
        return {
            avail: instanceStatus[node]?.avail,
            frozen:
                instanceStatus[node]?.frozen_at &&
                instanceStatus[node]?.frozen_at !== "0001-01-01T00:00:00Z"
                    ? "frozen"
                    : "unfrozen",
            state: monitor.state !== "idle" ? monitor.state : null,
        };
    };

    // Filtering logic
    const kinds = Array.from(new Set(allObjectNames.map(extractKind))).sort();
    const filteredObjectNames = allObjectNames.filter((name) => {
        const {avail} = getObjectStatus(name);
        const matchesGlobalState =
            selectedGlobalState === "all" || avail === selectedGlobalState;
        console.log(
            `[Objects] Filtering ${name}: avail=${avail}, selectedGlobalState=${selectedGlobalState}, matchesGlobalState=${matchesGlobalState}`
        );
        return (
            (selectedNamespace === "all" || extractNamespace(name) === selectedNamespace) &&
            (selectedKind === "all" || extractKind(name) === selectedKind) &&
            matchesGlobalState &&
            name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    const allNodes = Array.from(
        new Set(
            Object.keys(objectInstanceStatus).flatMap((objectName) =>
                Object.keys(objectInstanceStatus[objectName] || {})
            )
        )
    ).sort();

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
        } else if (action === "stop") {
            setConfirmationChecked(false);
            setStopDialogOpen(true);
        } else if (action === "unprovision") {
            setConfirmationChecked(false);
            setUnprovisionDialogOpen(true);
        } else if (action === "purge") {
            setPurgeCheckboxes({
                dataLoss: false,
                configLoss: false,
                serviceInterruption: false,
            });
            setPurgeDialogOpen(true);
        } else {
            setSimpleConfirmDialogOpen(true);
        }
        handleActionsMenuClose();
    };

    const handleExecuteActionOnSelected = async (action) => {
        const token = localStorage.getItem("authToken");
        setSnackbar({
            open: true,
            message: `Executing '${action}'...`,
            severity: "info",
        });
        let successCount = 0;
        let errorCount = 0;

        const promises = selectedObjects.map(async (objectName) => {
            const rawObj = objectStatus[objectName];
            if (!rawObj) return;
            const parts = objectName.split("/");
            const name = parts.length === 3 ? parts[2] : parts[0];
            const kind = name === "cluster" ? "ccfg" : parts.length === 3 ? parts[1] : "svc";
            const namespace = parts.length === 3 ? parts[0] : "root";
            const obj = {...rawObj, namespace, kind, name};

            if (
                (action === "freeze" && obj.frozen === "frozen") ||
                (action === "unfreeze" && obj.frozen === "unfrozen")
            )
                return;

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
                if (action === "delete") removeObject(objectName);
            } catch {
                errorCount++;
            }
        });

        await Promise.all(promises);
        setSnackbar({
            open: true,
            message:
                successCount && !errorCount
                    ? `✅ '${action}' succeeded on ${successCount} object(s).`
                    : successCount
                        ? `⚠️ '${action}' partially succeeded: ${successCount} ok, ${errorCount} errors.`
                        : `❌ '${action}' failed on all objects.`,
            severity: successCount && !errorCount ? "success" : successCount ? "warning" : "error",
        });

        setSelectedObjects([]);
        setConfirmationDialogOpen(false);
        setStopDialogOpen(false);
        setUnprovisionDialogOpen(false);
        setPurgeDialogOpen(false);
        setPurgeCheckboxes({
            dataLoss: false,
            configLoss: false,
            serviceInterruption: false,
        });
        setSimpleConfirmDialogOpen(false);
        setConfirmationChecked(false);
    };

    const handleObjectClick = (objectName) => {
        if (objectInstanceStatus[objectName])
            navigate(`/objects/${encodeURIComponent(objectName)}`);
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "background.default",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                p: 2,
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    maxWidth: isWideScreen ? "1600px" : "1000px",
                    bgcolor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    borderRadius: 3,
                    boxShadow: 3,
                    p: 3,
                }}
            >
                <Typography variant="h4" gutterBottom align="center">
                    Objects
                </Typography>

                <Box
                    sx={{
                        position: "sticky",
                        top: 64,
                        zIndex: 10,
                        backgroundColor: "background.paper",
                        pt: 2,
                        pb: 1,
                        mb: 2,
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1,
                        }}
                    >
                        <Button
                            onClick={() => setShowFilters(!showFilters)}
                            startIcon={showFilters ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                            aria-label={showFilters ? "Hide filters" : "Show filters"}
                        >
                            {showFilters ? "Hide filters" : "Show filters"}
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleActionsMenuOpen}
                            disabled={!selectedObjects.length}
                        >
                            Actions on selected objects
                        </Button>
                    </Box>

                    <Collapse in={showFilters} timeout="auto" unmountOnExit>
                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 2,
                                alignItems: "center",
                                pb: 2,
                            }}
                        >
                            <Autocomplete
                                key={`global-state-${selectedGlobalState}-${initialGlobalState}`}
                                sx={{minWidth: 200}}
                                options={globalStates}
                                value={selectedGlobalState}
                                onChange={(e, val) => val && setSelectedGlobalState(val)}
                                renderInput={(params) => <TextField {...params} label="Global State"/>}
                                renderOption={(props, option) => (
                                    <li {...props}>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            {option === "up" && (
                                                <FiberManualRecordIcon sx={{color: green[500], fontSize: 18}}/>
                                            )}
                                            {option === "down" && (
                                                <FiberManualRecordIcon sx={{color: red[500], fontSize: 18}}/>
                                            )}
                                            {option === "warn" && (
                                                <WarningAmberIcon sx={{color: orange[500], fontSize: 18}}/>
                                            )}
                                            {option === "unknown" && (
                                                <FiberManualRecordIcon sx={{color: grey[500], fontSize: 18}}/>
                                            )}
                                            {option === "all"
                                                ? "All"
                                                : option.charAt(0).toUpperCase() + option.slice(1)}
                                        </Box>
                                    </li>
                                )}
                            />
                            <Autocomplete
                                key={`namespace-${selectedNamespace}`}
                                sx={{minWidth: 200}}
                                options={["all", ...namespaces]}
                                value={selectedNamespace}
                                onChange={(e, val) => val && setSelectedNamespace(val)}
                                renderInput={(params) => <TextField {...params} label="Namespace"/>}
                            />
                            <Autocomplete
                                sx={{minWidth: 200}}
                                options={["all", ...kinds]}
                                value={selectedKind}
                                onChange={(e, val) => val && setSelectedKind(val)}
                                renderInput={(params) => <TextField {...params} label="Kind"/>}
                            />
                            <TextField
                                label="Name"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                sx={{minWidth: 200}}
                            />
                        </Box>
                    </Collapse>

                    <Menu
                        anchorEl={actionsMenuAnchor}
                        open={Boolean(actionsMenuAnchor)}
                        onClose={handleActionsMenuClose}
                    >
                        {AVAILABLE_ACTIONS.map(({name, icon}) => (
                            <MenuItem key={name} onClick={() => handleActionClick(name)}>
                                <ListItemIcon>{icon}</ListItemIcon>
                                <ListItemText>
                                    {name.charAt(0).toUpperCase() + name.slice(1)}
                                </ListItemText>
                            </MenuItem>
                        ))}
                    </Menu>
                </Box>

                <TableContainer sx={{boxShadow: "none", border: "none"}}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    <Checkbox
                                        checked={
                                            selectedObjects.length === filteredObjectNames.length
                                        }
                                        onChange={(e) =>
                                            setSelectedObjects(
                                                e.target.checked ? filteredObjectNames : []
                                            )
                                        }
                                    />
                                </TableCell>
                                <TableCell>
                                    <strong>Status</strong>
                                </TableCell>
                                <TableCell>
                                    <strong>Object</strong>
                                </TableCell>
                                {isWideScreen &&
                                    allNodes.map((node) => (
                                        <TableCell key={node} align="center">
                                            <strong>{node}</strong>
                                        </TableCell>
                                    ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredObjectNames.map((objectName) => {
                                const {avail, frozen, globalExpect} = getObjectStatus(objectName);
                                return (
                                    <TableRow
                                        key={objectName}
                                        onClick={() => handleObjectClick(objectName)}
                                        sx={{cursor: "pointer"}}
                                    >
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedObjects.includes(objectName)}
                                                onChange={(e) => handleSelectObject(e, objectName)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Box display="flex" alignItems="center" gap={0.5}>
                                                {avail === "up" && (
                                                    <FiberManualRecordIcon
                                                        sx={{color: green[500]}}
                                                        aria-label="Object is up"
                                                    />
                                                )}
                                                {avail === "down" && (
                                                    <FiberManualRecordIcon
                                                        sx={{color: red[500]}}
                                                        aria-label="Object is down"
                                                    />
                                                )}
                                                {avail === "warn" && (
                                                    <WarningAmberIcon
                                                        sx={{color: orange[500]}}
                                                        aria-label="Object has warning"
                                                    />
                                                )}
                                                {avail === "unknown" && (
                                                    <FiberManualRecordIcon
                                                        sx={{color: grey[500]}}
                                                        aria-label="Object status is unknown"
                                                    />
                                                )}
                                                {frozen === "frozen" && (
                                                    <AcUnit
                                                        sx={{color: blue[200]}}
                                                        aria-label="Object is frozen"
                                                    />
                                                )}
                                                {globalExpect && (
                                                    <Typography variant="caption">{globalExpect}</Typography>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography>{objectName}</Typography>
                                        </TableCell>
                                        {isWideScreen &&
                                            allNodes.map((node) => {
                                                const {
                                                    avail: nodeAvail,
                                                    frozen: nodeFrozen,
                                                    state: nodeState,
                                                } = getNodeState(objectName, node);
                                                return (
                                                    <TableCell key={node} align="center">
                                                        <Box
                                                            display="flex"
                                                            justifyContent="center"
                                                            alignItems="center"
                                                            gap={0.5}
                                                        >
                                                            {nodeAvail ? (
                                                                <>
                                                                    {nodeAvail === "up" && (
                                                                        <FiberManualRecordIcon
                                                                            sx={{color: green[500]}}
                                                                            aria-label={`Node ${node} is up`}
                                                                        />
                                                                    )}
                                                                    {nodeAvail === "down" && (
                                                                        <FiberManualRecordIcon
                                                                            sx={{color: red[500]}}
                                                                            aria-label={`Node ${node} is down`}
                                                                        />
                                                                    )}
                                                                    {nodeAvail === "warn" && (
                                                                        <WarningAmberIcon
                                                                            sx={{color: orange[500]}}
                                                                            aria-label={`Node ${node} has warning`}
                                                                        />
                                                                    )}
                                                                    {nodeFrozen === "frozen" && (
                                                                        <AcUnit
                                                                            sx={{color: blue[200]}}
                                                                            aria-label={`Node ${node} is frozen`}
                                                                        />
                                                                    )}
                                                                    {nodeState && (
                                                                        <Typography variant="caption">
                                                                            {nodeState}
                                                                        </Typography>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <Typography variant="caption" color="textSecondary">
                                                                    -
                                                                </Typography>
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
                    <Alert
                        severity={snackbar.severity}
                        onClose={() => setSnackbar({...snackbar, open: false})}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>

                <FreezeDialog
                    open={confirmationDialogOpen}
                    onClose={() => setConfirmationDialogOpen(false)}
                    onConfirm={() => handleExecuteActionOnSelected(pendingAction)}
                    checked={confirmationChecked}
                    setChecked={setConfirmationChecked}
                    disabled={false}
                />

                <StopDialog
                    open={stopDialogOpen}
                    onClose={() => setStopDialogOpen(false)}
                    onConfirm={() => handleExecuteActionOnSelected(pendingAction)}
                    checked={confirmationChecked}
                    setChecked={setConfirmationChecked}
                    disabled={false}
                />

                <UnprovisionDialog
                    open={unprovisionDialogOpen}
                    onClose={() => setUnprovisionDialogOpen(false)}
                    onConfirm={() => handleExecuteActionOnSelected(pendingAction)}
                    checked={confirmationChecked}
                    setChecked={setConfirmationChecked}
                    disabled={false}
                />

                <PurgeDialog
                    open={purgeDialogOpen}
                    onClose={() => setPurgeDialogOpen(false)}
                    onConfirm={() => handleExecuteActionOnSelected(pendingAction)}
                    checkboxes={purgeCheckboxes}
                    setCheckboxes={setPurgeCheckboxes}
                    disabled={false}
                />

                <SimpleConfirmDialog
                    open={simpleConfirmDialogOpen}
                    onClose={() => setSimpleConfirmDialogOpen(false)}
                    onConfirm={() => handleExecuteActionOnSelected(pendingAction)}
                    action={pendingAction}
                    target="the selected objects"
                />
            </Box>
        </Box>
    );
};

export default Objects;