import React, {useEffect, useState, useRef} from "react";
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
    Popper,
    Paper,
    MenuItem,
    Checkbox,
    Autocomplete,
    TextField,
    Snackbar,
    Alert,
    Collapse,
    ListItemIcon,
    ListItemText,
    useMediaQuery,
    useTheme,
    Tooltip,
    IconButton,
    ClickAwayListener,
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
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {green, red, blue, orange, grey} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import {closeEventSource, startEventReception} from "../eventSourceManager";
import {URL_OBJECT} from "../config/apiPath.js";
import {extractNamespace, extractKind, isActionAllowedForSelection} from "../utils/objectUtils";
import {OBJECT_ACTIONS} from "../constants/actions";
import ActionDialogManager from "./ActionDialogManager";

// Safari detection
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const Objects = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const isMounted = useRef(true);
    const actionsMenuAnchorRef = useRef(null);
    const rowMenuAnchorRef = useRef(null);

    const queryParams = new URLSearchParams(location.search);
    const globalStates = ["all", "up", "down", "warn", "n/a", "unprovisioned"];
    const rawGlobalState = queryParams.get("globalState") || "all";
    const rawNamespace = queryParams.get("namespace") || "all";
    const rawKind = queryParams.get("kind") || "all";
    const rawSearchQuery = queryParams.get("name") || "";

    const {daemon} = useFetchDaemonStatus();
    const objectStatus = useEventStore((state) => state.objectStatus);
    const objectInstanceStatus = useEventStore((state) => state.objectInstanceStatus);
    const instanceMonitor = useEventStore((state) => state.instanceMonitor);
    const removeObject = useEventStore((state) => state.removeObject);

    const [selectedObjects, setSelectedObjects] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
    const [currentObject, setCurrentObject] = useState(null);
    const [selectedNamespace, setSelectedNamespace] = useState(rawNamespace);
    const [selectedKind, setSelectedKind] = useState(rawKind);
    const [selectedGlobalState, setSelectedGlobalState] = useState(
        globalStates.includes(rawGlobalState) ? rawGlobalState : "all"
    );
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "info",
    });
    const [pendingAction, setPendingAction] = useState(null);
    const [searchQuery, setSearchQuery] = useState(rawSearchQuery);
    const [showFilters, setShowFilters] = useState(true);

    const theme = useTheme();
    const isWideScreen = useMediaQuery(theme.breakpoints.up("lg"));

    // Calculate zoom level
    const getZoomLevel = () => {
        return window.devicePixelRatio || 1;
    };

    useEffect(() => {
        if (!isMounted.current) return;
        const newQueryParams = new URLSearchParams();
        if (selectedGlobalState !== "all") {
            newQueryParams.set("globalState", selectedGlobalState);
        }
        if (selectedNamespace !== "all") {
            newQueryParams.set("namespace", selectedNamespace);
        }
        if (selectedKind !== "all") {
            newQueryParams.set("kind", selectedKind);
        }
        if (searchQuery) {
            newQueryParams.set("name", searchQuery);
        }
        const queryString = newQueryParams.toString();
        navigate(`${location.pathname}${queryString ? `?${queryString}` : ""}`, {
            replace: true,
        });
    }, [selectedGlobalState, selectedNamespace, selectedKind, searchQuery, navigate, location.pathname]);

    useEffect(() => {
        if (!isMounted.current) return;
        setSelectedGlobalState(
            globalStates.includes(rawGlobalState) ? rawGlobalState : "all"
        );
        setSelectedNamespace(rawNamespace);
        setSelectedKind(rawKind);
        setSearchQuery(rawSearchQuery);
    }, [location.search]);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

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
        const avail = validStatuses.includes(rawAvail) ? rawAvail : "n/a";
        const frozen = obj?.frozen;
        const provisioned = obj?.provisioned;
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
        return {avail, frozen, globalExpect, provisioned};
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
            provisioned: instanceStatus[node]?.provisioned,
        };
    };

    const kinds = Array.from(new Set(allObjectNames.map(extractKind))).sort();
    const filteredObjectNames = allObjectNames.filter((name) => {
        const {avail, provisioned} = getObjectStatus(name);
        const matchesGlobalState =
            selectedGlobalState === "all" ||
            (selectedGlobalState === "unprovisioned"
                ? provisioned === "false" || provisioned === false
                : avail === selectedGlobalState);
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
        let subscription;
        if (token) {
            subscription = startEventReception(token, [
                "ObjectStatusUpdated",
                "InstanceStatusUpdated",
                "ObjectDeleted",
                "InstanceMonitorUpdated",
            ]);
        }
        return () => {
            if (subscription && typeof subscription === "function") {
                subscription();
            }
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
        actionsMenuAnchorRef.current = event.currentTarget;
        console.log("Actions menu opened at:", event.currentTarget.getBoundingClientRect());
    };

    const handleActionsMenuClose = () => {
        setActionsMenuAnchor(null);
        actionsMenuAnchorRef.current = null;
    };

    const handleRowMenuOpen = (event, objectName) => {
        setRowMenuAnchor(event.currentTarget);
        setCurrentObject(objectName);
        rowMenuAnchorRef.current = event.currentTarget;
        console.log("Row menu opened at:", event.currentTarget.getBoundingClientRect());
    };

    const handleRowMenuClose = () => {
        setRowMenuAnchor(null);
        setCurrentObject(null);
        rowMenuAnchorRef.current = null;
    };

    const handleActionClick = (action, isSingleObject = false, objectName = null) => {
        console.log("handleActionClick:", {action, isSingleObject, objectName});
        setPendingAction({action, node: isSingleObject ? objectName : null});
        if (isSingleObject) {
            handleRowMenuClose();
        } else {
            handleActionsMenuClose();
        }
    };

    const handleExecuteActionOnSelected = async (action) => {
        console.log("handleExecuteActionOnSelected:", {action, pendingAction, selectedObjects});
        const token = localStorage.getItem("authToken");
        if (!token) {
            setSnackbar({
                open: true,
                message: "Authentication token not found",
                severity: "error",
            });
            return;
        }

        setSnackbar({
            open: true,
            message: `Executing '${action}'...`,
            severity: "info",
        });
        let successCount = 0;
        let errorCount = 0;

        const objectsToProcess = pendingAction.node
            ? [pendingAction.node]
            : selectedObjects;

        const promises = objectsToProcess.map(async (objectName) => {
            const rawObj = objectStatus[objectName];
            if (!rawObj) {
                errorCount++;
                return;
            }

            const parts = objectName.split("/");
            let name, kind, namespace;

            if (parts.length === 3) {
                namespace = parts[0];
                kind = parts[1];
                name = parts[2];
            } else if (parts.length === 2) {
                namespace = "root";
                kind = parts[0];
                name = parts[1];
            } else {
                namespace = "root";
                name = parts[0];
                kind = name === "cluster" ? "ccfg" : "svc";
            }

            const obj = {...rawObj, namespace, kind, name};

            if (
                (action === "freeze" && obj.frozen === "frozen") ||
                (action === "unfreeze" && obj.frozen === "unfrozen")
            ) {
                errorCount++;
                return;
            }

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
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                successCount++;
                if (action === "delete") removeObject(objectName);
            } catch (error) {
                console.error(`Failed to execute ${action} on ${objectName}:`, error);
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
                        : `❌ '${action}' failed on all ${objectsToProcess.length} object(s).`,
            severity: successCount && !errorCount ? "success" : successCount ? "warning" : "error",
        });

        setSelectedObjects([]);
        setPendingAction(null);
    };

    const handleObjectClick = (objectName) => {
        if (objectInstanceStatus[objectName])
            navigate(`/objects/${encodeURIComponent(objectName)}`);
    };

    // Popper props configuration
    const popperProps = (anchorRef) => ({
        placement: "bottom-end",
        disablePortal: isSafari, // Disable portal for Safari
        modifiers: [
            {
                name: "offset",
                options: {
                    offset: ({reference}) => {
                        const zoomLevel = getZoomLevel();
                        return [0, 8 / zoomLevel]; // Adjust offset based on zoom
                    },
                },
            },
            {
                name: "preventOverflow",
                options: {
                    boundariesElement: "viewport",
                },
            },
            {
                name: "flip",
                options: {
                    enabled: true,
                },
            },
        ],
        sx: {
            zIndex: 1300,
            "& .MuiPaper-root": {
                minWidth: 200,
                boxShadow: "0px 5px 15px rgba(0,0,0,0.2)",
            },
        },
    });

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
                            aria-label="Actions on selected objects"
                            ref={actionsMenuAnchorRef}
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
                                key={`global-state-${selectedGlobalState}`}
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
                                            {option === "n/a" && (
                                                <FiberManualRecordIcon sx={{color: grey[500], fontSize: 18}}/>
                                            )}
                                            {option === "unprovisioned" && (
                                                <WarningAmberIcon sx={{color: red[500], fontSize: 18}}/>
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
                                key={`kind-${selectedKind}`}
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

                    <Popper
                        open={Boolean(actionsMenuAnchor)}
                        anchorEl={actionsMenuAnchor}
                        {...popperProps(actionsMenuAnchorRef)}
                    >
                        <ClickAwayListener onClickAway={handleActionsMenuClose}>
                            <Paper elevation={3} role="menu">
                                {OBJECT_ACTIONS.map(({name, icon}) => {
                                    const isAllowed = isActionAllowedForSelection(name, selectedObjects);
                                    return (
                                        <MenuItem
                                            key={name}
                                            onClick={() => handleActionClick(name)}
                                            disabled={!isAllowed}
                                            sx={{
                                                color: isAllowed ? "inherit" : "text.disabled",
                                                "&.Mui-disabled": {
                                                    opacity: 0.5,
                                                },
                                            }}
                                        >
                                            <ListItemIcon sx={{color: isAllowed ? "inherit" : "text.disabled"}}>
                                                {icon}
                                            </ListItemIcon>
                                            <ListItemText>
                                                {name.charAt(0).toUpperCase() + name.slice(1)}
                                            </ListItemText>
                                        </MenuItem>
                                    );
                                })}
                            </Paper>
                        </ClickAwayListener>
                    </Popper>
                </Box>

                <TableContainer sx={{maxHeight: "60vh", overflow: "auto", boxShadow: "none", border: "none"}}>
                    <Table>
                        <TableHead sx={{position: "sticky", top: 0, zIndex: 1, backgroundColor: "background.paper"}}>
                            <TableRow>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedObjects.length === filteredObjectNames.length}
                                        onChange={(e) =>
                                            setSelectedObjects(e.target.checked ? filteredObjectNames : [])
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
                                <TableCell>
                                    <strong>Actions</strong>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredObjectNames.map((objectName) => {
                                const {avail, frozen, globalExpect, provisioned} = getObjectStatus(objectName);
                                const isFrozen = frozen === "frozen";
                                const isNotProvisioned = provisioned === "false" || provisioned === false;
                                const hasAnyNodeFrozen = allNodes.some((node) => {
                                    const {frozen: nodeFrozen} = getNodeState(objectName, node);
                                    return nodeFrozen === "frozen";
                                });
                                const filteredActions = OBJECT_ACTIONS.filter(
                                    ({name}) =>
                                        isActionAllowedForSelection(name, [objectName]) &&
                                        (name !== "freeze" || !isFrozen) &&
                                        (name !== "unfreeze" || hasAnyNodeFrozen)
                                );
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
                                                    <Tooltip title="up">
                                                        <FiberManualRecordIcon
                                                            sx={{color: green[500]}}
                                                            aria-label="Object is up"
                                                        />
                                                    </Tooltip>
                                                )}
                                                {avail === "down" && (
                                                    <Tooltip title="down">
                                                        <FiberManualRecordIcon
                                                            sx={{color: red[500]}}
                                                            aria-label="Object is down"
                                                        />
                                                    </Tooltip>
                                                )}
                                                {avail === "warn" && (
                                                    <Tooltip title="warn">
                                                        <WarningAmberIcon
                                                            sx={{color: orange[500]}}
                                                            aria-label="Object has warning"
                                                        />
                                                    </Tooltip>
                                                )}
                                                {avail === "n/a" && (
                                                    <Tooltip title="n/a">
                                                        <FiberManualRecordIcon
                                                            sx={{color: grey[500]}}
                                                            aria-label="Object status is n/a"
                                                        />
                                                    </Tooltip>
                                                )}
                                                {isNotProvisioned && (
                                                    <Tooltip title="Not Provisioned">
                                                        <WarningAmberIcon
                                                            sx={{color: red[500], fontSize: "1.2rem"}}
                                                            aria-label="Object is not provisioned"
                                                        />
                                                    </Tooltip>
                                                )}
                                                {frozen === "frozen" && (
                                                    <Tooltip title="frozen">
                                                        <AcUnit
                                                            sx={{color: blue[600]}}
                                                            aria-label="Object is frozen"
                                                        />
                                                    </Tooltip>
                                                )}
                                                {globalExpect && (
                                                    <Tooltip title={globalExpect}>
                                                        <Typography variant="caption">{globalExpect}</Typography>
                                                    </Tooltip>
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
                                                    provisioned: nodeProvisioned,
                                                } = getNodeState(objectName, node);
                                                const isNodeNotProvisioned = nodeProvisioned === "false" || nodeProvisioned === false;
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
                                                                        <Tooltip title="up">
                                                                            <FiberManualRecordIcon
                                                                                sx={{color: green[500]}}
                                                                                aria-label={`Node ${node} is up`}
                                                                            />
                                                                        </Tooltip>
                                                                    )}
                                                                    {nodeAvail === "down" && (
                                                                        <Tooltip title="down">
                                                                            <FiberManualRecordIcon
                                                                                sx={{color: red[500]}}
                                                                                aria-label={`Node ${node} is down`}
                                                                            />
                                                                        </Tooltip>
                                                                    )}
                                                                    {nodeAvail === "warn" && (
                                                                        <Tooltip title="warn">
                                                                            <WarningAmberIcon
                                                                                sx={{color: orange[500]}}
                                                                                aria-label={`Node ${node} has warning`}
                                                                            />
                                                                        </Tooltip>
                                                                    )}
                                                                    {isNodeNotProvisioned && (
                                                                        <Tooltip title="Not Provisioned">
                                                                            <WarningAmberIcon
                                                                                sx={{
                                                                                    color: red[500],
                                                                                    fontSize: "1.2rem",
                                                                                }}
                                                                                aria-label={`Node ${node} is not provisioned`}
                                                                            />
                                                                        </Tooltip>
                                                                    )}
                                                                    {nodeFrozen === "frozen" && (
                                                                        <Tooltip title="frozen">
                                                                            <AcUnit
                                                                                sx={{color: blue[600]}}
                                                                                aria-label={`Node ${node} is frozen`}
                                                                            />
                                                                        </Tooltip>
                                                                    )}
                                                                    {nodeState && (
                                                                        <Tooltip title={nodeState}>
                                                                            <Typography variant="caption">
                                                                                {nodeState}
                                                                            </Typography>
                                                                        </Tooltip>
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
                                        <TableCell>
                                            <IconButton
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRowMenuOpen(e, objectName);
                                                }}
                                                aria-label={`More actions for object ${objectName}`}
                                                ref={rowMenuAnchorRef}
                                            >
                                                <MoreVertIcon/>
                                            </IconButton>
                                            <Popper
                                                open={Boolean(rowMenuAnchor) && currentObject === objectName}
                                                anchorEl={rowMenuAnchor}
                                                {...popperProps(rowMenuAnchorRef)}
                                            >
                                                <ClickAwayListener onClickAway={handleRowMenuClose}>
                                                    <Paper elevation={3} role="menu">
                                                        {filteredActions.map(({name, icon}) => (
                                                            <MenuItem
                                                                key={name}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleActionClick(name, true, objectName);
                                                                }}
                                                                sx={{display: "flex", alignItems: "center", gap: 1}}
                                                                aria-label={`${name} action for object ${objectName}`}
                                                            >
                                                                <ListItemIcon>{icon}</ListItemIcon>
                                                                {name.charAt(0).toUpperCase() + name.slice(1)}
                                                            </MenuItem>
                                                        ))}
                                                    </Paper>
                                                </ClickAwayListener>
                                            </Popper>
                                        </TableCell>
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

                <ActionDialogManager
                    pendingAction={pendingAction}
                    handleConfirm={handleExecuteActionOnSelected}
                    target={pendingAction?.node ? `object ${pendingAction.node}` : `${selectedObjects.length} objects`}
                    supportedActions={OBJECT_ACTIONS.map((action) => action.name)}
                    onClose={() => setPendingAction(null)}
                />
            </Box>
        </Box>
    );
};

export default Objects;
