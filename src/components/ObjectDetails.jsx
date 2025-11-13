import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useParams} from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    ClickAwayListener,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Paper,
    Popper,
    Snackbar,
    Typography,
    Drawer,
    IconButton,
    TextField,
    useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {green, grey, orange, red} from "@mui/material/colors";
import useEventStore from "../hooks/useEventStore.js";
import {closeEventSource, startEventReception} from "../eventSourceManager.jsx";
import {URL_NODE, URL_OBJECT} from "../config/apiPath.js";
import ActionDialogManager from "../components/ActionDialogManager";
import {ManageConfigParamsDialog} from "./ActionDialogs";
import HeaderSection from "./HeaderSection";
import ConfigSection from "./ConfigSection";
import KeysSection from "./KeysSection";
import NodeCard from "./NodeCard";
import LogsViewer from "./LogsViewer";
import {INSTANCE_ACTIONS, OBJECT_ACTIONS, RESOURCE_ACTIONS} from "../constants/actions";
import {parseObjectPath} from "../utils/objectUtils.jsx";

// Constants for default checkboxes
const DEFAULT_CHECKBOXES = {failover: false};
const DEFAULT_STOP_CHECKBOX = false;
const DEFAULT_UNPROVISION_CHECKBOXES = {dataLoss: false, serviceInterruption: false};
const DEFAULT_PURGE_CHECKBOXES = {dataLoss: false, configLoss: false, serviceInterruption: false};
// Helper function to filter resource actions based on type
export const getFilteredResourceActions = (resourceType) => {
    if (!resourceType) {
        return RESOURCE_ACTIONS;
    }
    const typePrefix = resourceType.split('.')[0].toLowerCase();
    if (typePrefix === 'task') {
        return RESOURCE_ACTIONS.filter(action => action.name === 'run');
    }
    if (['fs', 'disk', 'app'].includes(typePrefix)) {
        return RESOURCE_ACTIONS.filter(action => action.name !== 'run' && action.name !== 'console');
    }
    if (typePrefix === 'container') {
        return RESOURCE_ACTIONS.filter(action => action.name !== 'run');
    }
    return RESOURCE_ACTIONS;
};
// Helper function to get resource type for a given resource ID
export const getResourceType = (rid, nodeData) => {
    if (!rid || !nodeData) {
        return '';
    }
    const topLevelType = nodeData?.resources?.[rid]?.type;
    if (topLevelType) {
        return topLevelType;
    }
    const encapData = nodeData?.encap || {};
    for (const containerId of Object.keys(encapData)) {
        const encapType = encapData[containerId]?.resources?.[rid]?.type;
        if (encapType) {
            return encapType;
        }
    }
    return '';
};
// Helper function to parse provisioned state
export const parseProvisionedState = (state) => {
    if (typeof state === "string") {
        return state.toLowerCase() === "true";
    }
    return !!state;
};
const ObjectDetail = () => {
    const {objectName} = useParams();
    const decodedObjectName = decodeURIComponent(objectName);
    const {namespace, kind, name} = parseObjectPath(decodedObjectName);
    const objectStatus = useEventStore((s) => s.objectStatus);
    const objectInstanceStatus = useEventStore((s) => s.objectInstanceStatus);
    const instanceMonitor = useEventStore((s) => s.instanceMonitor);
    const instanceConfig = useEventStore((s) => s.instanceConfig);
    const clearConfigUpdate = useEventStore((s) => s.clearConfigUpdate);
    const objectData = objectInstanceStatus?.[decodedObjectName];
    const theme = useTheme();
    // States for configuration
    const [configData, setConfigData] = useState(null);
    const [configLoading, setConfigLoading] = useState(false);
    const [configError, setConfigError] = useState(null);
    const [configAccordionExpanded, setConfigAccordionExpanded] = useState(false);
    const [manageParamsDialogOpen, setManageParamsDialogOpen] = useState(false);
    const [paramsToSet, setParamsToSet] = useState("");
    const [paramsToUnset, setParamsToUnset] = useState("");
    const [paramsToDelete, setParamsToDelete] = useState("");
    const [configNode, setConfigNode] = useState(null);
    // States for batch & actions
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [nodesActionsAnchor, setNodesActionsAnchor] = useState(null);
    const nodesActionsAnchorRef = useRef(null);
    const [individualNodeMenuAnchor, setIndividualNodeMenuAnchor] = useState(null);
    const individualNodeMenuAnchorRef = useRef(null);
    const [currentNode, setCurrentNode] = useState(null);
    const [selectedResourcesByNode, setSelectedResourcesByNode] = useState({});
    const [resGroupNode, setResGroupNode] = useState(null);
    const [resourcesActionsAnchor, setResourcesActionsAnchor] = useState(null);
    const resourcesActionsAnchorRef = useRef(null);
    const [resourceMenuAnchor, setResourceMenuAnchor] = useState(null);
    const resourceMenuAnchorRef = useRef(null);
    const [currentResourceId, setCurrentResourceId] = useState(null);
    // States for dialogs & snackbar
    const [objectMenuAnchor, setObjectMenuAnchor] = useState(null);
    const objectMenuAnchorRef = useRef(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [actionInProgress, setActionInProgress] = useState(false);
    // States for dialog management
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [unprovisionDialogOpen, setUnprovisionDialogOpen] = useState(false);
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
    const [consoleDialogOpen, setConsoleDialogOpen] = useState(false);
    const [seats, setSeats] = useState(1);
    const [greetTimeout, setGreetTimeout] = useState("5s");
    const [checkboxes, setCheckboxes] = useState(DEFAULT_CHECKBOXES);
    const [stopCheckbox, setStopCheckbox] = useState(DEFAULT_STOP_CHECKBOX);
    const [unprovisionCheckboxes, setUnprovisionCheckboxes] = useState(DEFAULT_UNPROVISION_CHECKBOXES);
    const [purgeCheckboxes, setPurgeCheckboxes] = useState(DEFAULT_PURGE_CHECKBOXES);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "success",
    });
    // States for accordion expansion
    const [expandedResources, setExpandedResources] = useState({});
    const [expandedNodeResources, setExpandedNodeResources] = useState({});
    // States for initial loading
    const [initialLoading, setInitialLoading] = useState(true);
    // States for logs drawer
    const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);
    const [selectedNodeForLogs, setSelectedNodeForLogs] = useState(null);
    const [selectedInstanceForLogs, setSelectedInstanceForLogs] = useState(null);
    const [drawerWidth, setDrawerWidth] = useState(600);
    const minDrawerWidth = 300;
    const maxDrawerWidth = window.innerWidth * 0.8;
    // Refs for debounce and mounted
    const lastFetch = useRef({});
    const isProcessingConfigUpdate = useRef(false);
    const isMounted = useRef(true);
    // States for console URL display
    const [consoleUrlDialogOpen, setConsoleUrlDialogOpen] = useState(false);
    const [currentConsoleUrl, setCurrentConsoleUrl] = useState(null);
    // Configuration of Popper props
    const popperProps = {
        placement: "bottom-end",
        disablePortal: true,
        modifiers: [
            {
                name: "offset",
                options: {
                    offset: [0, 8],
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
    };
    // Cleanup on unmount
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            closeEventSource();
        };
    }, [decodedObjectName]);
    // Initialize and update accordion states for nodes and resources
    useEffect(() => {
        if (!objectData || !isMounted.current) return;
        const nodes = Object.keys(objectInstanceStatus[decodedObjectName] || {});
        const updateNodeResources = (prev) => {
            const updated = {...prev};
            nodes.forEach((node) => {
                if (!(node in updated)) {
                    updated[node] = false;
                }
            });
            Object.keys(updated).forEach((node) => {
                if (!nodes.includes(node)) {
                    delete updated[node];
                }
            });
            return updated;
        };
        const updateResources = (prev) => {
            const updated = {...prev};
            nodes.forEach((node) => {
                const resources = objectInstanceStatus[decodedObjectName]?.[node]?.resources || {};
                Object.keys(resources).forEach((rid) => {
                    const key = `${node}:${rid}`;
                    if (!(key in updated)) {
                        updated[key] = false;
                    }
                });
            });
            Object.keys(updated).forEach((key) => {
                const [node] = key.split(":");
                if (
                    !nodes.includes(node) ||
                    !(objectInstanceStatus[decodedObjectName]?.[node]?.resources?.[key.split(":")[1]])
                ) {
                    delete updated[key];
                }
            });
            return updated;
        };
        setExpandedNodeResources((prev) => {
            const updated = updateNodeResources(prev);
            return JSON.stringify(prev) !== JSON.stringify(updated) ? updated : prev;
        });
        setExpandedResources((prev) => {
            const updated = updateResources(prev);
            return JSON.stringify(prev) !== JSON.stringify(updated) ? updated : prev;
        });
    }, [objectData, objectInstanceStatus, decodedObjectName]);
    // Function to open snackbar
    const openSnackbar = useCallback((msg, sev = "success") => {
        setSnackbar({open: true, message: msg, severity: sev});
    }, []);
    const closeSnackbar = useCallback(() => {
        setSnackbar((s) => ({...s, open: false}));
    }, []);
    // Function to open action dialogs
    const openActionDialog = useCallback((action, context = null) => {
        setPendingAction({action, ...(context ? context : {})});
        setSeats(1);
        setGreetTimeout("5s");
        if (action === "console") {
            setConsoleDialogOpen(true);
        } else if (action === "freeze") {
            setCheckboxes(DEFAULT_CHECKBOXES);
            setConfirmDialogOpen(true);
        } else if (action === "stop") {
            setStopCheckbox(DEFAULT_STOP_CHECKBOX);
            setStopDialogOpen(true);
        } else if (action === "unprovision") {
            setUnprovisionCheckboxes(DEFAULT_UNPROVISION_CHECKBOXES);
            setUnprovisionDialogOpen(true);
        } else if (action === "purge") {
            setPurgeCheckboxes(DEFAULT_PURGE_CHECKBOXES);
            setPurgeDialogOpen(true);
        } else {
            setSimpleDialogOpen(true);
        }
    }, []);
    const postActionUrl = useCallback(({node, objectName, action}) => {
        const {namespace, kind, name} = parseObjectPath(objectName);
        return `${URL_NODE}/${node}/instance/path/${namespace}/${kind}/${name}/action/${action}`;
    }, []);
    const postConsoleAction = useCallback(async ({node, rid, seats = 1, greet_timeout = "5s"}) => {
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }
        setActionInProgress(true);
        openSnackbar(`Opening console for resource ${rid}...`, "info");
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const url = `${URL_NODE}/${node}/instance/path/${namespace}/${kind}/${name}/console?rid=${encodeURIComponent(rid)}&seats=${seats}&greet_timeout=${encodeURIComponent(greet_timeout)}`;
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
            });
            if (!response.ok) {
                openSnackbar(`Failed to open console: HTTP error! status: ${response.status}`, "error");
                return;
            }
            const consoleUrl = response.headers.get('Location');
            if (consoleUrl) {
                setCurrentConsoleUrl(consoleUrl);
                setConsoleUrlDialogOpen(true);
                openSnackbar(`Console URL retrieved for resource '${rid}'`);
            } else {
                openSnackbar('Failed to open console: Console URL not found in response', "error");
            }
        } catch (err) {
            openSnackbar(`Failed to open console: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    }, [decodedObjectName, openSnackbar]);
    const postObjectAction = useCallback(async ({action}) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");
        setActionInProgress(true);
        openSnackbar(`Executing ${action} on object…`, "info");
        const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/action/${action}`;
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!res.ok) {
                openSnackbar(`Failed to execute ${action}: HTTP error! status: ${res.status}`, "error");
                return;
            }
            openSnackbar(`'${action}' succeeded on object`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    }, [decodedObjectName, openSnackbar]);
    const postNodeAction = useCallback(async ({node, action}) => {
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");
        setActionInProgress(true);
        openSnackbar(`Executing ${action} on node ${node}…`, "info");
        const url = postActionUrl({node, objectName: decodedObjectName, action});
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!res.ok) {
                openSnackbar(`Failed to execute ${action}: HTTP error! status: ${res.status}`, "error");
                return;
            }
            openSnackbar(`'${action}' succeeded on node '${node}'`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    }, [decodedObjectName, openSnackbar, postActionUrl]);
    const postResourceAction = useCallback(async ({node, action, rid}) => {
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");
        setActionInProgress(true);
        openSnackbar(`Executing ${action} on resource ${rid}…`, "info");
        const url =
            postActionUrl({node, objectName: decodedObjectName, action}) +
            `?rid=${encodeURIComponent(rid)}`;
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!res.ok) {
                openSnackbar(`Failed to execute ${action}: HTTP error! status: ${res.status}`, "error");
                return;
            }
            openSnackbar(`'${action}' succeeded on resource '${rid}'`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    }, [decodedObjectName, openSnackbar, postActionUrl]);
    // Fetch configuration for the object
    const fetchConfig = useCallback(async (node) => {
        if (!node || !decodedObjectName) {
            setConfigError("No node or object available to fetch configuration.");
            return;
        }
        const key = `${decodedObjectName}:${node}`;
        const now = Date.now();
        if (lastFetch.current[key] && now - lastFetch.current[key] < 1000) {
            return;
        }
        lastFetch.current[key] = now;
        if (configLoading) {
            return;
        }
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            setConfigError("Auth token not found.");
            return;
        }
        setConfigLoading(true);
        setConfigError(null);
        setConfigNode(node);
        const url = `${URL_NODE}/${node}/instance/path/${namespace}/${kind}/${name}/config/file`;
        try {
            const response = await Promise.race([
                fetch(url, {
                    headers: {Authorization: `Bearer ${token}`},
                    cache: "no-cache",
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Fetch config timeout")), 10000)),
            ]);
            if (!response.ok) {
                setConfigError(`Failed to fetch config: HTTP error! status: ${response.status}`);
                return;
            }
            const text = await response.text();
            if (isMounted.current) {
                setConfigData(text);
            }
            return text;
        } catch (err) {
            if (isMounted.current) {
                setConfigError(err.message);
            }
        } finally {
            if (isMounted.current) {
                setConfigLoading(false);
            }
        }
    }, [decodedObjectName, configLoading]);
    // Color helper
    const getColor = useCallback((status) => {
        if (status === "up" || status === true) return green[500];
        if (status === "down" || status === false) return red[500];
        if (status === "warn") return orange[500];
        return grey[500];
    }, []);
    // Node state helper
    const getNodeState = useCallback((node) => {
        const instanceStatus = objectInstanceStatus[decodedObjectName] || {};
        const monitorKey = `${node}:${decodedObjectName}`;
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
    }, [objectInstanceStatus, instanceMonitor, decodedObjectName]);
    // Object status helper
    const getObjectStatus = useCallback(() => {
        const obj = objectStatus[decodedObjectName] || {};
        const avail = obj?.avail;
        const frozen = obj?.frozen;
        const nodes = Object.keys(objectInstanceStatus[decodedObjectName] || {});
        let globalExpect = null;
        for (const node of nodes) {
            const monitorKey = `${node}:${decodedObjectName}`;
            const monitor = instanceMonitor[monitorKey] || {};
            if (monitor.global_expect && monitor.global_expect !== "none") {
                globalExpect = monitor.global_expect;
                break;
            }
        }
        return {avail, frozen, globalExpect};
    }, [objectStatus, objectInstanceStatus, instanceMonitor, decodedObjectName]);
    // Accordion handlers
    const handleNodeResourcesAccordionChange = useCallback((node) => (event, isExpanded) => {
        setExpandedNodeResources((prev) => ({
            ...prev,
            [node]: isExpanded,
        }));
    }, []);
    const handleAccordionChange = useCallback((node, rid) => (event, isExpanded) => {
        setExpandedResources((prev) => ({
            ...prev,
            [`${node}:${rid}`]: isExpanded,
        }));
    }, []);
    // Batch node actions handlers
    const handleNodesActionsOpen = useCallback((e) => {
        setNodesActionsAnchor(e.currentTarget);
        nodesActionsAnchorRef.current = e.currentTarget;
    }, []);
    const handleNodesActionsClose = useCallback(() => {
        setNodesActionsAnchor(null);
        nodesActionsAnchorRef.current = null;
    }, []);
    const handleBatchNodeActionClick = useCallback((action) => {
        openActionDialog(action, {batch: "nodes"});
        handleNodesActionsClose();
    }, [openActionDialog, handleNodesActionsClose]);
    // Individual node actions handlers
    const handleIndividualNodeActionClick = useCallback((action) => {
        if (!currentNode) {
            console.warn("No valid pendingAction or action provided: No current node");
            return;
        }
        openActionDialog(action, {node: currentNode});
        setIndividualNodeMenuAnchor(null);
    }, [openActionDialog, currentNode]);
    // Batch resource actions handlers
    const handleResourcesActionsOpen = useCallback((node, e) => {
        setResGroupNode(node);
        setResourcesActionsAnchor(e.currentTarget);
        resourcesActionsAnchorRef.current = e.currentTarget;
    }, []);
    const handleResourcesActionsClose = useCallback(() => {
        setResourcesActionsAnchor(null);
        resourcesActionsAnchorRef.current = null;
    }, []);
    const handleBatchResourceActionClick = useCallback((action) => {
        if (!resGroupNode) {
            console.warn("No valid pendingAction or action provided: No resGroupNode");
            return;
        }
        if (action === "console") {
            openSnackbar("Console action is not available for multiple resources", "warning");
            return;
        }
        openActionDialog(action, {batch: "resources", node: resGroupNode});
        handleResourcesActionsClose();
    }, [openActionDialog, resGroupNode, handleResourcesActionsClose, openSnackbar]);
    // Individual resource actions handlers
    const handleResourceMenuOpen = useCallback((node, rid, e) => {
        setCurrentResourceId(rid);
        setResGroupNode(node);
        setResourceMenuAnchor(e.currentTarget);
        resourceMenuAnchorRef.current = e.currentTarget;
    }, []);
    const handleResourceMenuClose = useCallback(() => {
        setResourceMenuAnchor(null);
        setCurrentResourceId(null);
        resourceMenuAnchorRef.current = null;
    }, []);
    const handleResourceActionClick = useCallback((action) => {
        if (!resGroupNode || !currentResourceId) {
            console.warn("No valid pendingAction or action provided: No resource details");
            return;
        }
        openActionDialog(action, {node: resGroupNode, rid: currentResourceId});
        handleResourceMenuClose();
    }, [openActionDialog, resGroupNode, currentResourceId, handleResourceMenuClose]);
    // Object action handler
    const handleObjectActionClick = useCallback((action) => {
        openActionDialog(action);
        setObjectMenuAnchor(null);
    }, [openActionDialog]);
    // Dialog confirm handler
    const handleDialogConfirm = useCallback(() => {
        if (!pendingAction || !pendingAction.action) {
            console.warn("No valid pendingAction or action provided:", pendingAction);
            setPendingAction(null);
            setConfirmDialogOpen(false);
            setStopDialogOpen(false);
            setUnprovisionDialogOpen(false);
            setPurgeDialogOpen(false);
            setSimpleDialogOpen(false);
            return;
        }
        if (pendingAction.batch === "nodes") {
            selectedNodes.forEach((node) => {
                if (node) postNodeAction({node, action: pendingAction.action});
            });
            setSelectedNodes([]);
        } else if (pendingAction.node && !pendingAction.rid) {
            postNodeAction({node: pendingAction.node, action: pendingAction.action});
        } else if (pendingAction.batch === "resources") {
            const rids = selectedResourcesByNode[pendingAction.node] || [];
            rids.forEach((rid) => {
                if (rid) postResourceAction({
                    node: pendingAction.node,
                    action: pendingAction.action,
                    rid,
                });
            });
            setSelectedResourcesByNode((prev) => ({
                ...prev,
                [pendingAction.node]: [],
            }));
        } else if (pendingAction.rid) {
            postResourceAction({
                node: pendingAction.node,
                action: pendingAction.action,
                rid: pendingAction.rid,
            });
        } else {
            postObjectAction({action: pendingAction.action});
        }
        setPendingAction(null);
        setConfirmDialogOpen(false);
        setStopDialogOpen(false);
        setUnprovisionDialogOpen(false);
        setPurgeDialogOpen(false);
        setSimpleDialogOpen(false);
    }, [pendingAction, selectedNodes, selectedResourcesByNode, postNodeAction, postResourceAction, postObjectAction]);
    const handleConsoleConfirm = useCallback(() => {
        if (pendingAction && pendingAction.action === "console" && pendingAction.node && pendingAction.rid) {
            postConsoleAction({node: pendingAction.node, rid: pendingAction.rid, seats, greet_timeout: greetTimeout});
        }
        setConsoleDialogOpen(false);
        setPendingAction(null);
    }, [pendingAction, seats, greetTimeout, postConsoleAction]);
    // Selection helpers
    const toggleNode = useCallback((node) => {
        setSelectedNodes((prev) =>
            prev.includes(node) ? prev.filter((n) => n !== node) : [...prev, node]
        );
    }, []);
    const toggleResource = useCallback((node, rid) => {
        setSelectedResourcesByNode((prev) => {
            const current = prev[node] || [];
            const next = current.includes(rid)
                ? current.filter((r) => r !== rid)
                : [...current, rid];
            return {...prev, [node]: next};
        });
    }, []);
    // Logs handlers
    const handleOpenLogs = useCallback((node, instanceName = null) => {
        setSelectedNodeForLogs(node);
        setSelectedInstanceForLogs(instanceName);
        setLogsDrawerOpen(true);
    }, []);
    const handleCloseLogsDrawer = useCallback(() => {
        setLogsDrawerOpen(false);
        setSelectedNodeForLogs(null);
        setSelectedInstanceForLogs(null);
    }, []);
    const startResizing = useCallback((e) => {
        e.preventDefault();
        const isTouch = e.type === 'touchstart';
        const startX = isTouch ? e.touches[0].clientX : e.clientX;
        const startWidth = drawerWidth;
        const doResize = (moveEvent) => {
            const currentX = isTouch ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const newWidth = startWidth + (startX - currentX);
            if (newWidth >= minDrawerWidth && newWidth <= maxDrawerWidth) {
                setDrawerWidth(newWidth);
            }
        };
        const stopResize = () => {
            if (isTouch) {
                document.removeEventListener("touchmove", doResize);
                document.removeEventListener("touchend", stopResize);
            } else {
                document.removeEventListener("mousemove", doResize);
                document.removeEventListener("mouseup", stopResize);
            }
            document.body.style.cursor = "default";
        };
        if (isTouch) {
            document.addEventListener("touchmove", doResize, {passive: false});
            document.addEventListener("touchend", stopResize);
        } else {
            document.addEventListener("mousemove", doResize);
            document.addEventListener("mouseup", stopResize);
        }
        document.body.style.cursor = "ew-resize";
    }, [drawerWidth, minDrawerWidth, maxDrawerWidth]);
    // Effect for configuring EventSource
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            const filters = [
                `ObjectStatusUpdated,path=${decodedObjectName}`,
                `InstanceStatusUpdated,path=${decodedObjectName}`,
                `ObjectDeleted,path=${decodedObjectName}`,
                `InstanceMonitorUpdated,path=${decodedObjectName}`,
                `InstanceConfigUpdated,path=${decodedObjectName}`,
            ];
            startEventReception(token, filters);
        }
        return () => {
            closeEventSource();
        };
    }, [decodedObjectName]);
    // Effect for handling config updates
    useEffect(() => {
        if (!isMounted.current) {
            return;
        }
        let subscription;
        try {
            subscription = useEventStore.subscribe(
                (state) => state.configUpdates,
                async (updates) => {
                    if (!isMounted.current || isProcessingConfigUpdate.current) {
                        return;
                    }
                    isProcessingConfigUpdate.current = true;
                    try {
                        const {name} = parseObjectPath(decodedObjectName);
                        const matchingUpdate = updates.find(
                            (u) =>
                                (u.name === name || u.fullName === decodedObjectName) &&
                                u.node
                        );
                        if (matchingUpdate && matchingUpdate.node) {
                            try {
                                const lastUpdateKey = `${decodedObjectName}:${matchingUpdate.node}`;
                                if (lastFetch.current[lastUpdateKey] && Date.now() - lastFetch.current[lastUpdateKey] < 2000) {
                                    console.log("[ObjectDetail] Skipping fetchConfig due to recent update");
                                    return;
                                }
                                await fetchConfig(matchingUpdate.node);
                                setConfigAccordionExpanded(true);
                                openSnackbar("Configuration updated", "info");
                            } catch (err) {
                                openSnackbar("Failed to load updated configuration", "error");
                            } finally {
                                clearConfigUpdate(decodedObjectName);
                            }
                        } else {
                            console.log("[ObjectDetail] No valid node in config update, skipping fetchConfig");
                        }
                    } finally {
                        isProcessingConfigUpdate.current = false;
                    }
                },
                {fireImmediately: false}
            );
        } catch (err) {
            console.warn("[ObjectDetail] Failed to subscribe to configUpdates:", err);
            return;
        }
        return () => {
            if (typeof subscription === "function") {
                subscription();
            } else {
                console.warn("[ObjectDetail] Subscription is not a function:", subscription);
            }
        };
    }, [decodedObjectName, clearConfigUpdate, fetchConfig, openSnackbar]);
    // Effect for handling instance config updates
    useEffect(() => {
        if (!isMounted.current) {
            return;
        }
        let subscription;
        try {
            subscription = useEventStore.subscribe(
                (state) => state.instanceConfig,
                (newConfig) => {
                    if (!isMounted.current) {
                        return;
                    }
                    const config = newConfig[decodedObjectName];
                    if (config && configNode) {
                        try {
                            setConfigAccordionExpanded(true);
                            openSnackbar("Instance configuration updated", "info");
                        } catch (err) {
                            openSnackbar("Failed to process instance configuration update", "error");
                        }
                    }
                }
            );
        } catch (err) {
            console.warn("[ObjectDetail] Failed to subscribe to instanceConfig:", err);
            return;
        }
        return () => {
            if (typeof subscription === "function") {
                subscription();
            } else {
                console.warn("[ObjectDetail] Subscription is not a function:", subscription);
            }
        };
    }, [decodedObjectName, configNode, openSnackbar]);
    // Initial load effects
    useEffect(() => {
        const loadInitialConfig = async () => {
            if (objectData) {
                const nodes = Object.keys(objectInstanceStatus[decodedObjectName] || {});
                const initialNode = nodes.find((node) => {
                    return objectData[node]?.encap &&
                        Object.values(objectData[node].encap).some(
                            (container) => container.resources && Object.keys(container.resources).length > 0
                        );
                }) || nodes[0];
                if (initialNode) {
                    try {
                        await fetchConfig(initialNode);
                    } catch (err) {
                        setConfigError("Failed to load initial configuration.");
                    }
                } else {
                    setConfigError("No nodes available to fetch configuration.");
                }
            } else {
                setConfigError("No object data available.");
            }
            setInitialLoading(false);
        };
        loadInitialConfig();
    }, [decodedObjectName, objectData, objectInstanceStatus, fetchConfig]);
    // Memoize data to prevent unnecessary re-renders
    const memoizedObjectData = useMemo(() => {
        const enhancedObjectData = {};
        if (objectData) {
            Object.keys(objectData).forEach((node) => {
                enhancedObjectData[node] = {
                    ...objectData[node],
                    instanceConfig: instanceConfig && instanceConfig[decodedObjectName] ? instanceConfig[decodedObjectName][node] || {resources: {}} : {resources: {}},
                    instanceMonitor: instanceMonitor[`${node}:${decodedObjectName}`] || {resources: {}},
                };
            });
        }
        return enhancedObjectData;
    }, [objectData, instanceConfig, instanceMonitor, decodedObjectName]);
    const memoizedNodes = useMemo(() => {
        return Object.keys(memoizedObjectData || {});
    }, [memoizedObjectData]);
    // Render loading state
    if (initialLoading && !memoizedObjectData) {
        return (
            <Box p={4} display="flex" justifyContent="center" alignItems="center">
                <CircularProgress/>
                <Typography ml={2}>Loading object data...</Typography>
            </Box>
        );
    }
    // Render empty state
    const showKeys = ["cfg", "sec"].includes(kind);
    if (!memoizedObjectData) {
        return (
            <Box p={4}>
                <Typography variant="h5" sx={{mb: 2}}>{decodedObjectName}</Typography>
                <Typography align="center" color="textSecondary" fontSize="1.2rem">
                    No information available for object.
                </Typography>
                {showKeys && (
                    <KeysSection decodedObjectName={decodedObjectName} openSnackbar={openSnackbar}/>
                )}
                <ConfigSection
                    decodedObjectName={decodedObjectName}
                    configNode={configNode}
                    setConfigNode={setConfigNode}
                    openSnackbar={openSnackbar}
                    handleManageParamsSubmit={() => setManageParamsDialogOpen(false)}
                    configData={configData}
                    configLoading={configLoading}
                    configError={configError}
                    configAccordionExpanded={configAccordionExpanded}
                    setConfigAccordionExpanded={setConfigAccordionExpanded}
                />
            </Box>
        );
    }
    return (
        <Box sx={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
            minHeight: "100vh",
            overflow: "hidden",
            boxSizing: "border-box",
        }}>
            <Box sx={{
                flex: logsDrawerOpen ? `0 0 calc(100% - ${drawerWidth}px)` : "1 1 100%",
                overflow: "auto",
                boxSizing: "border-box",
                maxWidth: logsDrawerOpen ? `calc(100% - ${drawerWidth}px)` : "100%",
                transition: theme.transitions.create(["flex", "maxWidth"], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                }),
            }}>
                <Box sx={{
                    width: "100%",
                    maxWidth: "1400px",
                    margin: "0 auto",
                    px: 2,
                    py: 4,
                    boxSizing: "border-box"
                }}>
                    <HeaderSection
                        decodedObjectName={decodedObjectName}
                        globalStatus={objectStatus[decodedObjectName]}
                        actionInProgress={actionInProgress}
                        objectMenuAnchor={objectMenuAnchor}
                        setObjectMenuAnchor={setObjectMenuAnchor}
                        handleObjectActionClick={handleObjectActionClick}
                        getObjectStatus={getObjectStatus}
                        getColor={getColor}
                        objectMenuAnchorRef={objectMenuAnchorRef}
                    />
                    {/* ActionDialogManager pour toutes les actions SAUF console */}
                    {pendingAction && pendingAction.action !== "console" && (
                        <ActionDialogManager
                            pendingAction={pendingAction}
                            handleConfirm={handleDialogConfirm}
                            target={`object ${decodedObjectName}`}
                            supportedActions={
                                pendingAction?.batch === "nodes"
                                    ? INSTANCE_ACTIONS.map((action) => action.name)
                                    : pendingAction?.batch === "resources" || pendingAction?.rid
                                        ? RESOURCE_ACTIONS.map((action) => action.name)
                                        : OBJECT_ACTIONS.map((action) => action.name)
                            }
                            onClose={() => {
                                setPendingAction(null);
                                setConfirmDialogOpen(false);
                                setStopDialogOpen(false);
                                setUnprovisionDialogOpen(false);
                                setPurgeDialogOpen(false);
                                setSimpleDialogOpen(false);
                            }}
                            confirmDialogOpen={confirmDialogOpen}
                            stopDialogOpen={stopDialogOpen}
                            unprovisionDialogOpen={unprovisionDialogOpen}
                            purgeDialogOpen={purgeDialogOpen}
                            simpleDialogOpen={simpleDialogOpen}
                            checkboxes={checkboxes}
                            setCheckboxes={setCheckboxes}
                            stopCheckbox={stopCheckbox}
                            setStopCheckbox={setStopCheckbox}
                            unprovisionCheckboxes={unprovisionCheckboxes}
                            setUnprovisionCheckboxes={setUnprovisionCheckboxes}
                            purgeCheckboxes={purgeCheckboxes}
                            setPurgeCheckboxes={setPurgeCheckboxes}
                        />
                    )}
                    <Dialog open={consoleDialogOpen} onClose={() => setConsoleDialogOpen(false)} maxWidth="sm"
                            fullWidth>
                        <DialogTitle>Open Console</DialogTitle>
                        <DialogContent>
                            <Typography variant="body1" sx={{mb: 2}}>
                                This will open a terminal console for the selected resource.
                            </Typography>
                            {pendingAction?.rid && (
                                <Typography variant="body2" color="primary" sx={{mb: 2, fontWeight: 'bold'}}>
                                    Resource: {pendingAction.rid}
                                </Typography>
                            )}
                            {pendingAction?.node && (
                                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                                    Node: {pendingAction.node}
                                </Typography>
                            )}
                            <Typography variant="body2" sx={{mb: 3}}>
                                The console session will open in a new browser tab and provide shell access to the
                                container.
                            </Typography>
                            <Box sx={{mb: 2}}>
                                <TextField
                                    autoFocus
                                    margin="dense"
                                    label="Number of Seats"
                                    type="number"
                                    fullWidth
                                    variant="outlined"
                                    value={seats}
                                    onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value) || 1))}
                                    helperText="Number of simultaneous users allowed in the console"
                                />
                            </Box>
                            <TextField
                                margin="dense"
                                label="Greet Timeout"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={greetTimeout}
                                onChange={(e) => setGreetTimeout(e.target.value)}
                                helperText="Time to wait for console connection (e.g., 5s, 10s)"
                            />
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setConsoleDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleConsoleConfirm}>Open Console</Button>
                        </DialogActions>
                    </Dialog>
                    <Dialog
                        open={consoleUrlDialogOpen}
                        onClose={() => setConsoleUrlDialogOpen(false)}
                        maxWidth="lg" // Changé à "lg" pour plus de largeur
                        fullWidth
                        sx={{
                            '& .MuiDialog-paper': {
                                minWidth: '600px', // Largeur minimale garantie
                                maxWidth: '90vw',  // Maximum 90% de la largeur de la vue
                            }
                        }}
                    >
                        <DialogTitle>Console URL</DialogTitle>
                        <DialogContent>
                            <Box sx={{
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                padding: '12px 14px',
                                backgroundColor: '#f5f5f5',
                                marginBottom: 2,
                                overflow: 'auto',
                                maxHeight: '100px',
                                fontFamily: 'monospace',
                                fontSize: '0.875rem',
                                whiteSpace: 'nowrap'
                            }}>
                                {currentConsoleUrl || 'No URL available'}
                            </Box>
                            <Box sx={{display: 'flex', gap: 2, flexWrap: 'wrap'}}>
                                <Button
                                    variant="outlined"
                                    onClick={() => {
                                        if (currentConsoleUrl) {
                                            navigator.clipboard.writeText(currentConsoleUrl);
                                            openSnackbar('URL copied to clipboard', 'success');
                                        }
                                    }}
                                    disabled={!currentConsoleUrl}
                                >
                                    Copy URL
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => {
                                        if (currentConsoleUrl) {
                                            window.open(currentConsoleUrl, '_blank', 'noopener,noreferrer');
                                        }
                                    }}
                                    disabled={!currentConsoleUrl}
                                >
                                    Open in New Tab
                                </Button>
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setConsoleUrlDialogOpen(false)}>Close</Button>
                        </DialogActions>
                    </Dialog>
                    {showKeys && (
                        <KeysSection decodedObjectName={decodedObjectName} openSnackbar={openSnackbar}/>
                    )}
                    <ConfigSection
                        decodedObjectName={decodedObjectName}
                        configNode={configNode}
                        setConfigNode={setConfigNode}
                        openSnackbar={openSnackbar}
                        handleManageParamsSubmit={() => setManageParamsDialogOpen(false)}
                        configData={configData}
                        configLoading={configLoading}
                        configError={configError}
                        configAccordionExpanded={configAccordionExpanded}
                        setConfigAccordionExpanded={setConfigAccordionExpanded}
                    />
                    <ManageConfigParamsDialog
                        open={manageParamsDialogOpen}
                        onClose={() => setManageParamsDialogOpen(false)}
                        onConfirm={() => setManageParamsDialogOpen(false)}
                        paramsToSet={paramsToSet}
                        setParamsToSet={setParamsToSet}
                        paramsToUnset={paramsToUnset}
                        setParamsToUnset={setParamsToUnset}
                        paramsToDelete={paramsToDelete}
                        setParamsToDelete={setParamsToDelete}
                        disabled={actionInProgress}
                    />
                    {!(["sec", "cfg", "usr"].includes(kind)) && (
                        <>
                            <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 2}}>
                                <Button
                                    variant="outlined"
                                    onClick={handleNodesActionsOpen}
                                    disabled={selectedNodes.length === 0}
                                    aria-label="Actions on selected nodes"
                                    ref={nodesActionsAnchorRef}
                                >
                                    Actions on Selected Nodes
                                </Button>
                            </Box>
                            {memoizedNodes.map((node) => (
                                <NodeCard
                                    key={node}
                                    node={node}
                                    nodeData={memoizedObjectData[node] || {}}
                                    selectedNodes={selectedNodes}
                                    toggleNode={toggleNode}
                                    selectedResourcesByNode={selectedResourcesByNode}
                                    toggleResource={toggleResource}
                                    actionInProgress={actionInProgress}
                                    individualNodeMenuAnchor={individualNodeMenuAnchor}
                                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                                    setCurrentNode={setCurrentNode}
                                    handleResourcesActionsOpen={handleResourcesActionsOpen}
                                    handleResourceMenuOpen={handleResourceMenuOpen}
                                    handleIndividualNodeActionClick={handleIndividualNodeActionClick}
                                    handleBatchResourceActionClick={handleBatchResourceActionClick}
                                    handleResourceActionClick={handleResourceActionClick}
                                    expandedNodeResources={expandedNodeResources}
                                    handleNodeResourcesAccordionChange={handleNodeResourcesAccordionChange}
                                    expandedResources={expandedResources}
                                    handleAccordionChange={handleAccordionChange}
                                    getColor={getColor}
                                    getNodeState={getNodeState}
                                    parseProvisionedState={parseProvisionedState}
                                    setPendingAction={setPendingAction}
                                    setConfirmDialogOpen={setConfirmDialogOpen}
                                    setStopDialogOpen={setStopDialogOpen}
                                    setUnprovisionDialogOpen={setUnprovisionDialogOpen}
                                    setPurgeDialogOpen={setPurgeDialogOpen}
                                    setSimpleDialogOpen={setSimpleDialogOpen}
                                    setCheckboxes={setCheckboxes}
                                    setStopCheckbox={setStopCheckbox}
                                    setUnprovisionCheckboxes={setUnprovisionCheckboxes}
                                    setPurgeCheckboxes={setPurgeCheckboxes}
                                    setSelectedResourcesByNode={setSelectedResourcesByNode}
                                    individualNodeMenuAnchorRef={individualNodeMenuAnchorRef}
                                    resourcesActionsAnchorRef={resourcesActionsAnchorRef}
                                    resourceMenuAnchorRef={resourceMenuAnchorRef}
                                    namespace={namespace}
                                    kind={kind}
                                    instanceName={name}
                                    onOpenLogs={handleOpenLogs}
                                />
                            ))}
                            <Popper
                                open={Boolean(nodesActionsAnchor)}
                                anchorEl={nodesActionsAnchor}
                                {...popperProps}
                            >
                                <ClickAwayListener onClickAway={handleNodesActionsClose}>
                                    <Paper elevation={3} role="menu" aria-label="Batch node actions menu">
                                        {INSTANCE_ACTIONS.map(({name, icon}) => (
                                            <MenuItem
                                                key={name}
                                                onClick={() => handleBatchNodeActionClick(name)}
                                                role="menuitem"
                                                aria-label={name.charAt(0).toUpperCase() + name.slice(1)}
                                            >
                                                <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                                <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                            </MenuItem>
                                        ))}
                                    </Paper>
                                </ClickAwayListener>
                            </Popper>
                            <Popper
                                open={Boolean(individualNodeMenuAnchor)}
                                anchorEl={individualNodeMenuAnchor}
                                {...popperProps}
                            >
                                <ClickAwayListener onClickAway={() => setIndividualNodeMenuAnchor(null)}>
                                    <Paper elevation={3} role="menu" aria-label={`Node ${currentNode} actions menu`}>
                                        {INSTANCE_ACTIONS.map(({name, icon}) => (
                                            <MenuItem
                                                key={name}
                                                onClick={() => handleIndividualNodeActionClick(name)}
                                                role="menuitem"
                                                aria-label={name.charAt(0).toUpperCase() + name.slice(1)}
                                            >
                                                <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                                <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                            </MenuItem>
                                        ))}
                                    </Paper>
                                </ClickAwayListener>
                            </Popper>
                            <Popper
                                open={Boolean(resourcesActionsAnchor)}
                                anchorEl={resourcesActionsAnchor}
                                {...popperProps}
                            >
                                <ClickAwayListener onClickAway={handleResourcesActionsClose}>
                                    <Paper elevation={3} role="menu"
                                           aria-label={`Batch resource actions for node ${resGroupNode}`}>
                                        {RESOURCE_ACTIONS.map(({name, icon}) => (
                                            <MenuItem
                                                key={name}
                                                onClick={() => handleBatchResourceActionClick(name)}
                                                role="menuitem"
                                                aria-label={name.charAt(0).toUpperCase() + name.slice(1)}
                                            >
                                                <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                                <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                            </MenuItem>
                                        ))}
                                    </Paper>
                                </ClickAwayListener>
                            </Popper>
                            <Popper
                                open={Boolean(resourceMenuAnchor) && Boolean(currentResourceId)}
                                anchorEl={resourceMenuAnchor}
                                {...popperProps}
                            >
                                <ClickAwayListener
                                    onClickAway={() => {
                                        setResourceMenuAnchor(null);
                                        setCurrentResourceId(null);
                                    }}
                                >
                                    <Paper elevation={3} role="menu"
                                           aria-label={`Resource ${currentResourceId} actions menu`}>
                                        {(() => {
                                            if (!currentResourceId || !resGroupNode || !memoizedObjectData[resGroupNode]) {
                                                return null;
                                            }
                                            const resourceType = getResourceType(currentResourceId, memoizedObjectData[resGroupNode]);
                                            const filteredActions = getFilteredResourceActions(resourceType);
                                            return filteredActions.map(({name, icon}) => (
                                                <MenuItem
                                                    key={name}
                                                    onClick={() => handleResourceActionClick(name)}
                                                    role="menuitem"
                                                    aria-label={name.charAt(0).toUpperCase() + name.slice(1)}
                                                >
                                                    <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                                    <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                                </MenuItem>
                                            ));
                                        })()}
                                    </Paper>
                                </ClickAwayListener>
                            </Popper>
                        </>
                    )}
                    <Snackbar
                        open={snackbar.open}
                        autoHideDuration={5000}
                        onClose={closeSnackbar}
                        anchorOrigin={{vertical: "bottom", horizontal: "center"}}
                    >
                        <Alert
                            onClose={closeSnackbar}
                            severity={snackbar.severity}
                            variant="filled"
                            aria-label={snackbar.severity === "error" ? "error alert" : `${snackbar.severity} alert`}
                        >
                            {snackbar.message}
                        </Alert>
                    </Snackbar>
                </Box>
            </Box>
            <Drawer
                anchor="right"
                open={logsDrawerOpen}
                variant="persistent"
                sx={{
                    "& .MuiDrawer-paper": {
                        width: logsDrawerOpen ? `${drawerWidth}px` : 0,
                        maxWidth: "80vw",
                        p: 2,
                        boxSizing: "border-box",
                        backgroundColor: theme.palette.background.paper,
                        top: 0,
                        height: "100vh",
                        overflow: "auto",
                        borderLeft: `1px solid ${theme.palette.divider}`,
                        transition: theme.transitions.create("width", {
                            easing: theme.transitions.easing.sharp,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                    },
                }}
            >
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "6px",
                        height: "100%",
                        cursor: "ew-resize",
                        bgcolor: theme.palette.grey[300],
                        "&:hover": {
                            bgcolor: theme.palette.primary.light,
                        },
                        transition: "background-color 0.2s",
                    }}
                    onMouseDown={startResizing}
                    onTouchStart={startResizing}
                    aria-label="Resize drawer"
                />
                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                    <Typography variant="h6">
                        {selectedInstanceForLogs
                            ? `Instance Logs - ${selectedInstanceForLogs}`
                            : `Node Logs - ${selectedNodeForLogs}`}
                    </Typography>
                    <IconButton onClick={handleCloseLogsDrawer}>
                        <CloseIcon/>
                    </IconButton>
                </Box>
                {selectedNodeForLogs && (
                    <LogsViewer
                        nodename={selectedNodeForLogs}
                        type={selectedInstanceForLogs ? "instance" : "node"}
                        namespace={namespace}
                        kind={kind}
                        instanceName={selectedInstanceForLogs}
                        height="calc(100vh - 100px)"
                    />
                )}
            </Drawer>
        </Box>
    );
};

export default ObjectDetail;
