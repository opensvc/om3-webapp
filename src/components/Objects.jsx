import React, {useEffect, useState, useMemo, useCallback, useRef} from "react";
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
    ListItemIcon,
    ListItemText,
    useMediaQuery,
    useTheme,
    Tooltip,
    IconButton,
    ClickAwayListener,
} from "@mui/material";
import AcUnit from "@mui/icons-material/AcUnit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {green, red, blue, orange, grey} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import debounce from "lodash/debounce";
import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import logger from '../utils/logger.js';
import {closeEventSource, startEventReception} from "../eventSourceManager";
import {URL_OBJECT} from "../config/apiPath.js";
import {extractNamespace, extractKind, isActionAllowedForSelection} from "../utils/objectUtils";
import {OBJECT_ACTIONS} from "../constants/actions";
import ActionDialogManager from "./ActionDialogManager";
import EventLogger from "../components/EventLogger";

// Safari detection
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Utility function to parse object name
const parseObjectName = (objectName) => {
    const parts = objectName.split("/");
    if (parts.length === 3) {
        return {namespace: parts[0], kind: parts[1], name: parts[2]};
    } else if (parts.length === 2) {
        return {namespace: "root", kind: parts[0], name: parts[1]};
    }
    return {
        namespace: "root",
        kind: objectName === "cluster" ? "ccfg" : "svc",
        name: parts[0],
    };
};
const StatusIcon = React.memo(({avail, isNotProvisioned, frozen}) => (
    <Box
        sx={{
            width: "80px",
            height: "24px",
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        }}
    >
        <Box
            sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1
            }}
        >
            {avail === "up" && (
                <Tooltip title="up">
                    <FiberManualRecordIcon sx={{color: green[500], fontSize: 24}} aria-label="Object is up"/>
                </Tooltip>
            )}
            {avail === "down" && (
                <Tooltip title="down">
                    <FiberManualRecordIcon sx={{color: red[500], fontSize: 24}} aria-label="Object is down"/>
                </Tooltip>
            )}
            {avail === "warn" && (
                <Tooltip title="warn">
                    <PriorityHighIcon sx={{color: orange[500], fontSize: 24}} aria-label="Object has warning"/>
                </Tooltip>
            )}
            {avail === "n/a" && (
                <Tooltip title="n/a">
                    <FiberManualRecordIcon sx={{color: grey[500], fontSize: 24}} aria-label="Object status is n/a"/>
                </Tooltip>
            )}
        </Box>
        {isNotProvisioned && (
            <Box
                sx={{
                    position: "absolute",
                    left: "0px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 2
                }}
            >
                <Tooltip title="Not Provisioned">
                    <PriorityHighIcon sx={{color: red[500], fontSize: 24}}
                                      aria-label="Object is not provisioned"/>
                </Tooltip>
            </Box>
        )}
        {frozen === "frozen" && (
            <Box
                sx={{
                    position: "absolute",
                    right: "0px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 2
                }}
            >
                <Tooltip title="frozen">
                    <AcUnit sx={{color: blue[600], fontSize: 24}} aria-label="Object is frozen"/>
                </Tooltip>
            </Box>
        )}
    </Box>
));
const GlobalExpectDisplay = React.memo(({globalExpect}) => (
    <Box
        sx={{
            width: "70px",
            display: "flex",
            justifyContent: "center",
        }}
    >
        {globalExpect && (
            <Tooltip title={globalExpect}>
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: "0.75rem",
                        lineHeight: "1.2",
                        maxWidth: "70px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    {globalExpect}
                </Typography>
            </Tooltip>
        )}
    </Box>
));
const NodeStatusIcons = React.memo(({nodeAvail, isNodeNotProvisioned, nodeFrozen, node}) => (
    <Box
        sx={{
            width: "80px",
            height: "24px",
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        }}
    >
        <Box
            sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1
            }}
        >
            {nodeAvail === "up" && (
                <Tooltip title="up">
                    <FiberManualRecordIcon sx={{color: green[500], fontSize: 24}} aria-label={`Node ${node} is up`}/>
                </Tooltip>
            )}
            {nodeAvail === "down" && (
                <Tooltip title="down">
                    <FiberManualRecordIcon sx={{color: red[500], fontSize: 24}} aria-label={`Node ${node} is down`}/>
                </Tooltip>
            )}
            {nodeAvail === "warn" && (
                <Tooltip title="warn">
                    <PriorityHighIcon sx={{color: orange[500], fontSize: 24}} aria-label={`Node ${node} has warning`}/>
                </Tooltip>
            )}
        </Box>
        {isNodeNotProvisioned && (
            <Box
                sx={{
                    position: "absolute",
                    left: "0px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 2
                }}
            >
                <Tooltip title="Not Provisioned">
                    <PriorityHighIcon sx={{color: red[500], fontSize: 24}}
                                      aria-label={`Node ${node} is not provisioned`}/>
                </Tooltip>
            </Box>
        )}
        {nodeFrozen === "frozen" && (
            <Box
                sx={{
                    position: "absolute",
                    right: "0px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 2
                }}
            >
                <Tooltip title="frozen">
                    <AcUnit sx={{color: blue[600], fontSize: 24}} aria-label={`Node ${node} is frozen`}/>
                </Tooltip>
            </Box>
        )}
    </Box>
));
const NodeStateDisplay = React.memo(({nodeState, node}) => (
    <Box
        sx={{
            width: "50px",
            display: "flex",
            justifyContent: "center",
        }}
    >
        {nodeState && (
            <Tooltip title={nodeState}>
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: "0.75rem",
                        lineHeight: "1.2",
                        maxWidth: "50px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                    aria-label={`Node ${node} state: ${nodeState}`}
                >
                    {nodeState}
                </Typography>
            </Tooltip>
        )}
    </Box>
));
const NodeStatus = React.memo(({objectName, node, getNodeState}) => {
    const {avail: nodeAvail, frozen: nodeFrozen, state: nodeState, provisioned: nodeProvisioned} = getNodeState(
        objectName,
        node
    );
    const isNodeNotProvisioned = nodeProvisioned === "false" || nodeProvisioned === false;
    return nodeAvail ? (
        <Box sx={{
            width: "130px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
        }}>
            <NodeStatusIcons
                nodeAvail={nodeAvail}
                isNodeNotProvisioned={isNodeNotProvisioned}
                nodeFrozen={nodeFrozen}
                node={node}
            />
            <NodeStateDisplay nodeState={nodeState} node={node}/>
        </Box>
    ) : (
        <Box sx={{
            width: "130px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        }}>
            <Typography variant="caption" color="textSecondary">
                -
            </Typography>
        </Box>
    );
});
const TableRowComponent = React.memo(
    ({
         objectName,
         selectedObjects,
         handleSelectObject,
         handleObjectClick,
         handleRowMenuOpen,
         rowMenuAnchor,
         currentObject,
         getObjectStatus,
         getNodeState,
         allNodes,
         isWideScreen,
         popperProps,
         handleActionClick,
         handleRowMenuClose,
         objects
     }) => {
        const {avail, frozen, globalExpect, provisioned} = getObjectStatus(objectName, objects);
        const isFrozen = frozen === "frozen";
        const isNotProvisioned = provisioned === "false" || provisioned === false;
        const hasAnyNodeFrozen = useMemo(
            () => allNodes.some((node) => getNodeState(objectName, node).frozen === "frozen"),
            [allNodes, getNodeState, objectName]
        );
        const filteredActions = useMemo(
            () =>
                OBJECT_ACTIONS.filter(
                    ({name}) =>
                        isActionAllowedForSelection(name, [objectName]) &&
                        (name !== "freeze" || !isFrozen) &&
                        (name !== "unfreeze" || hasAnyNodeFrozen)
                ),
            [objectName, isFrozen, hasAnyNodeFrozen]
        );
        return (
            <TableRow onClick={() => handleObjectClick(objectName)} sx={{cursor: "pointer"}}>
                <TableCell>
                    <Checkbox
                        checked={selectedObjects.includes(objectName)}
                        onChange={(e) => handleSelectObject(e, objectName)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select object ${objectName}`}
                    />
                </TableCell>
                <TableCell sx={{
                    minWidth: "150px",
                    width: "150px",
                    position: "relative",
                    height: "100%"
                }}>
                    <Box sx={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                    }}>
                        <StatusIcon
                            avail={avail}
                            isNotProvisioned={isNotProvisioned}
                            frozen={frozen}
                        />
                        <GlobalExpectDisplay globalExpect={globalExpect}/>
                    </Box>
                </TableCell>
                <TableCell>
                    <Typography>{objectName}</Typography>
                </TableCell>
                {isWideScreen &&
                    allNodes.map((node) => (
                        <TableCell key={node} align="center" sx={{
                            minWidth: "130px",
                            width: "130px",
                            position: "relative"
                        }}>
                            <NodeStatus objectName={objectName} node={node} getNodeState={getNodeState}/>
                        </TableCell>
                    ))}
                <TableCell>
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRowMenuOpen(e, objectName);
                        }}
                        aria-label={`More actions for object ${objectName}`}
                    >
                        <MoreVertIcon/>
                    </IconButton>
                    <Popper open={Boolean(rowMenuAnchor) && currentObject === objectName}
                            anchorEl={rowMenuAnchor} {...popperProps}>
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
    }
);
const Objects = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const isMounted = useRef(true);
    const queryParams = new URLSearchParams(location.search);
    const globalStates = useMemo(() => ["all", "up", "down", "warn", "n/a", "unprovisioned"], []);
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
    const [sortColumn, setSortColumn] = useState("object");
    const [sortDirection, setSortDirection] = useState("asc");

    const theme = useTheme();
    const isWideScreen = useMediaQuery(theme.breakpoints.up("lg"));
    const objectEventTypes = useMemo(() => [
        "ObjectStatusUpdated",
        "InstanceStatusUpdated",
        "ObjectDeleted",
        "InstanceMonitorUpdated",
        "CONNECTION_OPENED",
        "CONNECTION_ERROR",
        "RECONNECTION_ATTEMPT",
        "MAX_RECONNECTIONS_REACHED",
        "CONNECTION_CLOSED"
    ], []);
    const getZoomLevel = useCallback(() => window.devicePixelRatio || 1, []);
    const getObjectStatus = useCallback(
        (objectName, objs) => {
            const obj = objs[objectName] || {};
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
        },
        [objectInstanceStatus, instanceMonitor]
    );
    const getNodeState = useCallback(
        (objectName, node) => {
            const instanceStatus = objectInstanceStatus[objectName] || {};
            const monitorKey = `${node}:${objectName}`;
            const monitor = instanceMonitor[monitorKey] || {};
            return {
                avail: instanceStatus[node]?.avail,
                frozen:
                    instanceStatus[node]?.frozen_at && instanceStatus[node]?.frozen_at !== "0001-01-01T00:00:00Z"
                        ? "frozen"
                        : "unfrozen",
                state: monitor.state !== "idle" ? monitor.state : null,
                provisioned: instanceStatus[node]?.provisioned,
            };
        },
        [objectInstanceStatus, instanceMonitor]
    );
    const objects = useMemo(
        () => (Object.keys(objectStatus).length ? objectStatus : daemon?.cluster?.object || {}),
        [objectStatus, daemon]
    );
    const allObjectNames = useMemo(
        () => Object.keys(objects).filter((key) => key && typeof objects[key] === "object"),
        [objects]
    );
    const namespaces = useMemo(() => Array.from(new Set(allObjectNames.map(extractNamespace))).sort(), [allObjectNames]);
    const kinds = useMemo(() => Array.from(new Set(allObjectNames.map(extractKind))).sort(), [allObjectNames]);
    const allNodes = useMemo(
        () =>
            Array.from(
                new Set(
                    Object.keys(objectInstanceStatus).flatMap((objectName) =>
                        Object.keys(objectInstanceStatus[objectName] || {})
                    )
                )
            ).sort(),
        [objectInstanceStatus]
    );
    const filteredObjectNames = useMemo(
        () =>
            allObjectNames.filter((name) => {
                const {avail, provisioned} = getObjectStatus(name, objects);
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
            }),
        [allObjectNames, selectedGlobalState, selectedNamespace, selectedKind, searchQuery, getObjectStatus, objects]
    );
    const sortedObjectNames = useMemo(() => {
        const statusOrder = {up: 3, warn: 2, down: 1, "n/a": 0};
        return [...filteredObjectNames].sort((a, b) => {
            let diff = 0;
            if (sortColumn === "object") {
                diff = a.localeCompare(b);
            } else if (sortColumn === "status") {
                const statusA = getObjectStatus(a, objects).avail || "n/a";
                const statusB = getObjectStatus(b, objects).avail || "n/a";
                diff = statusOrder[statusA] - statusOrder[statusB];
            } else if (allNodes.includes(sortColumn)) {
                const statusA = getNodeState(a, sortColumn).avail || "n/a";
                const statusB = getNodeState(b, sortColumn).avail || "n/a";
                diff = statusOrder[statusA] - statusOrder[statusB];
            }
            return sortDirection === "asc" ? diff : -diff;
        });
    }, [filteredObjectNames, sortColumn, sortDirection, getObjectStatus, objects, getNodeState, allNodes]);
    const debouncedUpdateQuery = useMemo(
        () =>
            debounce(() => {
                if (!isMounted.current) return;
                const newQueryParams = new URLSearchParams();
                if (selectedGlobalState !== "all") newQueryParams.set("globalState", selectedGlobalState);
                if (selectedNamespace !== "all") newQueryParams.set("namespace", selectedNamespace);
                if (selectedKind !== "all") newQueryParams.set("kind", selectedKind);
                if (searchQuery) newQueryParams.set("name", searchQuery);
                const queryString = newQueryParams.toString();
                const newUrl = `${location.pathname}${queryString ? `?${queryString}` : ""}`;
                if (newUrl !== location.pathname + location.search) {
                    navigate(newUrl, {replace: true});
                }
            }, 300),
        [selectedGlobalState, selectedNamespace, selectedKind, searchQuery, navigate, location.pathname, location.search]
    );
    useEffect(() => {
        debouncedUpdateQuery();
        return debouncedUpdateQuery.cancel;
    }, [debouncedUpdateQuery]);
    useEffect(() => {
        const newGlobalState = globalStates.includes(rawGlobalState) ? rawGlobalState : "all";
        const newNamespace = rawNamespace;
        const newKind = rawKind;
        const newSearchQuery = rawSearchQuery;
        setSelectedGlobalState(newGlobalState);
        setSelectedNamespace(newNamespace);
        setSelectedKind(newKind);
        setSearchQuery(newSearchQuery);
    }, [rawGlobalState, rawNamespace, rawKind, rawSearchQuery, globalStates]);
    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);
    const eventStarted = useRef(false);
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token && !eventStarted.current) {
            startEventReception(token, [
                "ObjectStatusUpdated",
                "InstanceStatusUpdated",
                "ObjectDeleted",
                "InstanceMonitorUpdated",
            ]);
            eventStarted.current = true;
        }
        return () => {
            closeEventSource();
            eventStarted.current = false;
        };
    }, []);
    const handleSelectObject = useCallback((event, objectName) => {
        setSelectedObjects((prev) =>
            event.target.checked ? [...prev, objectName] : prev.filter((obj) => obj !== objectName)
        );
    }, []);
    const handleActionsMenuOpen = useCallback((event) => {
        setActionsMenuAnchor(event.currentTarget);
    }, []);
    const handleActionsMenuClose = useCallback(() => {
        setActionsMenuAnchor(null);
    }, []);
    const handleRowMenuOpen = useCallback((event, objectName) => {
        setRowMenuAnchor(event.currentTarget);
        setCurrentObject(objectName);
    }, []);
    const handleRowMenuClose = useCallback(() => {
        setRowMenuAnchor(null);
        setCurrentObject(null);
    }, []);
    const handleActionClick = useCallback(
        (action, isSingleObject = false, objectName = null) => {
            setPendingAction({action, target: isSingleObject ? objectName : null});
            if (isSingleObject) handleRowMenuClose();
            else handleActionsMenuClose();
        },
        [handleRowMenuClose, handleActionsMenuClose]
    );
    const handleExecuteActionOnSelected = useCallback(
        async (action) => {
            const token = localStorage.getItem("authToken");
            if (!token) {
                setSnackbar({open: true, message: "Authentication token not found", severity: "error"});
                return;
            }
            setSnackbar({open: true, message: `Executing '${action}'...`, severity: "info"});
            let successCount = 0;
            let errorCount = 0;
            const objectsToProcess = pendingAction?.target ? [pendingAction.target] : selectedObjects;
            const promises = objectsToProcess.map(async (objectName) => {
                const rawObj = objectStatus[objectName];
                if (!rawObj) {
                    errorCount++;
                    return;
                }
                const {namespace, kind, name} = parseObjectName(objectName);
                if ((action === "freeze" && rawObj.frozen === "frozen") || (action === "unfreeze" && rawObj.frozen === "unfrozen")) {
                    errorCount++;
                    return;
                }
                const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/action/${action}`;
                try {
                    const response = await fetch(url, {
                        method: "POST",
                        headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
                    });
                    if (!response.ok) {
                        const error = new Error(`HTTP error! status: ${response.status}`);
                        logger.error(`Failed to execute ${action} on ${objectName}:`, error);
                        errorCount++;
                        return;
                    }
                    successCount++;
                    if (action === "delete") removeObject(objectName);
                } catch (error) {
                    logger.error(`Failed to execute ${action} on ${objectName}:`, error);
                    errorCount++;
                }
            });
            await Promise.all(promises);
            setSnackbar({
                open: true,
                message:
                    successCount && !errorCount
                        ? `'${action}' succeeded on ${successCount} object(s).`
                        : successCount
                            ? `'${action}' partially succeeded: ${successCount} ok, ${errorCount} errors.`
                            : `'${action}' failed on all ${objectsToProcess.length} object(s).`,
                severity: successCount && !errorCount ? "success" : successCount ? "warning" : "error",
            });
            setSelectedObjects([]);
            setPendingAction(null);
        },
        [pendingAction, selectedObjects, objectStatus, removeObject]
    );
    const handleObjectClick = useCallback(
        (objectName) => {
            if (objectInstanceStatus[objectName]) navigate(`/objects/${encodeURIComponent(objectName)}`);
        },
        [objectInstanceStatus, navigate]
    );
    const popperProps = useCallback(
        () => ({
            placement: "bottom-end",
            disablePortal: isSafari,
            modifiers: [
                {
                    name: "offset",
                    options: {offset: [0, 8 / getZoomLevel()]},
                },
                {name: "preventOverflow", options: {boundariesElement: "viewport"}},
                {name: "flip", options: {enabled: true}},
            ],
            sx: {
                zIndex: 1300,
                "& .MuiPaper-root": {minWidth: 200, boxShadow: "0px 5px 15px rgba(0,0,0,0.2)"},
            },
        }),
        [getZoomLevel]
    );
    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "background.default",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                p: 0,
                position: 'relative',
                width: '100vw',
                margin: 0,
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    borderRadius: 0,
                    boxShadow: 3,
                    p: 3,
                    m: 0,
                }}
            >

                {/* Filter controls */}
                <Box sx={{
                    position: "sticky",
                    top: 64,
                    zIndex: 10,
                    backgroundColor: "background.paper",
                    pt: 2,
                    pb: 1,
                    mb: 2
                }}>
                    <Box sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 2,
                    }}>
                        {/* Left section with Show Filters button and filters */}
                        <Box sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            flexGrow: 1,
                            overflowX: "auto",
                            py: 1
                        }}>
                            <Button
                                onClick={() => setShowFilters(!showFilters)}
                                aria-label={showFilters ? "Hide filters" : "Show filters"}
                                sx={{minWidth: 'auto', flexShrink: 0}}
                            >
                                {showFilters ? <ExpandLessIcon/> : <>Filters <ExpandMoreIcon/></>}
                            </Button>

                            {showFilters && (
                                <>
                                    <Autocomplete
                                        key={`global-state-${selectedGlobalState}`}
                                        sx={{minWidth: 200, flexShrink: 0}}
                                        options={globalStates}
                                        value={selectedGlobalState}
                                        onChange={(e, val) => val && setSelectedGlobalState(val)}
                                        renderInput={(params) => <TextField {...params} label="Global State"/>}
                                        renderOption={(props, option) => (
                                            <li {...props}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    {option === "up" &&
                                                        <FiberManualRecordIcon sx={{color: green[500], fontSize: 18}}/>}
                                                    {option === "down" &&
                                                        <FiberManualRecordIcon sx={{color: red[500], fontSize: 18}}/>}
                                                    {option === "warn" &&
                                                        <PriorityHighIcon sx={{color: orange[500], fontSize: 18}}/>}
                                                    {option === "n/a" &&
                                                        <FiberManualRecordIcon sx={{color: grey[500], fontSize: 18}}/>}
                                                    {option === "unprovisioned" &&
                                                        <PriorityHighIcon sx={{color: red[500], fontSize: 18}}/>}
                                                    {option === "all" ? "All" : option.charAt(0).toUpperCase() + option.slice(1)}
                                                </Box>
                                            </li>
                                        )}
                                    />
                                    <Autocomplete
                                        key={`namespace-${selectedNamespace}`}
                                        sx={{minWidth: 200, flexShrink: 0}}
                                        options={["all", ...namespaces]}
                                        value={selectedNamespace}
                                        onChange={(e, val) => val && setSelectedNamespace(val)}
                                        renderInput={(params) => <TextField {...params} label="Namespace"/>}
                                    />
                                    <Autocomplete
                                        key={`kind-${selectedKind}`}
                                        sx={{minWidth: 200, flexShrink: 0}}
                                        options={["all", ...kinds]}
                                        value={selectedKind}
                                        onChange={(e, val) => val && setSelectedKind(val)}
                                        renderInput={(params) => <TextField {...params} label="Kind"/>}
                                    />
                                    <TextField
                                        label="Name"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        sx={{minWidth: 200, flexShrink: 0}}
                                    />
                                </>
                            )}
                        </Box>

                        {/* Right section with Actions button */}
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleActionsMenuOpen}
                            disabled={!selectedObjects.length}
                            aria-label="Actions on selected objects"
                            sx={{flexShrink: 0}}
                        >
                            Actions on selected objects
                        </Button>
                    </Box>

                    <Popper open={Boolean(actionsMenuAnchor)} anchorEl={actionsMenuAnchor} {...popperProps()}>
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
                                                "&.Mui-disabled": {opacity: 0.5}
                                            }}
                                            aria-label={`${name} action for selected objects`}
                                        >
                                            <ListItemIcon
                                                sx={{color: isAllowed ? "inherit" : "text.disabled"}}>{icon}</ListItemIcon>
                                            <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                        </MenuItem>
                                    );
                                })}
                            </Paper>
                        </ClickAwayListener>
                    </Popper>
                </Box>
                {/* Objects table */}
                <TableContainer sx={{maxHeight: "60vh", overflow: "auto", boxShadow: "none", border: "none"}}>
                    <Table>
                        <TableHead sx={{
                            position: "sticky",
                            top: 0,
                            zIndex: 3,
                            backgroundColor: "background.paper"
                        }}>
                            <TableRow>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedObjects.length === filteredObjectNames.length}
                                        onChange={(e) => setSelectedObjects(e.target.checked ? filteredObjectNames : [])}
                                        aria-label="Select all objects"
                                    />
                                </TableCell>
                                <TableCell
                                    sx={{
                                        minWidth: "150px",
                                        width: "150px",
                                        position: "relative"
                                    }}
                                >
                                    <Box sx={{
                                        width: "100%",
                                        height: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between"
                                    }}>
                                        <Box
                                            sx={{
                                                width: "80px",
                                                display: "flex",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <strong>Status</strong>
                                        </Box>
                                        <Box sx={{width: "70px"}}></Box>
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Box sx={{display: "flex", alignItems: "center"}}>
                                        <strong>Object</strong>
                                    </Box>
                                </TableCell>
                                {isWideScreen &&
                                    allNodes.map((node) => (
                                        <TableCell
                                            key={node}
                                            sx={{
                                                minWidth: "130px",
                                                width: "130px",
                                                position: "relative"
                                            }}
                                        >
                                            <Box sx={{
                                                width: "100%",
                                                height: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between"
                                            }}>
                                                <Box
                                                    sx={{
                                                        width: "80px",
                                                        display: "flex",
                                                        justifyContent: "center",
                                                    }}
                                                >
                                                    <strong>{node}</strong>
                                                </Box>
                                                <Box sx={{width: "50px"}}></Box>
                                            </Box>
                                        </TableCell>
                                    ))}
                                <TableCell>
                                    <strong>Actions</strong>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedObjectNames.map((objectName) => (
                                <TableRowComponent
                                    key={objectName}
                                    objectName={objectName}
                                    selectedObjects={selectedObjects}
                                    handleSelectObject={handleSelectObject}
                                    handleObjectClick={handleObjectClick}
                                    handleRowMenuOpen={handleRowMenuOpen}
                                    rowMenuAnchor={rowMenuAnchor}
                                    currentObject={currentObject}
                                    getObjectStatus={getObjectStatus}
                                    getNodeState={getNodeState}
                                    allNodes={allNodes}
                                    isWideScreen={isWideScreen}
                                    popperProps={popperProps()}
                                    handleActionClick={handleActionClick}
                                    handleRowMenuClose={handleRowMenuClose}
                                    objects={objects}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                {filteredObjectNames.length === 0 && (
                    <Typography align="center" color="textSecondary" sx={{mt: 2}}>
                        No objects found matching the current filters.
                    </Typography>
                )}
                {/* Feedback and dialogs */}
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
                <ActionDialogManager
                    pendingAction={pendingAction}
                    handleConfirm={handleExecuteActionOnSelected}
                    target={pendingAction?.target ? `object ${pendingAction.target}` : `${selectedObjects.length} objects`}
                    supportedActions={OBJECT_ACTIONS.map((action) => action.name)}
                    onClose={() => setPendingAction(null)}
                />
            </Box>
            <EventLogger
                eventTypes={objectEventTypes}
                title="Object Events Logger"
                buttonLabel="Object Events"
            />
        </Box>
    );
};

export default Objects;
