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
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import logger from '../utils/logger.js';
import {closeEventSource, startEventReception} from "../eventSourceManager";
import {URL_OBJECT} from "../config/apiPath.js";
import {extractNamespace, extractKind, isActionAllowedForSelection} from "../utils/objectUtils";
import {OBJECT_ACTIONS} from "../constants/actions";
import ActionDialogManager from "./ActionDialogManager";
import EventLogger from "../components/EventLogger";

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

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

const renderTextField = (label) => (params) => (
    <TextField {...params} label={label}/>
);

const StatusIcon = React.memo(({avail, isNotProvisioned, frozen}) => (
        <Box sx={{
            width: "80px",
            height: "24px",
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        }}>
            <Box sx={{position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 1}}>
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
                        <FiberManualRecordIcon sx={{color: orange[500], fontSize: 24}} aria-label="Object has warning"/>
                    </Tooltip>
                )}
                {avail === "n/a" && (
                    <Tooltip title="n/a">
                        <FiberManualRecordIcon sx={{color: grey[500], fontSize: 24}} aria-label="Object status is n/a"/>
                    </Tooltip>
                )}
            </Box>
            {isNotProvisioned && (
                <Box sx={{position: "absolute", left: "0px", top: "50%", transform: "translateY(-50%)", zIndex: 2}}>
                    <Tooltip title="Not Provisioned">
                        <PriorityHighIcon sx={{color: red[500], fontSize: 24}} aria-label="Object is not provisioned"/>
                    </Tooltip>
                </Box>
            )}
            {frozen === "frozen" && (
                <Box sx={{position: "absolute", right: "0px", top: "50%", transform: "translateY(-50%)", zIndex: 2}}>
                    <Tooltip title="frozen">
                        <AcUnit sx={{color: blue[600], fontSize: 24}} aria-label="Object is frozen"/>
                    </Tooltip>
                </Box>
            )}
        </Box>
    ), (prevProps, nextProps) =>
        prevProps.avail === nextProps.avail &&
        prevProps.isNotProvisioned === nextProps.isNotProvisioned &&
        prevProps.frozen === nextProps.frozen
);

const GlobalExpectDisplay = React.memo(({globalExpect}) => (
    <Box sx={{width: "70px", display: "flex", justifyContent: "center"}}>
        {globalExpect && (
            <Tooltip title={globalExpect}>
                <Typography variant="caption" sx={{
                    fontSize: "0.75rem",
                    lineHeight: "1.2",
                    maxWidth: "70px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                }}>
                    {globalExpect}
                </Typography>
            </Tooltip>
        )}
    </Box>
));

const NodeStatusIcons = React.memo(({nodeAvail, isNodeNotProvisioned, nodeFrozen, node}) => (
    <Box sx={{
        width: "80px",
        height: "24px",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
    }}>
        <Box sx={{position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 1}}>
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
                    <FiberManualRecordIcon sx={{color: orange[500], fontSize: 24}}
                                           aria-label={`Node ${node} has warning`}/>
                </Tooltip>
            )}
        </Box>
        {isNodeNotProvisioned && (
            <Box sx={{position: "absolute", left: "0px", top: "50%", transform: "translateY(-50%)", zIndex: 2}}>
                <Tooltip title="Not Provisioned">
                    <PriorityHighIcon sx={{color: red[500], fontSize: 24}}
                                      aria-label={`Node ${node} is not provisioned`}/>
                </Tooltip>
            </Box>
        )}
        {nodeFrozen === "frozen" && (
            <Box sx={{position: "absolute", right: "0px", top: "50%", transform: "translateY(-50%)", zIndex: 2}}>
                <Tooltip title="frozen">
                    <AcUnit sx={{color: blue[600], fontSize: 24}} aria-label={`Node ${node} is frozen`}/>
                </Tooltip>
            </Box>
        )}
    </Box>
));

const NodeStateDisplay = React.memo(({nodeState, node}) => (
    <Box sx={{width: "50px", display: "flex", justifyContent: "center"}}>
        {nodeState && (
            <Tooltip title={nodeState}>
                <Typography variant="caption" sx={{
                    fontSize: "0.75rem",
                    lineHeight: "1.2",
                    maxWidth: "50px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                }} aria-label={`Node ${node} state: ${nodeState}`}>
                    {nodeState}
                </Typography>
            </Tooltip>
        )}
    </Box>
));

const NodeStatus = React.memo(({objectName, node, getNodeState}) => {
    const {
        avail: nodeAvail,
        frozen: nodeFrozen,
        state: nodeState,
        provisioned: nodeProvisioned
    } = getNodeState(objectName, node);
    const isNodeNotProvisioned = nodeProvisioned === "false" || nodeProvisioned === false;
    return nodeAvail ? (
        <Box sx={{
            width: "130px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
        }}>
            <NodeStatusIcons nodeAvail={nodeAvail} isNodeNotProvisioned={isNodeNotProvisioned} nodeFrozen={nodeFrozen}
                             node={node}/>
            <NodeStateDisplay nodeState={nodeState} node={node}/>
        </Box>
    ) : (
        <Box sx={{width: "130px", display: "flex", justifyContent: "center", alignItems: "center"}}>
            <Typography variant="caption" color="textSecondary">-</Typography>
        </Box>
    );
}, (prevProps, nextProps) => {
    if (prevProps.objectName !== nextProps.objectName || prevProps.node !== nextProps.node) {
        return false;
    }
    const prevState = prevProps.getNodeState(prevProps.objectName, prevProps.node);
    const nextState = nextProps.getNodeState(nextProps.objectName, nextProps.node);
    return prevState.avail === nextState.avail &&
        prevState.frozen === nextState.frozen &&
        prevState.state === nextState.state &&
        prevState.provisioned === nextState.provisioned;
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
         objectStatus,
         getNodeState,
         allNodes,
         isWideScreen,
         handleActionClick,
         handleRowMenuClose,
     }) => {
        const status = objectStatus[objectName] || {};
        const rawAvail = status?.avail;
        const validStatuses = ["up", "down", "warn"];
        const avail = validStatuses.includes(rawAvail) ? rawAvail : "n/a";
        const frozen = status?.frozen;
        const provisioned = status?.provisioned;
        const globalExpect = status?.globalExpect;

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
                <TableCell sx={{minWidth: "150px", width: "150px", position: "relative", height: "100%"}}>
                    <Box sx={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                    }}>
                        <StatusIcon avail={avail} isNotProvisioned={isNotProvisioned} frozen={frozen}/>
                        <GlobalExpectDisplay globalExpect={globalExpect}/>
                    </Box>
                </TableCell>
                <TableCell>
                    <Typography>{objectName}</Typography>
                </TableCell>
                {isWideScreen &&
                    allNodes.map((node) => (
                        <TableCell key={node} align="center"
                                   sx={{minWidth: "130px", width: "130px", position: "relative"}}>
                            <NodeStatus objectName={objectName} node={node} getNodeState={getNodeState}/>
                        </TableCell>
                    ))}
                <TableCell>
                    <IconButton onClick={(e) => {
                        e.stopPropagation();
                        handleRowMenuOpen(e, objectName);
                    }} aria-label={`More actions for object ${objectName}`}>
                        <MoreVertIcon/>
                    </IconButton>
                    <Popper open={Boolean(rowMenuAnchor) && currentObject === objectName} anchorEl={rowMenuAnchor}
                            placement="bottom-end" disablePortal={isSafari} sx={{
                        zIndex: 1300,
                        "& .MuiPaper-root": {minWidth: 200, boxShadow: "0px 5px 15px rgba(0,0,0,0.2)"}
                    }}>
                        <ClickAwayListener onClickAway={handleRowMenuClose}>
                            <Paper elevation={3} role="menu">
                                {filteredActions.map(({name, icon}) => (
                                    <MenuItem key={name} onClick={(e) => {
                                        e.stopPropagation();
                                        handleActionClick(name, true, objectName);
                                    }} sx={{display: "flex", alignItems: "center", gap: 1}}
                                              aria-label={`${name} action for object ${objectName}`}>
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
    },
    (prevProps, nextProps) => {
        return (
            prevProps.objectName === nextProps.objectName &&
            prevProps.selectedObjects.includes(prevProps.objectName) === nextProps.selectedObjects.includes(nextProps.objectName) &&
            prevProps.rowMenuAnchor === nextProps.rowMenuAnchor &&
            prevProps.currentObject === nextProps.currentObject &&
            prevProps.isWideScreen === nextProps.isWideScreen &&
            prevProps.objectStatus[prevProps.objectName] === nextProps.objectStatus[nextProps.objectName] &&
            prevProps.allNodes.length === nextProps.allNodes.length
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
    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "info"});
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

    const debounce = useCallback((func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }, []);

    const objectStatusWithGlobalExpect = useMemo(() => {
        const result = {};
        for (const objName in objectStatus) {
            const obj = objectStatus[objName];
            const nodes = Object.keys(objectInstanceStatus[objName] || {});
            let globalExpect = null;

            for (const node of nodes) {
                const monitorKey = `${node}:${objName}`;
                const monitor = instanceMonitor[monitorKey];
                if (monitor?.global_expect && monitor.global_expect !== "none") {
                    globalExpect = monitor.global_expect;
                    break;
                }
            }

            result[objName] = {
                ...obj,
                globalExpect
            };
        }
        return result;
    }, [objectStatus, objectInstanceStatus, instanceMonitor]);

    const getNodeState = useCallback(
        (objectName, node) => {
            const instanceStatus = objectInstanceStatus[objectName];
            if (!instanceStatus) {
                return {avail: null, frozen: "unfrozen", state: null, provisioned: null};
            }

            const nodeInstanceStatus = instanceStatus[node];
            const monitorKey = `${node}:${objectName}`;
            const monitor = instanceMonitor[monitorKey] || {};

            return {
                avail: nodeInstanceStatus?.avail,
                frozen: nodeInstanceStatus?.frozen_at && nodeInstanceStatus.frozen_at !== "0001-01-01T00:00:00Z" ? "frozen" : "unfrozen",
                state: monitor.state !== "idle" ? monitor.state : null,
                provisioned: nodeInstanceStatus?.provisioned,
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
                const status = objectStatusWithGlobalExpect[name];
                if (!status) return false;

                const rawAvail = status.avail;
                const validStatuses = ["up", "down", "warn"];
                const avail = validStatuses.includes(rawAvail) ? rawAvail : "n/a";
                const provisioned = status.provisioned;

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
        [allObjectNames, selectedGlobalState, selectedNamespace, selectedKind, searchQuery, objectStatusWithGlobalExpect]
    );

    const sortedObjectNames = useMemo(() => {
        const statusOrder = {up: 3, warn: 2, down: 1, "n/a": 0};
        return [...filteredObjectNames].sort((a, b) => {
            let diff = 0;
            if (sortColumn === "object") {
                diff = a.localeCompare(b);
            } else if (sortColumn === "status") {
                const statusA = objectStatusWithGlobalExpect[a]?.avail || "n/a";
                const statusB = objectStatusWithGlobalExpect[b]?.avail || "n/a";
                const orderA = statusOrder[statusA] !== undefined ? statusOrder[statusA] : 0;
                const orderB = statusOrder[statusB] !== undefined ? statusOrder[statusB] : 0;
                diff = orderA - orderB;
            } else if (allNodes.includes(sortColumn)) {
                const statusA = getNodeState(a, sortColumn).avail || "n/a";
                const statusB = getNodeState(b, sortColumn).avail || "n/a";
                const orderA = statusOrder[statusA] !== undefined ? statusOrder[statusA] : 0;
                const orderB = statusOrder[statusB] !== undefined ? statusOrder[statusB] : 0;
                diff = orderA - orderB;
            }
            return sortDirection === "asc" ? diff : -diff;
        });
    }, [filteredObjectNames, sortColumn, sortDirection, objectStatusWithGlobalExpect, getNodeState, allNodes]);

    const isUpdating = useRef(false);

    const debouncedUpdateQuery = useMemo(
        () =>
            debounce(() => {
                if (!isMounted.current) return;

                const currentParams = new URLSearchParams(location.search);
                const currentGlobalState = currentParams.get("globalState") || "all";
                const currentNamespace = currentParams.get("namespace") || "all";
                const currentKind = currentParams.get("kind") || "all";
                const currentName = currentParams.get("name") || "";

                if (currentGlobalState === selectedGlobalState &&
                    currentNamespace === selectedNamespace &&
                    currentKind === selectedKind &&
                    currentName === searchQuery) {
                    return;
                }

                const newQueryParams = new URLSearchParams();
                if (selectedGlobalState !== "all") newQueryParams.set("globalState", selectedGlobalState);
                if (selectedNamespace !== "all") newQueryParams.set("namespace", selectedNamespace);
                if (selectedKind !== "all") newQueryParams.set("kind", selectedKind);
                if (searchQuery.trim()) newQueryParams.set("name", searchQuery.trim());

                const queryString = newQueryParams.toString();
                const newUrl = `${location.pathname}${queryString ? `?${queryString}` : ""}`;

                if (newUrl !== location.pathname + location.search) {
                    navigate(newUrl, {replace: true});
                }
            }, 300),
        [selectedGlobalState, selectedNamespace, selectedKind, searchQuery, navigate, location.pathname, location.search, debounce]
    );

    useEffect(() => {
        if (!isUpdating.current) {
            isUpdating.current = true;
            debouncedUpdateQuery();
            const timer = setTimeout(() => {
                isUpdating.current = false;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [debouncedUpdateQuery]);

    useEffect(() => {
        const newGlobalState = globalStates.includes(rawGlobalState) ? rawGlobalState : "all";
        const newNamespace = rawNamespace;
        const newKind = rawKind;
        const newSearchQuery = rawSearchQuery;

        setSelectedGlobalState(prev => prev !== newGlobalState ? newGlobalState : prev);
        setSelectedNamespace(prev => prev !== newNamespace ? newNamespace : prev);
        setSelectedKind(prev => prev !== newKind ? newKind : prev);
        setSearchQuery(prev => prev !== newSearchQuery ? newSearchQuery : prev);
    }, [rawGlobalState, rawNamespace, rawKind, rawSearchQuery, globalStates]);

    useEffect(() => {
        return () => {
            isMounted.current = false;
            if (debouncedUpdateQuery && typeof debouncedUpdateQuery.cancel === 'function') {
                debouncedUpdateQuery.cancel();
            }
        };
    }, [debouncedUpdateQuery]);

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

    const handleSort = useCallback((column) => {
        setSortColumn(prev => {
            if (prev === column) {
                setSortDirection(dir => dir === "asc" ? "desc" : "asc");
                return column;
            }
            setSortDirection("asc");
            return column;
        });
    }, []);

    const handleSearchChange = useCallback((e) => {
        setSearchQuery(e.target.value);
    }, []);

    return (
        <Box sx={{
            height: "100vh",
            bgcolor: "background.default",
            display: "flex",
            flexDirection: "column",
            p: 0,
            position: 'relative',
            width: '100vw',
            margin: 0,
            overflow: 'hidden'
        }}>
            <Box sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                bgcolor: "background.paper",
                border: "2px solid",
                borderColor: "divider",
                borderRadius: 0,
                boxShadow: 3,
                p: 3,
                m: 0,
                overflow: 'hidden'
            }}>
                <Box sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    backgroundColor: "background.paper",
                    pt: 2,
                    pb: 1,
                    mb: 2,
                    flexShrink: 0
                }}>
                    <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2}}>
                        <Box
                            sx={{display: "flex", alignItems: "center", gap: 2, flexGrow: 1, overflowX: "auto", py: 1}}>
                            <Button onClick={() => setShowFilters(!showFilters)}
                                    aria-label={showFilters ? "Hide filters" : "Show filters"}
                                    sx={{minWidth: 'auto', flexShrink: 0}}>
                                {showFilters ? <ExpandLessIcon/> : <>Filters <ExpandMoreIcon/></>}
                            </Button>
                            {showFilters && (
                                <>
                                    <Autocomplete key={`global-state-${selectedGlobalState}`}
                                                  sx={{minWidth: 200, flexShrink: 0}} options={globalStates}
                                                  value={selectedGlobalState}
                                                  onChange={(_event, val) => val && setSelectedGlobalState(val)}
                                                  renderInput={renderTextField("Global State")}
                                                  renderOption={(props, option) => (
                                                      <li {...props}>
                                                          <Box display="flex" alignItems="center" gap={1}>
                                                              {option === "up" && <FiberManualRecordIcon
                                                                  sx={{color: green[500], fontSize: 18}}/>}
                                                              {option === "down" && <FiberManualRecordIcon
                                                                  sx={{color: red[500], fontSize: 18}}/>}
                                                              {option === "warn" && <FiberManualRecordIcon
                                                                  sx={{color: orange[500], fontSize: 18}}/>}
                                                              {option === "n/a" && <FiberManualRecordIcon
                                                                  sx={{color: grey[500], fontSize: 18}}/>}
                                                              {option === "unprovisioned" && <PriorityHighIcon
                                                                  sx={{color: red[500], fontSize: 18}}/>}
                                                              {option === "all" ? "All" : option.charAt(0).toUpperCase() + option.slice(1)}
                                                          </Box>
                                                      </li>
                                                  )}/>
                                    <Autocomplete key={`namespace-${selectedNamespace}`}
                                                  sx={{minWidth: 200, flexShrink: 0}} options={["all", ...namespaces]}
                                                  value={selectedNamespace}
                                                  onChange={(_event, val) => val && setSelectedNamespace(val)}
                                                  renderInput={renderTextField("Namespace")}/>
                                    <Autocomplete key={`kind-${selectedKind}`} sx={{minWidth: 200, flexShrink: 0}}
                                                  options={["all", ...kinds]} value={selectedKind}
                                                  onChange={(_event, val) => val && setSelectedKind(val)}
                                                  renderInput={renderTextField("Kind")}/>
                                    <TextField label="Name" value={searchQuery}
                                               onChange={handleSearchChange}
                                               sx={{minWidth: 200, flexShrink: 0}}/>
                                </>
                            )}
                        </Box>
                        <Button variant="contained" color="primary" onClick={handleActionsMenuOpen}
                                disabled={!selectedObjects.length} aria-label="Actions on selected objects"
                                sx={{flexShrink: 0}}>
                            Actions on selected objects
                        </Button>
                    </Box>
                    <Popper open={Boolean(actionsMenuAnchor)} anchorEl={actionsMenuAnchor} placement="bottom-end"
                            disablePortal={isSafari} sx={{
                        zIndex: 1300,
                        "& .MuiPaper-root": {minWidth: 200, boxShadow: "0px 5px 15px rgba(0,0,0,0.2)"}
                    }}>
                        <ClickAwayListener onClickAway={handleActionsMenuClose}>
                            <Paper elevation={3} role="menu">
                                {OBJECT_ACTIONS.map(({name, icon}) => {
                                    const isAllowed = isActionAllowedForSelection(name, selectedObjects);
                                    return (
                                        <MenuItem key={name} onClick={() => handleActionClick(name)}
                                                  disabled={!isAllowed} sx={{
                                            color: isAllowed ? "inherit" : "text.disabled",
                                            "&.Mui-disabled": {opacity: 0.5}
                                        }} aria-label={`${name} action for selected objects`}>
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
                <TableContainer sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                    boxShadow: "none",
                    border: "none",
                    position: 'relative'
                }}>
                    <Table sx={{position: 'relative'}}>
                        <TableHead sx={{position: "sticky", top: 0, zIndex: 20, backgroundColor: "background.paper"}}>
                            <TableRow>
                                <TableCell sx={{paddingLeft: 2}}>
                                    <Checkbox checked={selectedObjects.length === filteredObjectNames.length}
                                              onChange={(e) => setSelectedObjects(e.target.checked ? filteredObjectNames : [])}
                                              aria-label="Select all objects"/>
                                </TableCell>
                                <TableCell sx={{
                                    minWidth: "150px",
                                    width: "150px",
                                    position: "relative",
                                    cursor: "pointer",
                                    paddingLeft: 2
                                }} onClick={() => handleSort("status")}>
                                    <Box sx={{
                                        width: "100%",
                                        height: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between"
                                    }}>
                                        <Box sx={{
                                            width: "80px",
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            gap: 0.5
                                        }}>
                                            <strong>Status</strong>
                                            {sortColumn === "status" && (sortDirection === "asc" ?
                                                <KeyboardArrowUpIcon fontSize="small"/> :
                                                <KeyboardArrowDownIcon fontSize="small"/>)}
                                        </Box>
                                        <Box sx={{width: "70px"}}></Box>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{cursor: "pointer", paddingLeft: 2}}
                                           onClick={() => handleSort("object")}>
                                    <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                                        <strong>Object</strong>
                                        {sortColumn === "object" && (sortDirection === "asc" ?
                                            <KeyboardArrowUpIcon fontSize="small"/> :
                                            <KeyboardArrowDownIcon fontSize="small"/>)}
                                    </Box>
                                </TableCell>
                                {isWideScreen && allNodes.map((node) => (
                                    <TableCell key={node} sx={{
                                        minWidth: "130px",
                                        width: "130px",
                                        position: "relative",
                                        cursor: "pointer",
                                        paddingLeft: 2
                                    }} onClick={() => handleSort(node)}>
                                        <Box sx={{
                                            width: "100%",
                                            height: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between"
                                        }}>
                                            <Box sx={{
                                                width: "80px",
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                gap: 0.5
                                            }}>
                                                <strong>{node}</strong>
                                                {sortColumn === node && (sortDirection === "asc" ?
                                                    <KeyboardArrowUpIcon fontSize="small"/> :
                                                    <KeyboardArrowDownIcon fontSize="small"/>)}
                                            </Box>
                                            <Box sx={{width: "50px"}}></Box>
                                        </Box>
                                    </TableCell>
                                ))}
                                <TableCell sx={{paddingLeft: 2}}>
                                    <strong>Actions</strong>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedObjectNames.map((objectName) => (
                                <TableRowComponent key={objectName} objectName={objectName}
                                                   selectedObjects={selectedObjects}
                                                   handleSelectObject={handleSelectObject}
                                                   handleObjectClick={handleObjectClick}
                                                   handleRowMenuOpen={handleRowMenuOpen} rowMenuAnchor={rowMenuAnchor}
                                                   currentObject={currentObject}
                                                   objectStatus={objectStatusWithGlobalExpect}
                                                   getNodeState={getNodeState} allNodes={allNodes}
                                                   isWideScreen={isWideScreen} handleActionClick={handleActionClick}
                                                   handleRowMenuClose={handleRowMenuClose}/>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                {filteredObjectNames.length === 0 && (
                    <Typography align="center" color="textSecondary" sx={{mt: 2}}>
                        No objects found matching the current filters.
                    </Typography>
                )}
                <Snackbar open={snackbar.open} autoHideDuration={4000}
                          onClose={() => setSnackbar({...snackbar, open: false})}
                          anchorOrigin={{vertical: "bottom", horizontal: "center"}}>
                    <Alert severity={snackbar.severity} onClose={() => setSnackbar({...snackbar, open: false})}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
                <ActionDialogManager pendingAction={pendingAction} handleConfirm={handleExecuteActionOnSelected}
                                     target={pendingAction?.target ? `object ${pendingAction.target}` : `${selectedObjects.length} objects`}
                                     supportedActions={OBJECT_ACTIONS.map((action) => action.name)}
                                     onClose={() => setPendingAction(null)}/>
            </Box>
            <EventLogger eventTypes={objectEventTypes} title="Object Events Logger" buttonLabel="Object Events"/>
        </Box>
    );
};

export default Objects;
