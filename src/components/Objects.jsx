import React, {useEffect, useState, useMemo, useCallback, useRef, useDeferredValue} from "react";
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
    CircularProgress,
    Grid,
    Collapse,
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
import FilterListIcon from "@mui/icons-material/FilterList";
import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import logger from '../utils/logger.js';
import {closeEventSource, startEventReception} from "../eventSourceManager";
import {URL_OBJECT} from "../config/apiPath.js";
import {extractNamespace, extractKind, isActionAllowedForSelection} from "../utils/objectUtils";
import {OBJECT_ACTIONS} from "../constants/actions";
import ActionDialogManager from "./ActionDialogManager";
import EventLogger from "../components/EventLogger";
import {useObjectData} from "../hooks/useObjectData";
import {useNodeData} from "../hooks/useNodeData";

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
    <TextField {...params} label={label} fullWidth/>
);

const selectObjectStatus = (state) => state.objectStatus;
const selectObjectInstanceStatus = (state) => state.objectInstanceStatus;
const selectInstanceMonitor = (state) => state.instanceMonitor;
const selectRemoveObject = (state) => state.removeObject;

const StatusIcon = React.memo(({avail, isNotProvisioned, frozen}) => {
    return (
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
    );
}, (prev, next) => prev.avail === next.avail && prev.isNotProvisioned === next.isNotProvisioned && prev.frozen === next.frozen);

const GlobalExpectDisplay = React.memo(({globalExpect}) => {
    return (
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
    );
}, (prev, next) => prev.globalExpect === next.globalExpect);

const NodeStatusIcons = React.memo(({nodeAvail, isNodeNotProvisioned, nodeFrozen, node}) => {
    return (
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
                        <FiberManualRecordIcon sx={{color: green[500], fontSize: 24}}
                                               aria-label={`Node ${node} is up`}/>
                    </Tooltip>
                )}
                {nodeAvail === "down" && (
                    <Tooltip title="down">
                        <FiberManualRecordIcon sx={{color: red[500], fontSize: 24}}
                                               aria-label={`Node ${node} is down`}/>
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
    );
}, (prev, next) => prev.nodeAvail === next.nodeAvail && prev.isNodeNotProvisioned === next.isNodeNotProvisioned && prev.nodeFrozen === next.nodeFrozen && prev.node === next.node);

const NodeStateDisplay = React.memo(({nodeState, node}) => {
    return (
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
    );
}, (prev, next) => prev.nodeState === next.nodeState && prev.node === next.node);

const NodeStatus = React.memo(({objectName, node}) => {
    const nodeData = useNodeData(objectName, node);
    const isNodeNotProvisioned = nodeData?.provisioned === "false" || nodeData?.provisioned === false;
    return nodeData?.avail ? (
        <Box sx={{
            width: "130px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
        }}>
            <NodeStatusIcons
                nodeAvail={nodeData.avail}
                isNodeNotProvisioned={isNodeNotProvisioned}
                nodeFrozen={nodeData.frozen}
                node={node}
            />
            <NodeStateDisplay nodeState={nodeData.state} node={node}/>
        </Box>
    ) : (
        <Box sx={{width: "130px", display: "flex", justifyContent: "center", alignItems: "center"}}>
            <Typography variant="caption" color="textSecondary">-</Typography>
        </Box>
    );
}, (prev, next) => prev.objectName === next.objectName && prev.node === next.node);

const TableRowComponent = React.memo(({
                                          objectName,
                                          isSelected,
                                          onSelectObject,
                                          onObjectClick,
                                          onRowMenuOpen,
                                          isMenuOpen,
                                          allNodes,
                                          isWideScreen,
                                          onActionClick,
                                          onRowMenuClose,
                                      }) => {
    const objectData = useObjectData(objectName);
    const filteredActions = useMemo(
        () => OBJECT_ACTIONS.filter(
            ({name}) =>
                isActionAllowedForSelection(name, [objectName]) &&
                (name !== "freeze" || !objectData.isFrozen) &&
                (name !== "unfreeze" || objectData.hasAnyNodeFrozen)
        ),
        [objectName, objectData.isFrozen, objectData.hasAnyNodeFrozen]
    );
    const handleCheckboxChange = useCallback((e) => {
        onSelectObject(e, objectName);
    }, [onSelectObject, objectName]);
    const handleRowClick = useCallback(() => {
        onObjectClick(objectName);
    }, [onObjectClick, objectName]);
    const handleMenuOpen = useCallback((e) => {
        e.stopPropagation();
        onRowMenuOpen(e, objectName);
    }, [onRowMenuOpen, objectName]);
    const handleCheckboxClick = useCallback((e) => {
        e.stopPropagation();
    }, []);

    return (
        <TableRow onClick={handleRowClick} sx={{cursor: "pointer"}}>
            <TableCell sx={{paddingLeft: 2}}>
                <Checkbox
                    checked={isSelected}
                    onChange={handleCheckboxChange}
                    onClick={handleCheckboxClick}
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
                    <StatusIcon
                        avail={objectData.avail}
                        isNotProvisioned={objectData.isNotProvisioned}
                        frozen={objectData.frozen}
                    />
                    <GlobalExpectDisplay globalExpect={objectData.globalExpect}/>
                </Box>
            </TableCell>
            <TableCell>
                <Typography>{objectName}</Typography>
            </TableCell>
            {isWideScreen &&
                allNodes.map((node) => (
                    <TableCell key={node} align="center"
                               sx={{minWidth: "130px", width: "130px", position: "relative"}}>
                        <NodeStatus objectName={objectName} node={node}/>
                    </TableCell>
                ))}
            <TableCell>
                <IconButton onClick={handleMenuOpen} aria-label={`More actions for object ${objectName}`}>
                    <MoreVertIcon/>
                </IconButton>
                <Popper
                    open={isMenuOpen}
                    anchorEl={isMenuOpen ? document.activeElement : null}
                    placement="bottom-end"
                    disablePortal={isSafari}
                    sx={{
                        zIndex: 1300,
                        "& .MuiPaper-root": {minWidth: 200, boxShadow: "0px 5px 15px rgba(0,0,0,0.2)"}
                    }}
                >
                    <ClickAwayListener onClickAway={onRowMenuClose}>
                        <Paper elevation={3} role="menu">
                            {filteredActions.map(({name, icon}) => (
                                <MenuItem
                                    key={name}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onActionClick(name, true, objectName);
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
}, (prevProps, nextProps) => {
    return (
        prevProps.objectName === nextProps.objectName &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isMenuOpen === nextProps.isMenuOpen &&
        prevProps.isWideScreen === nextProps.isWideScreen &&
        prevProps.allNodes.length === nextProps.allNodes.length &&
        prevProps.allNodes.every((node, i) => node === nextProps.allNodes[i])
    );
});

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
    const objectStatus = useEventStore(selectObjectStatus);
    const objectInstanceStatus = useEventStore(selectObjectInstanceStatus);
    const instanceMonitor = useEventStore(selectInstanceMonitor);
    const removeObject = useEventStore(selectRemoveObject);
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
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
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

    const deferredSearchQuery = useDeferredValue(searchQuery);
    const deferredSelectedGlobalState = useDeferredValue(selectedGlobalState);
    const deferredSelectedNamespace = useDeferredValue(selectedNamespace);
    const deferredSelectedKind = useDeferredValue(selectedKind);
    const deferredSortColumn = useDeferredValue(sortColumn);
    const deferredSortDirection = useDeferredValue(sortDirection);

    const [visibleCount, setVisibleCount] = useState(30);
    const [loading, setLoading] = useState(false);
    const tableContainerRef = useRef(null);

    const objects = useMemo(
        () => (Object.keys(objectStatus).length ? objectStatus : daemon?.cluster?.object || {}),
        [objectStatus, daemon]
    );

    const allObjectNames = useMemo(
        () => Object.keys(objects).filter((key) => key && typeof objects[key] === "object"),
        [objects]
    );

    const {namespaces, kinds} = useMemo(() => {
        const nsSet = new Set();
        const kindSet = new Set();

        for (let i = 0; i < allObjectNames.length; i++) {
            const name = allObjectNames[i];
            nsSet.add(extractNamespace(name));
            kindSet.add(extractKind(name));
        }

        return {
            namespaces: Array.from(nsSet).sort(),
            kinds: Array.from(kindSet).sort()
        };
    }, [allObjectNames]);

    const allNodes = useMemo(() => {
        const nodeSet = new Set();
        const objNames = Object.keys(objectInstanceStatus);

        for (let i = 0; i < objNames.length; i++) {
            const nodes = Object.keys(objectInstanceStatus[objNames[i]] || {});
            for (let j = 0; j < nodes.length; j++) {
                nodeSet.add(nodes[j]);
            }
        }

        return Array.from(nodeSet).sort();
    }, [objectInstanceStatus]);

    const filteredObjectNames = useMemo(() => {
        const result = [];
        const searchLower = deferredSearchQuery.toLowerCase();
        const hasSearch = searchLower.length > 0;

        for (let i = 0; i < allObjectNames.length; i++) {
            const name = allObjectNames[i];

            // Early exit for search
            if (hasSearch && !name.toLowerCase().includes(searchLower)) {
                continue;
            }

            // Early exit for namespace
            if (deferredSelectedNamespace !== "all" && extractNamespace(name) !== deferredSelectedNamespace) {
                continue;
            }

            // Early exit for kind
            if (deferredSelectedKind !== "all" && extractKind(name) !== deferredSelectedKind) {
                continue;
            }

            // Check global state
            if (deferredSelectedGlobalState !== "all") {
                const status = objects[name];
                if (!status) continue;

                const rawAvail = status.avail;
                const validStatuses = ["up", "down", "warn"];
                const avail = validStatuses.includes(rawAvail) ? rawAvail : "n/a";
                const provisioned = status.provisioned;

                const matchesGlobalState = deferredSelectedGlobalState === "unprovisioned"
                    ? provisioned === "false" || provisioned === false
                    : avail === deferredSelectedGlobalState;

                if (!matchesGlobalState) continue;
            }

            result.push(name);
        }

        return result;
    }, [allObjectNames, deferredSelectedGlobalState, deferredSelectedNamespace,
        deferredSelectedKind, deferredSearchQuery, objects]);

    const sortedObjectNames = useMemo(() => {
        const statusOrder = {up: 3, warn: 2, down: 1, "n/a": 0};
        const validStatuses = ["up", "down", "warn"];

        return [...filteredObjectNames].sort((a, b) => {
            let diff = 0;
            if (deferredSortColumn === "object") {
                diff = a.localeCompare(b);
            } else if (deferredSortColumn === "status") {
                const statusA = objectStatus[a]?.avail || "n/a";
                const statusB = objectStatus[b]?.avail || "n/a";
                const availA = validStatuses.includes(statusA) ? statusA : "n/a";
                const availB = validStatuses.includes(statusB) ? statusB : "n/a";
                diff = (statusOrder[availA] || 0) - (statusOrder[availB] || 0);
            } else if (allNodes.includes(deferredSortColumn)) {
                const getNodeAvail = (objName) => {
                    return objectInstanceStatus[objName]?.[deferredSortColumn]?.avail || "n/a";
                };
                const statusA = getNodeAvail(a);
                const statusB = getNodeAvail(b);
                diff = (statusOrder[statusA] || 0) - (statusOrder[statusB] || 0);
            }
            return deferredSortDirection === "asc" ? diff : -diff;
        });
    }, [filteredObjectNames, deferredSortColumn, deferredSortDirection, objectStatus, objectInstanceStatus, allNodes]);

    const visibleObjectNames = useMemo(() => {
        return sortedObjectNames.slice(0, visibleCount);
    }, [sortedObjectNames, visibleCount]);

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
        setVisibleCount(30);
    }, []);

    const handleSearchChange = useCallback((e) => {
        setSearchQuery(e.target.value);
        setVisibleCount(30);
    }, []);

    const toggleShowFilters = useCallback(() => {
        setShowFilters(prev => !prev);
    }, []);

    const handleScroll = useCallback(() => {
        if (loading) return;

        const container = tableContainerRef.current;
        if (!container) return;

        const {scrollTop, scrollHeight, clientHeight} = container;
        const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

        if (scrollPercentage > 0.8 && visibleCount < sortedObjectNames.length) {
            setLoading(true);
            setTimeout(() => {
                setVisibleCount(prev => Math.min(prev + 30, sortedObjectNames.length));
                setLoading(false);
            }, 100);
        }
    }, [loading, visibleCount, sortedObjectNames.length]);

    useEffect(() => {
        const container = tableContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    useEffect(() => {
        setVisibleCount(30);
    }, [sortedObjectNames]);

    useEffect(() => {
        const timer = setTimeout(() => {
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
        }, 300);
        return () => clearTimeout(timer);
    }, [selectedGlobalState, selectedNamespace, selectedKind, searchQuery, navigate, location.pathname, location.search]);

    useEffect(() => {
        const newGlobalState = globalStates.includes(rawGlobalState) ? rawGlobalState : "all";
        setSelectedGlobalState(prev => prev !== newGlobalState ? newGlobalState : prev);
        setSelectedNamespace(prev => prev !== rawNamespace ? rawNamespace : prev);
        setSelectedKind(prev => prev !== rawKind ? rawKind : prev);
        setSearchQuery(prev => prev !== rawSearchQuery ? rawSearchQuery : prev);
    }, [rawGlobalState, rawNamespace, rawKind, rawSearchQuery, globalStates]);

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

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const handleSelectAll = useCallback((e) => {
        setSelectedObjects(e.target.checked ? filteredObjectNames : []);
    }, [filteredObjectNames]);

    const handleSnackbarClose = useCallback(() => {
        setSnackbar(prev => ({...prev, open: false}));
    }, []);

    const handleClosePendingAction = useCallback(() => {
        setPendingAction(null);
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
                p: {xs: 1, sm: 2, md: 3},
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
                    <Box sx={{
                        display: "flex",
                        flexDirection: {xs: "column", md: "row"},
                        justifyContent: "space-between",
                        alignItems: {xs: "stretch", md: "center"},
                        gap: 2
                    }}>
                        <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                            <Button
                                onClick={toggleShowFilters}
                                aria-label={showFilters ? "Hide filters" : "Show filters"}
                                sx={{minWidth: 'auto', flexShrink: 0}}
                                startIcon={<FilterListIcon/>}
                            >
                                <Box component="span" sx={{display: {xs: 'none', sm: 'inline'}}}>
                                    Filters
                                </Box>
                                {showFilters ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                            </Button>
                        </Box>

                        <Collapse in={showFilters} sx={{width: '100%'}}>
                            <Grid container spacing={2} sx={{mb: 2}}>
                                <Grid item xs={12} sm={6} md={4} lg={3}>
                                    <Autocomplete
                                        key={`global-state-${selectedGlobalState}`}
                                        fullWidth
                                        size={isMobile ? "small" : "medium"}
                                        options={globalStates}
                                        value={selectedGlobalState}
                                        onChange={(_event, val) => val && setSelectedGlobalState(val)}
                                        renderInput={renderTextField("Global State")}
                                        renderOption={(props, option) => (
                                            <li {...props}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    {option === "up" &&
                                                        <FiberManualRecordIcon sx={{color: green[500], fontSize: 18}}/>}
                                                    {option === "down" &&
                                                        <FiberManualRecordIcon sx={{color: red[500], fontSize: 18}}/>}
                                                    {option === "warn" && <FiberManualRecordIcon
                                                        sx={{color: orange[500], fontSize: 18}}/>}
                                                    {option === "n/a" &&
                                                        <FiberManualRecordIcon sx={{color: grey[500], fontSize: 18}}/>}
                                                    {option === "unprovisioned" &&
                                                        <PriorityHighIcon sx={{color: red[500], fontSize: 18}}/>}
                                                    {option === "all" ? "All" : option.charAt(0).toUpperCase() + option.slice(1)}
                                                </Box>
                                            </li>
                                        )}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={4} lg={3}>
                                    <Autocomplete
                                        key={`namespace-${selectedNamespace}`}
                                        fullWidth
                                        size={isMobile ? "small" : "medium"}
                                        options={["all", ...namespaces]}
                                        value={selectedNamespace}
                                        onChange={(_event, val) => val && setSelectedNamespace(val)}
                                        renderInput={renderTextField("Namespace")}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={4} lg={3}>
                                    <Autocomplete
                                        key={`kind-${selectedKind}`}
                                        fullWidth
                                        size={isMobile ? "small" : "medium"}
                                        options={["all", ...kinds]}
                                        value={selectedKind}
                                        onChange={(_event, val) => val && setSelectedKind(val)}
                                        renderInput={renderTextField("Kind")}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={4} lg={3}>
                                    <TextField
                                        label="Name"
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        fullWidth
                                        size={isMobile ? "small" : "medium"}
                                    />
                                </Grid>
                            </Grid>
                        </Collapse>

                        <Box sx={{display: "flex", justifyContent: {xs: "center", md: "flex-end"}}}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleActionsMenuOpen}
                                disabled={!selectedObjects.length}
                                aria-label="Actions on selected objects"
                                sx={{flexShrink: 0, whiteSpace: 'nowrap'}}
                                fullWidth={isMobile}
                            >
                                Actions ({selectedObjects.length})
                            </Button>
                        </Box>
                    </Box>
                    <Popper
                        open={Boolean(actionsMenuAnchor)}
                        anchorEl={actionsMenuAnchor}
                        placement="bottom-end"
                        disablePortal={isSafari}
                        sx={{
                            zIndex: 1300,
                            "& .MuiPaper-root": {minWidth: 200, boxShadow: "0px 5px 15px rgba(0,0,0,0.2)"}
                        }}
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
                                                "&.Mui-disabled": {opacity: 0.5}
                                            }}
                                            aria-label={`${name} action for selected objects`}
                                        >
                                            <ListItemIcon sx={{color: isAllowed ? "inherit" : "text.disabled"}}>
                                                {icon}
                                            </ListItemIcon>
                                            <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                        </MenuItem>
                                    );
                                })}
                            </Paper>
                        </ClickAwayListener>
                    </Popper>
                </Box>
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                    flexShrink: 0
                }}>
                    <Typography variant="body2" color="textSecondary">
                        Showing {visibleObjectNames.length} of {sortedObjectNames.length} objects
                    </Typography>
                </Box>
                <TableContainer
                    ref={tableContainerRef}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        overflow: "auto",
                        boxShadow: "none",
                        border: "none",
                        position: 'relative'
                    }}
                >
                    <Table sx={{position: 'relative'}}>
                        <TableHead sx={{position: "sticky", top: 0, zIndex: 20, backgroundColor: "background.paper"}}>
                            <TableRow>
                                <TableCell sx={{paddingLeft: 2}}>
                                    <Checkbox
                                        checked={selectedObjects.length === filteredObjectNames.length && filteredObjectNames.length > 0}
                                        onChange={handleSelectAll}
                                        aria-label="Select all objects"
                                    />
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
                            {visibleObjectNames.map((objectName) => (
                                <TableRowComponent
                                    key={objectName}
                                    objectName={objectName}
                                    isSelected={selectedObjects.includes(objectName)}
                                    onSelectObject={handleSelectObject}
                                    onObjectClick={handleObjectClick}
                                    onRowMenuOpen={handleRowMenuOpen}
                                    isMenuOpen={Boolean(rowMenuAnchor) && currentObject === objectName}
                                    allNodes={allNodes}
                                    isWideScreen={isWideScreen}
                                    onActionClick={handleActionClick}
                                    onRowMenuClose={handleRowMenuClose}
                                />
                            ))}
                        </TableBody>
                    </Table>
                    {loading && (
                        <Box sx={{display: 'flex', justifyContent: 'center', padding: 2}}>
                            <CircularProgress size={24}/>
                        </Box>
                    )}
                    {visibleObjectNames.length === 0 && (
                        <Typography align="center" color="textSecondary" sx={{mt: 2, p: 3}}>
                            No objects found matching the current filters.
                        </Typography>
                    )}
                </TableContainer>
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={4000}
                    onClose={handleSnackbarClose}
                    anchorOrigin={{vertical: "bottom", horizontal: "center"}}
                >
                    <Alert severity={snackbar.severity} onClose={handleSnackbarClose}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
                <ActionDialogManager
                    pendingAction={pendingAction}
                    handleConfirm={handleExecuteActionOnSelected}
                    target={pendingAction?.target ? `object ${pendingAction.target}` : `${selectedObjects.length} objects`}
                    supportedActions={OBJECT_ACTIONS.map((action) => action.name)}
                    onClose={handleClosePendingAction}
                />
            </Box>
            <EventLogger eventTypes={objectEventTypes} title="Object Events Logger" buttonLabel="Object Events"/>
        </Box>
    );
};

export default Objects;
